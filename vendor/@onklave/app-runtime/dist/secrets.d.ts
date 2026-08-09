/**
 * Onklave app-runtime SECRET lib — one of the curated libs every Onklave/fnez
 * app is built against. At startup it fetches this pod's per-environment secrets
 * from vault and injects them into `process.env`, zero-trust:
 *
 *  1. It reads the pod's projected Kubernetes ServiceAccount token (mounted by
 *     shipyard, audience `vault`) — the pod's only credential, cluster-issued
 *     and auto-rotated. No secret is baked into the image or committed to git.
 *  2. It generates an ephemeral RSA key pair and asks vault for its
 *     (org, project, env) secret map, presenting the token as a Bearer.
 *  3. Vault verifies the token, binds it to this pod's (project, env), and
 *     returns the map re-encrypted to the ephemeral public key. Only this
 *     process, holding the private key, can decrypt it.
 *
 * Dependency-free (Node built-ins only) so it drops into any tenant app.
 */
export interface LoadSecretsOptions {
    /** Vault base URL. Default: in-cluster `http://app-vault.app-vault.svc.cluster.local`. */
    vaultUrl?: string;
    /** Projected-token path. Default: `/var/run/secrets/onklave/vault/vault-token`. */
    tokenPath?: string;
    /** Overrides for the identity env vars (default: read from process.env). */
    organizationId?: string;
    projectId?: string;
    environment?: string;
    /** Inject the resolved values into `process.env` (default true; never overwrites). */
    injectIntoEnv?: boolean;
    /** Override fetch (tests). Default: global `fetch` (Node 18+). */
    fetchImpl?: FetchLike;
}
/** The minimal fetch surface this lib needs — avoids a DOM lib dependency. */
export type FetchLike = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body: string;
}) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
    text(): Promise<string>;
}>;
/**
 * Fetch this pod's (org, project, env) secrets from vault and (by default) inject
 * them into `process.env`. Returns the resolved map. Throws on any failure — an
 * app that needs its secrets should fail loudly rather than boot half-configured.
 */
export declare function loadOnklaveSecrets(options?: LoadSecretsOptions): Promise<Record<string, string>>;
/** Convenience: load + inject, discarding the return (typical app bootstrap). */
export declare function injectOnklaveSecrets(options?: LoadSecretsOptions): Promise<void>;
