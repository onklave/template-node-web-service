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
exports.sendOnklaveEmail = sendOnklaveEmail;
exports.sendOnklaveSms = sendOnklaveSms;
exports.sendOnklaveWhatsapp = sendOnklaveWhatsapp;
const DEFAULT_COURIER_URL = 'https://courier.onklave.app';
/**
 * Send a transactional email through the Onklave courier service. Throws with
 * the response detail on any non-2xx (including 503 while outbound email is
 * not yet activated for the platform, and 429 at the daily cap).
 *
 * Environment (set automatically by the platform):
 * - `ONKLAVE_COURIER_KEY` — this app's send key (per environment).
 * - `ONKLAVE_COURIER_URL` — override the courier base URL (defaults to the
 *   public host).
 */
async function sendOnklaveEmail(options) {
    const key = process.env.ONKLAVE_COURIER_KEY;
    if (!key) {
        throw new Error('Onklave comms: ONKLAVE_COURIER_KEY must be set — has the courier send ' +
            'key been provisioned for this environment, and did ' +
            'injectOnklaveSecrets() run?');
    }
    const baseUrl = (process.env.ONKLAVE_COURIER_URL || DEFAULT_COURIER_URL).replace(/\/$/, '');
    const doFetch = globalThis.fetch;
    if (typeof doFetch !== 'function') {
        throw new Error('Onklave comms: no fetch implementation available');
    }
    const res = await doFetch(`${baseUrl}/api/v1/send/email`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            replyTo: options.replyTo,
            fromName: options.fromName,
        }),
    });
    if (!res.ok) {
        throw new Error(`Onklave email send failed: ${res.status} ${await safeText(res)}`);
    }
    return (await res.json());
}
/**
 * Send an SMS through the Onklave courier service. The sender number is
 * platform-governed. Throws with the response detail on any non-2xx
 * (including 503 while SMS is not yet activated for the platform, and 429 at
 * the daily cap). Uses the same `ONKLAVE_COURIER_KEY` / `ONKLAVE_COURIER_URL`
 * environment as {@link sendOnklaveEmail}.
 */
async function sendOnklaveSms(options) {
    return sendMessage('sms', options);
}
/**
 * Send a WhatsApp text message through the Onklave courier service. Plain
 * text only — template messages are future work. Throws with the response
 * detail on any non-2xx (including 503 while WhatsApp is not yet activated
 * for the platform, and 429 at the daily cap). Uses the same
 * `ONKLAVE_COURIER_KEY` / `ONKLAVE_COURIER_URL` environment as
 * {@link sendOnklaveEmail}.
 */
async function sendOnklaveWhatsapp(options) {
    return sendMessage('whatsapp', options);
}
async function sendMessage(channel, options) {
    const key = process.env.ONKLAVE_COURIER_KEY;
    if (!key) {
        throw new Error('Onklave comms: ONKLAVE_COURIER_KEY must be set — has the courier send ' +
            'key been provisioned for this environment, and did ' +
            'injectOnklaveSecrets() run?');
    }
    const baseUrl = (process.env.ONKLAVE_COURIER_URL || DEFAULT_COURIER_URL).replace(/\/$/, '');
    const doFetch = globalThis.fetch;
    if (typeof doFetch !== 'function') {
        throw new Error('Onklave comms: no fetch implementation available');
    }
    const res = await doFetch(`${baseUrl}/api/v1/send/${channel}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            to: options.to,
            body: options.body,
        }),
    });
    if (!res.ok) {
        throw new Error(`Onklave ${channel} send failed: ${res.status} ${await safeText(res)}`);
    }
    return (await res.json());
}
async function safeText(res) {
    try {
        return (await res.text()).slice(0, 500);
    }
    catch {
        return '';
    }
}
