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
exports.createOnklaveAiMessage = createOnklaveAiMessage;
exports.aiText = aiText;
const DEFAULT_AI_URL = 'https://ai.onklave.app';
const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_MAX_TOKENS = 4096;
/**
 * Create an AI message through the Onklave AI gateway. Throws with the
 * response detail on any non-2xx (including 503 while the gateway is not yet
 * activated for the platform, 424 while the organisation has no Anthropic
 * credential configured, 429 at the daily cap, and 501 for streaming, which
 * is not yet supported).
 *
 * Environment (set automatically by the platform):
 * - `ONKLAVE_AI_KEY` — this app's AI gateway key (per environment).
 * - `ONKLAVE_AI_URL` — override the gateway base URL (defaults to the public
 *   host).
 */
async function createOnklaveAiMessage(params) {
    const key = process.env.ONKLAVE_AI_KEY;
    if (!key) {
        throw new Error('Onklave ai: ONKLAVE_AI_KEY must be set — has AI access been ' +
            'provisioned for this environment, and did injectOnklaveSecrets() run?');
    }
    const baseUrl = (process.env.ONKLAVE_AI_URL || DEFAULT_AI_URL).replace(/\/$/, '');
    const doFetch = globalThis.fetch;
    if (typeof doFetch !== 'function') {
        throw new Error('Onklave ai: no fetch implementation available');
    }
    const res = await doFetch(`${baseUrl}/api/v1/ai/messages`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: params.model ?? DEFAULT_MODEL,
            max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
            ...(params.system !== undefined ? { system: params.system } : {}),
            messages: params.messages,
        }),
    });
    if (!res.ok) {
        throw new Error(`Onklave AI message failed: ${res.status} ${await safeText(res)}`);
    }
    return (await res.json());
}
/** Concatenate the text blocks of a message into one string. */
function aiText(message) {
    return (message.content ?? [])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('');
}
async function safeText(res) {
    try {
        return (await res.text()).slice(0, 500);
    }
    catch {
        return '';
    }
}
