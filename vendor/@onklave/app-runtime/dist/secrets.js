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
exports.loadOnklaveSecrets = loadOnklaveSecrets;
exports.injectOnklaveSecrets = injectOnklaveSecrets;
const crypto = __importStar(require("node:crypto"));
const node_fs_1 = require("node:fs");
const DEFAULT_TOKEN_PATH = '/var/run/secrets/onklave/vault/vault-token';
const DEFAULT_VAULT_URL = 'http://app-vault.app-vault.svc.cluster.local';
/**
 * Fetch this pod's (org, project, env) secrets from vault and (by default) inject
 * them into `process.env`. Returns the resolved map. Throws on any failure — an
 * app that needs its secrets should fail loudly rather than boot half-configured.
 */
async function loadOnklaveSecrets(options = {}) {
    const tokenPath = options.tokenPath ||
        process.env.ONKLAVE_VAULT_TOKEN_PATH ||
        DEFAULT_TOKEN_PATH;
    const vaultUrl = (options.vaultUrl ||
        process.env.ONKLAVE_VAULT_URL ||
        DEFAULT_VAULT_URL).replace(/\/$/, '');
    const organizationId = options.organizationId || process.env.ONKLAVE_ORG_ID;
    const projectId = options.projectId || process.env.ONKLAVE_PROJECT_ID;
    const environment = options.environment || process.env.ONKLAVE_ENV;
    if (!organizationId || !projectId || !environment) {
        throw new Error('Onklave secrets: ONKLAVE_ORG_ID / ONKLAVE_PROJECT_ID / ONKLAVE_ENV must be set');
    }
    const token = (0, node_fs_1.readFileSync)(tokenPath, 'utf8').trim();
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });
    const consumerPublicKey = publicKey.export({ format: 'jwk' });
    const doFetch = options.fetchImpl || globalThis.fetch;
    if (typeof doFetch !== 'function') {
        throw new Error('Onklave secrets: no fetch implementation available');
    }
    const res = await doFetch(`${vaultUrl}/app-secrets/resolve`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            organizationId,
            projectId,
            environment,
            consumerPublicKey,
        }),
    });
    if (!res.ok) {
        throw new Error(`Onklave secret fetch failed: ${res.status} ${await safeText(res)}`);
    }
    const data = (await res.json());
    if (!data?.encryptedValues) {
        throw new Error('Onklave secret fetch returned no payload');
    }
    const map = JSON.parse(decryptHybrid(data.encryptedValues, privateKey));
    if (options.injectIntoEnv !== false) {
        for (const [key, value] of Object.entries(map)) {
            // Never overwrite an explicitly-set env var (deploy-time wins).
            if (process.env[key] === undefined)
                process.env[key] = value;
        }
    }
    return map;
}
/** Convenience: load + inject, discarding the return (typical app bootstrap). */
async function injectOnklaveSecrets(options) {
    await loadOnklaveSecrets({ ...options, injectIntoEnv: true });
}
/**
 * Decrypt vault's hybrid payload `{RSA-OAEP(aesKey)}:{iv}:{AES-256-GCM ct‖tag}`
 * (base64, colon-joined) — the exact format `encryptWithPublicKey` produces. Web
 * Crypto appends the 16-byte GCM tag to the ciphertext, so we split it off for
 * Node's GCM decipher.
 */
function decryptHybrid(payload, privateKey) {
    const [encKeyB64, ivB64, encDataB64] = payload.split(':');
    if (!encKeyB64 || !ivB64 || !encDataB64) {
        throw new Error('Onklave secrets: malformed encrypted payload');
    }
    const aesKey = crypto.privateDecrypt({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
    }, Buffer.from(encKeyB64, 'base64'));
    const iv = Buffer.from(ivB64, 'base64');
    const encData = Buffer.from(encDataB64, 'base64');
    const tag = encData.subarray(encData.length - 16);
    const ciphertext = encData.subarray(0, encData.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]).toString('utf8');
}
async function safeText(res) {
    try {
        return (await res.text()).slice(0, 200);
    }
    catch {
        return '';
    }
}
