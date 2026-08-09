"use strict";
/*
 * Copyright 2025-2026 Onklave (Pty) Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOidcConfig = getOidcConfig;
exports.publicOidcConfig = publicOidcConfig;
exports.verifyAccessToken = verifyAccessToken;
exports.clearJwksCache = clearJwksCache;
const crypto = __importStar(require("node:crypto"));
/** Resolve the app's OIDC config (server-side, includes the client secret). */
function getOidcConfig() {
    const issuerUrl = (process.env.ONKLAVE_OIDC_ISSUER_URL || '').replace(/\/$/, '');
    const clientId = process.env.ONKLAVE_OIDC_CLIENT_ID;
    const clientSecret = process.env.ONKLAVE_OIDC_CLIENT_SECRET;
    if (!issuerUrl || !clientId || !clientSecret) {
        throw new Error('Onklave auth: ONKLAVE_OIDC_ISSUER_URL / ONKLAVE_OIDC_CLIENT_ID / ' +
            'ONKLAVE_OIDC_CLIENT_SECRET must be set — has app identity been ' +
            'provisioned for this environment, and did injectOnklaveSecrets() run?');
    }
    return { ...endpointsFor(issuerUrl), clientId, clientSecret };
}
/** The browser-safe subset (no secret) — serve this to your SPA. */
function publicOidcConfig() {
    const { clientSecret: _secret, ...rest } = getOidcConfig();
    return rest;
}
function endpointsFor(issuerUrl) {
    const base = `${issuerUrl}/protocol/openid-connect`;
    return {
        issuerUrl,
        authorizationEndpoint: `${base}/auth`,
        tokenEndpoint: `${base}/token`,
        userinfoEndpoint: `${base}/userinfo`,
        endSessionEndpoint: `${base}/logout`,
        jwksUri: `${base}/certs`,
    };
}
/** JWKS cache: one entry per issuer, refreshed on unknown `kid` or expiry. */
const jwksCache = new Map();
const JWKS_TTL_MS = 10 * 60 * 1000;
/**
 * Verify an RS256 access token against the realm's JWKS. Checks signature,
 * `iss`, `exp`/`nbf` (with tolerance) and — when `audience` is given —
 * `aud`/`azp`. Throws on any failure; returns the claims on success.
 */
async function verifyAccessToken(token, options = {}) {
    const issuerUrl = (options.issuerUrl ||
        process.env.ONKLAVE_OIDC_ISSUER_URL ||
        '').replace(/\/$/, '');
    if (!issuerUrl) {
        throw new Error('Onklave auth: no issuer configured');
    }
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
        throw new Error('Onklave auth: malformed token');
    }
    const header = decodeSegment(headerB64);
    if (header.alg !== 'RS256') {
        throw new Error(`Onklave auth: unsupported alg ${header.alg}`);
    }
    const jwk = await findKey(issuerUrl, header.kid, options.fetchImpl);
    const publicKey = crypto.createPublicKey({
        key: jwk,
        format: 'jwk',
    });
    const valid = crypto.verify('RSA-SHA256', Buffer.from(`${headerB64}.${payloadB64}`), publicKey, Buffer.from(signatureB64, 'base64url'));
    if (!valid) {
        throw new Error('Onklave auth: invalid token signature');
    }
    const claims = decodeSegment(payloadB64);
    const nowSec = Date.now() / 1000;
    const tolerance = options.clockToleranceSec ?? 30;
    if (claims.iss !== issuerUrl) {
        throw new Error('Onklave auth: token issuer mismatch');
    }
    if (typeof claims.exp === 'number' && nowSec > claims.exp + tolerance) {
        throw new Error('Onklave auth: token expired');
    }
    if (typeof claims.nbf === 'number' && nowSec < claims.nbf - tolerance) {
        throw new Error('Onklave auth: token not yet valid');
    }
    if (options.audience) {
        const aud = claims.aud;
        const audList = Array.isArray(aud) ? aud : aud != null ? [aud] : [];
        if (!audList.includes(options.audience) &&
            claims.azp !== options.audience) {
            throw new Error('Onklave auth: token audience mismatch');
        }
    }
    if (typeof claims.sub !== 'string' || !claims.sub) {
        throw new Error('Onklave auth: token has no subject');
    }
    return { sub: claims.sub, claims };
}
/** Test hook: drop cached JWKS so a spec can exercise refresh behaviour. */
function clearJwksCache() {
    jwksCache.clear();
}
async function findKey(issuerUrl, kid, fetchImpl) {
    const cached = jwksCache.get(issuerUrl);
    const fromCache = cached && Date.now() < cached.expiresAt
        ? cached.keys.find((k) => !kid || k['kid'] === kid)
        : undefined;
    if (fromCache)
        return fromCache;
    const doFetch = fetchImpl || globalThis.fetch;
    if (typeof doFetch !== 'function') {
        throw new Error('Onklave auth: no fetch implementation available');
    }
    const res = await doFetch(`${issuerUrl}/protocol/openid-connect/certs`);
    if (!res.ok) {
        throw new Error(`Onklave auth: JWKS fetch failed (${res.status})`);
    }
    const jwks = (await res.json());
    const keys = jwks.keys ?? [];
    jwksCache.set(issuerUrl, { keys, expiresAt: Date.now() + JWKS_TTL_MS });
    const key = keys.find((k) => !kid || k['kid'] === kid);
    if (!key) {
        throw new Error('Onklave auth: no matching signing key in JWKS');
    }
    return key;
}
function decodeSegment(segment) {
    try {
        return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    }
    catch {
        throw new Error('Onklave auth: malformed token segment');
    }
}
