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
exports.OnklaveErrors = exports.OnklaveErrorsClient = exports.OnklaveError = exports.INGEST_PATH = exports.DEFAULT_ENDPOINT_BASE = void 0;
exports.normalizeStack = normalizeStack;
exports.pickOrigin = pickOrigin;
/**
 * Onklave error-tracking SDK — framework-agnostic core.
 *
 * Thin client that posts errors to the Onklave errors service ingest endpoint
 * (`POST /api/v1/events/errors`), authenticated with a per-project ingest key.
 *
 * Vendor-neutral: the only coupling is HTTP-to-ingest. The server resolves
 * org + project from the ingest key, so no trusted `projectId` is ever sent in
 * the body. Capture is fire-and-forget and never throws into the host app.
 *
 * See _docs/specs/ONKLAVE_CAPTURE_AND_ERROR_TRACKING_SPEC.md §5.2 and §7.3.
 */
/**
 * Default ingest base URL; the ingest path is appended to this.
 *
 * Dedicated public host that routes straight to the errors service, bypassing
 * the API gateway — error telemetry must not depend on the component whose
 * failures it captures. See `errors` (proxied: false) in service-registry.ts.
 */
exports.DEFAULT_ENDPOINT_BASE = 'https://errors.onklave.app';
/** Path appended to the base to form the full ingest URL (spec §7.3). */
exports.INGEST_PATH = '/api/v1/events/errors';
/**
 * An Error that carries structured, machine-readable context from the throw
 * site. Throw this (instead of a bare `Error`) where you have meaningful
 * context to attach — the SDK lifts `context` onto the captured event and
 * records the wrapped `cause`.
 *
 * @example
 *   throw new OnklaveError('Failed to settle invoice', {
 *     context: { invoiceId, orgId, amountCents },
 *     cause: err,
 *   });
 */
class OnklaveError extends Error {
    constructor(message, options) {
        super(message);
        this.name = 'OnklaveError';
        this.context = options === null || options === void 0 ? void 0 : options.context;
        if ((options === null || options === void 0 ? void 0 : options.cause) !== undefined) {
            this.cause = options.cause;
        }
        // Keep `instanceof` working across down-level transpilation targets.
        Object.setPrototypeOf(this, OnklaveError.prototype);
    }
}
exports.OnklaveError = OnklaveError;
/** Resolve the global fetch into the SDK transport shape. */
function defaultTransport() {
    const f = globalThis.fetch;
    if (typeof f !== 'function') {
        return undefined;
    }
    const fetchFn = f;
    return (url, init) => fetchFn(url, init);
}
/**
 * Normalize a raw stack string into structured frames.
 *
 * Best-effort parser for V8 (`at fn (file:line:col)`) and
 * SpiderMonkey/JSC (`fn@file:line:col`) formats. Unrecognized lines are kept
 * with just `raw` so nothing is lost.
 */
function normalizeStack(stack) {
    if (!stack) {
        return [];
    }
    const frames = [];
    for (const line of stack.split('\n')) {
        const raw = line.trim();
        if (!raw || raw.startsWith('Error') || raw.startsWith('at <anonymous>')) {
            // Skip the leading "Error: message" header line.
            if (raw.startsWith('Error')) {
                continue;
            }
        }
        if (!raw) {
            continue;
        }
        // V8: "at functionName (file:line:column)" or "at file:line:column"
        const v8 = /^at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/.exec(raw);
        if (v8) {
            frames.push({
                function: v8[1],
                file: v8[2],
                line: Number(v8[3]),
                column: Number(v8[4]),
                raw,
            });
            continue;
        }
        // SpiderMonkey/JSC: "functionName@file:line:column"
        const moz = /^(.*?)@(.+?):(\d+):(\d+)$/.exec(raw);
        if (moz) {
            frames.push({
                function: moz[1] || undefined,
                file: moz[2],
                line: Number(moz[3]),
                column: Number(moz[4]),
                raw,
            });
            continue;
        }
        frames.push({ raw });
    }
    return frames;
}
/**
 * Pick the originating ("culprit") frame: the first frame that has a source
 * location and belongs to application code, skipping the SDK's own frames and
 * runtime internals. Falls back to the first frame with a file, then the very
 * first frame, so something useful is always returned when frames exist.
 */
function pickOrigin(frames) {
    const toOrigin = (f) => ({
        function: f.function,
        file: f.file,
        line: f.line,
        column: f.column,
    });
    for (const f of frames) {
        if (!f.file) {
            continue;
        }
        if (f.file.startsWith('node:') || f.file.includes('node_modules')) {
            continue;
        }
        if (f.file.includes('@onklave/errors')) {
            continue; // never blame the error SDK itself
        }
        return toOrigin(f);
    }
    const firstWithFile = frames.find((f) => !!f.file);
    if (firstWithFile) {
        return toOrigin(firstWithFile);
    }
    return frames.length ? toOrigin(frames[0]) : undefined;
}
/**
 * Coerce an unknown thrown value into `{ type, message, stack }`, plus any
 * structured `context` lifted from an {@link OnklaveError} and/or the error's
 * `cause` chain.
 */
function describeError(error) {
    if (error instanceof Error) {
        const context = {};
        if (error instanceof OnklaveError && error.context) {
            Object.assign(context, error.context);
        }
        const cause = error.cause;
        if (cause !== undefined) {
            context['cause'] =
                cause instanceof Error
                    ? { type: cause.name || 'Error', message: cause.message }
                    : cause;
        }
        return {
            type: error.name || 'Error',
            message: error.message,
            stack: error.stack,
            context: Object.keys(context).length ? context : undefined,
        };
    }
    if (typeof error === 'string') {
        return { type: 'Error', message: error };
    }
    let message;
    try {
        message = JSON.stringify(error);
    }
    catch (_a) {
        message = String(error);
    }
    return { type: 'Error', message };
}
/**
 * The error-tracking client. Most callers use the {@link OnklaveErrors}
 * singleton via `init()`, but a standalone client can be constructed directly
 * for tests or multi-project usage.
 */
class OnklaveErrorsClient {
    constructor(config) {
        var _a, _b, _c;
        this.pending = new Set();
        const transport = (_a = config.transport) !== null && _a !== void 0 ? _a : defaultTransport();
        if (!transport) {
            throw new Error('@onklave/errors: no fetch available; pass a transport in init()');
        }
        const base = ((_b = config.endpoint) !== null && _b !== void 0 ? _b : exports.DEFAULT_ENDPOINT_BASE).replace(/\/+$/, '');
        this.config = {
            key: config.key,
            serviceName: config.serviceName,
            release: config.release,
            environment: config.environment,
            component: config.component,
            commitSha: config.commitSha,
            tags: config.tags,
            url: `${base}${exports.INGEST_PATH}`,
            transport,
            maxRetries: (_c = config.maxRetries) !== null && _c !== void 0 ? _c : 2,
        };
    }
    /** Build the ingestion payload for a described error (spec §7.3). */
    buildPayload(error, level, ctx) {
        const frames = normalizeStack(error.stack);
        const origin = pickOrigin(frames);
        const tags = (ctx === null || ctx === void 0 ? void 0 : ctx.tags) || this.config.tags
            ? Object.assign(Object.assign({}, this.config.tags), ctx === null || ctx === void 0 ? void 0 : ctx.tags) : undefined;
        // Merge the throw-site's structured context (from an OnklaveError / cause
        // chain) with the capture-site context; the latter is more specific so it
        // wins on key collisions.
        const context = error.context || (ctx === null || ctx === void 0 ? void 0 : ctx.context)
            ? Object.assign(Object.assign({}, error.context), ctx === null || ctx === void 0 ? void 0 : ctx.context) : undefined;
        return {
            serviceName: this.config.serviceName,
            component: this.config.component,
            environment: this.config.environment,
            release: this.config.release,
            commitSha: this.config.commitSha,
            tags,
            timestamp: new Date().toISOString(),
            error: {
                type: error.type,
                message: error.message,
                stack: error.stack,
                frames: frames.length ? frames : undefined,
                origin,
                level,
            },
            request: ctx === null || ctx === void 0 ? void 0 : ctx.request,
            context,
        };
    }
    /** Send a payload with a tiny retry loop. Never throws. */
    send(payload) {
        const body = JSON.stringify(payload);
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.key}`,
        };
        const task = (async () => {
            for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
                try {
                    const res = await this.config.transport(this.config.url, {
                        method: 'POST',
                        headers,
                        body,
                    });
                    // 4xx (other than 429) won't succeed on retry — stop.
                    if (res.ok ||
                        (res.status >= 400 && res.status < 500 && res.status !== 429)) {
                        return;
                    }
                }
                catch (_a) {
                    // Network error — fall through to retry / give up.
                }
            }
        })().catch(() => {
            // Capture must never throw or reject into the host app.
        });
        this.pending.add(task);
        void task.finally(() => this.pending.delete(task));
    }
    /** Capture a thrown error or rejection. Fire-and-forget; never throws. */
    captureException(error, context) {
        try {
            const described = describeError(error);
            this.send(this.buildPayload(described, 'error', context));
        }
        catch (_a) {
            // Swallow — capture must never throw into the host app.
        }
    }
    /** Capture a message at the given level (defaults to "info"). */
    captureMessage(message, level = 'info', context) {
        try {
            this.send(this.buildPayload({ type: 'Message', message }, level, context));
        }
        catch (_a) {
            // Swallow — capture must never throw into the host app.
        }
    }
    /** Await all in-flight sends. Resolves even if individual sends failed. */
    async flush() {
        await Promise.allSettled([...this.pending]);
    }
}
exports.OnklaveErrorsClient = OnklaveErrorsClient;
/**
 * Process-/page-wide singleton facade. Call {@link init} once at startup,
 * then use {@link captureException} / {@link captureMessage} anywhere.
 */
exports.OnklaveErrors = {
    _client: undefined,
    /** Initialize the singleton client. Safe to call once at startup. */
    init(config) {
        this._client = new OnklaveErrorsClient(config);
        return this._client;
    },
    /** Whether `init()` has been called. */
    isInitialized() {
        return this._client !== undefined;
    },
    /** Capture an exception via the singleton. No-op if not initialized. */
    captureException(error, context) {
        var _a;
        (_a = this._client) === null || _a === void 0 ? void 0 : _a.captureException(error, context);
    },
    /** Capture a message via the singleton. No-op if not initialized. */
    captureMessage(message, level, context) {
        var _a;
        (_a = this._client) === null || _a === void 0 ? void 0 : _a.captureMessage(message, level, context);
    },
    /** Flush pending sends via the singleton. */
    async flush() {
        var _a;
        await ((_a = this._client) === null || _a === void 0 ? void 0 : _a.flush());
    },
};
//# sourceMappingURL=index.js.map