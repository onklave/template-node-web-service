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
export declare const DEFAULT_ENDPOINT_BASE = "https://errors.onklave.app";
/** Path appended to the base to form the full ingest URL (spec §7.3). */
export declare const INGEST_PATH = "/api/v1/events/errors";
/** Severity levels for captured messages (Sentry-style). */
export type ErrorLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';
/** Arbitrary string-keyed dimensions attached to every event. */
export type Tags = Record<string, string>;
/** Free-form context attached to a single event. */
export interface CaptureContext {
    /** Request metadata, if the error happened in a request lifecycle. */
    request?: ErrorRequest;
    /** Arbitrary extra context (browser, os, route, feature, etc.). */
    context?: Record<string, unknown>;
    /** Per-event tag overrides, merged over the init-level tags. */
    tags?: Tags;
}
/** HTTP request descriptor for an error (spec §7.3 `request`). */
export interface ErrorRequest {
    method?: string;
    path?: string;
    statusCode?: number;
}
/** A single normalized stack frame. */
export interface StackFrame {
    function?: string;
    file?: string;
    line?: number;
    column?: number;
    raw: string;
}
/**
 * The originating ("culprit") source location of an error — the first
 * application frame in the stack, with the SDK's own and runtime-internal
 * frames skipped. This is what the dashboard shows as "where it happened".
 */
export interface ErrorOrigin {
    function?: string;
    file?: string;
    line?: number;
    column?: number;
}
/** Options for {@link OnklaveError}. */
export interface OnklaveErrorOptions {
    /**
     * Structured context describing what the code was doing when it failed —
     * the operation, the ids/inputs involved, anything that aids triage. Merged
     * into the captured event's context.
     */
    context?: Record<string, unknown>;
    /** The underlying error being wrapped; preserved on the cause chain. */
    cause?: unknown;
}
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
export declare class OnklaveError extends Error {
    readonly context?: Record<string, unknown>;
    constructor(message: string, options?: OnklaveErrorOptions);
}
/** SDK init options (spec §5.2.3). */
export interface OnklaveErrorsConfig {
    /** Project ingest key. Resolves org + project server-side. Required. */
    key: string;
    /** Which app/service/lib in the monorepo. Required. */
    serviceName: string;
    /** Release / version. Required for monorepo grouping. */
    release: string;
    /** Deployment environment, e.g. "production". Required. */
    environment: string;
    /** Optional finer-grained package / entry point. */
    component?: string;
    /** Optional commit SHA for the running build. */
    commitSha?: string;
    /** Optional arbitrary extra dimensions. */
    tags?: Tags;
    /**
     * Optional ingest base URL. The ingest path ({@link INGEST_PATH}) is appended.
     * Defaults to {@link DEFAULT_ENDPOINT_BASE}.
     */
    endpoint?: string;
    /** Optional custom transport (mainly for testing). Defaults to global fetch. */
    transport?: Transport;
    /** Max send attempts per event (1 = no retry). Defaults to 2. */
    maxRetries?: number;
}
/** Pluggable transport. Mirrors the subset of fetch the SDK uses. */
export type Transport = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body: string;
}) => Promise<{
    ok: boolean;
    status: number;
}>;
/** The ingestion payload sent to the errors service (spec §7.3). */
export interface ErrorEventPayload {
    serviceName: string;
    component?: string;
    environment: string;
    release: string;
    commitSha?: string;
    tags?: Tags;
    timestamp: string;
    error: {
        type: string;
        message: string;
        stack?: string;
        frames?: StackFrame[];
        /** Where the error originated (first application frame). */
        origin?: ErrorOrigin;
        level?: ErrorLevel;
    };
    request?: ErrorRequest;
    context?: Record<string, unknown>;
}
/**
 * Normalize a raw stack string into structured frames.
 *
 * Best-effort parser for V8 (`at fn (file:line:col)`) and
 * SpiderMonkey/JSC (`fn@file:line:col`) formats. Unrecognized lines are kept
 * with just `raw` so nothing is lost.
 */
export declare function normalizeStack(stack?: string): StackFrame[];
/**
 * Pick the originating ("culprit") frame: the first frame that has a source
 * location and belongs to application code, skipping the SDK's own frames and
 * runtime internals. Falls back to the first frame with a file, then the very
 * first frame, so something useful is always returned when frames exist.
 */
export declare function pickOrigin(frames: StackFrame[]): ErrorOrigin | undefined;
/**
 * The error-tracking client. Most callers use the {@link OnklaveErrors}
 * singleton via `init()`, but a standalone client can be constructed directly
 * for tests or multi-project usage.
 */
export declare class OnklaveErrorsClient {
    private readonly config;
    private readonly pending;
    constructor(config: OnklaveErrorsConfig);
    /** Build the ingestion payload for a described error (spec §7.3). */
    private buildPayload;
    /** Send a payload with a tiny retry loop. Never throws. */
    private send;
    /** Capture a thrown error or rejection. Fire-and-forget; never throws. */
    captureException(error: unknown, context?: CaptureContext): void;
    /** Capture a message at the given level (defaults to "info"). */
    captureMessage(message: string, level?: ErrorLevel, context?: CaptureContext): void;
    /** Await all in-flight sends. Resolves even if individual sends failed. */
    flush(): Promise<void>;
}
/**
 * Process-/page-wide singleton facade. Call {@link init} once at startup,
 * then use {@link captureException} / {@link captureMessage} anywhere.
 */
export declare const OnklaveErrors: {
    _client: OnklaveErrorsClient | undefined;
    /** Initialize the singleton client. Safe to call once at startup. */
    init(config: OnklaveErrorsConfig): OnklaveErrorsClient;
    /** Whether `init()` has been called. */
    isInitialized(): boolean;
    /** Capture an exception via the singleton. No-op if not initialized. */
    captureException(error: unknown, context?: CaptureContext): void;
    /** Capture a message via the singleton. No-op if not initialized. */
    captureMessage(message: string, level?: ErrorLevel, context?: CaptureContext): void;
    /** Flush pending sends via the singleton. */
    flush(): Promise<void>;
};
