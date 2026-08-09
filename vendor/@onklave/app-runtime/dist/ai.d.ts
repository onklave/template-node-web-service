/**
 * Onklave app-runtime AI lib — governed AI model access for apps built on the
 * platform. Calls go through the Onklave AI gateway, which:
 *
 *  - authenticates this app via its per-(project, environment) AI gateway key
 *    (`ONKLAVE_AI_KEY`, provisioned as an app-secret and injected by the
 *    secret lib at startup);
 *  - resolves the owning org's BYO Anthropic credential from vault and proxies
 *    the request — this app NEVER holds a raw AI provider key;
 *  - enforces a model allowlist and output-token cap, applies a
 *    per-environment daily cap, and writes an append-only, metadata-only
 *    audit row (message content is never stored).
 *
 * Dependency-free (global `fetch`, Node 18+) so it drops into any tenant app.
 */
export interface OnklaveAiMessageParams {
    /** Model id (must be on the gateway's allowlist). Default: `claude-opus-5`. */
    model?: string;
    /** Maximum output tokens. Default: 4096 (the gateway also caps this). */
    maxTokens?: number;
    /** Optional system prompt. */
    system?: string;
    /** The conversation so far — Anthropic Messages format. */
    messages: Array<{
        role: 'user' | 'assistant';
        content: unknown;
    }>;
}
/** Minimal typing of the Anthropic Messages response the gateway passes through. */
export interface OnklaveAiMessage {
    id: string;
    model: string;
    stop_reason: string | null;
    content: Array<{
        type: string;
        text?: string;
    }>;
    usage: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
    };
}
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
export declare function createOnklaveAiMessage(params: OnklaveAiMessageParams): Promise<OnklaveAiMessage>;
/** Concatenate the text blocks of a message into one string. */
export declare function aiText(message: OnklaveAiMessage): string;
