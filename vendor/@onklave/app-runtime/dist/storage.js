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
Object.defineProperty(exports, "__esModule", { value: true });
exports.putObject = putObject;
exports.getObject = getObject;
exports.deleteObject = deleteObject;
exports.listObjects = listObjects;
exports.getSignedUrl = getSignedUrl;
const DEFAULT_STORAGE_URL = 'https://artifacts.onklave.app';
/** Store (or overwrite) an object. Throws with detail on any non-2xx. */
async function putObject(objectKey, body, options = {}) {
    const bytes = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
    const res = await storageFetch(`/objects/${encodeKey(objectKey)}`, {
        method: 'PUT',
        headers: {
            // Always ship the transport as octet-stream so no server-side body
            // parser rewrites the bytes; the logical type rides its own header.
            'content-type': 'application/octet-stream',
            'x-onklave-content-type': options.contentType || 'application/octet-stream',
        },
        body: bytes,
    });
    return (await res.json());
}
/** Fetch an object's bytes + stored content type. Throws (404) if absent. */
async function getObject(objectKey) {
    const res = await storageFetch(`/objects/${encodeKey(objectKey)}`, {
        method: 'GET',
    });
    const buffer = await res.arrayBuffer();
    return {
        bytes: new Uint8Array(buffer),
        contentType: res.headers.get('content-type') || 'application/octet-stream',
    };
}
/** Delete an object. Throws (404) if absent. */
async function deleteObject(objectKey) {
    await storageFetch(`/objects/${encodeKey(objectKey)}`, {
        method: 'DELETE',
    });
}
/** List this environment's objects (metadata only), keyset-paged. */
async function listObjects(options = {}) {
    const params = new URLSearchParams();
    if (options.prefix)
        params.set('prefix', options.prefix);
    if (options.limit != null)
        params.set('limit', String(options.limit));
    if (options.cursor)
        params.set('cursor', options.cursor);
    const query = params.toString();
    const res = await storageFetch(`/objects${query ? `?${query}` : ''}`, {
        method: 'GET',
    });
    return (await res.json());
}
/**
 * Mint a public, time-boxed download URL for an object (default 15 minutes,
 * max 24 hours). The platform signs a token binding this app's scope + the
 * object key; anyone holding the URL can download until it expires — treat it
 * like the bytes themselves. Bytes still flow through the platform's per-org
 * decrypt path (this is NOT a raw bucket URL).
 */
async function getSignedUrl(objectKey, options = {}) {
    const res = await storageFetch('/signed-urls', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify({
            objectKey,
            ...(options.ttlSeconds != null
                ? { ttlSeconds: options.ttlSeconds }
                : {}),
        }), 'utf8'),
    });
    return (await res.json());
}
/**
 * Authenticated fetch against the app-storage data plane. Throws with the
 * response detail on any non-2xx (including 503 while app storage is not yet
 * activated, 413 over the per-object cap, 507 at the environment quota).
 *
 * Environment (set automatically by the platform):
 * - `ONKLAVE_STORAGE_KEY` — this app's storage key (per environment).
 * - `ONKLAVE_STORAGE_URL` — override the base URL (defaults to the public
 *   artifacts host).
 */
async function storageFetch(path, init) {
    const key = process.env.ONKLAVE_STORAGE_KEY;
    if (!key) {
        throw new Error('Onklave storage: ONKLAVE_STORAGE_KEY must be set — has the storage ' +
            'key been provisioned for this environment, and did ' +
            'injectOnklaveSecrets() run?');
    }
    const baseUrl = (process.env.ONKLAVE_STORAGE_URL || DEFAULT_STORAGE_URL).replace(/\/$/, '');
    const doFetch = globalThis.fetch;
    if (typeof doFetch !== 'function') {
        throw new Error('Onklave storage: no fetch implementation available');
    }
    const res = await doFetch(`${baseUrl}/api/v1/app-storage${path}`, {
        method: init.method,
        headers: { authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
        ...(init.body !== undefined
            ? { body: init.body }
            : {}),
    });
    if (!res.ok) {
        let detail = '';
        try {
            detail = (await res.text()).slice(0, 300);
        }
        catch {
            // response body unreadable — status alone will have to do
        }
        throw new Error(`Onklave storage: ${init.method} ${path} failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }
    return res;
}
/** Encode each path segment, preserving `/` separators. */
function encodeKey(objectKey) {
    return objectKey
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}
