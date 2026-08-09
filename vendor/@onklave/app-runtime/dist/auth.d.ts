/**
 * Onklave app-runtime AUTH lib — the server side of App Identity
 * (`authMode: 'app-identity'`): the platform provisions this app a dedicated
 * end-user realm + confidential OIDC client, and delivers the config as
 * per-environment secrets (fetched by the secret lib at startup):
 *
 *   ONKLAVE_OIDC_ISSUER_URL   — the realm's public issuer
 *   ONKLAVE_OIDC_CLIENT_ID    — the app's OIDC client (`app`)
 *   ONKLAVE_OIDC_CLIENT_SECRET— the confidential client secret (server-only)
 *
 * What this lib does:
 *  - `getOidcConfig()` / `publicOidcConfig()` — resolved endpoints for the
 *    server (with secret) and the browser (without). The SPA runs a standard
 *    OIDC authorization-code + PKCE flow against the issuer; credential entry,
 *    MFA and passkeys happen on the realm's hosted login page — an app never
 *    handles a password.
 *  - `verifyAccessToken()` — validates a bearer token against the realm's JWKS
 *    (RS256, cached), so the API can authenticate requests dependency-free.
 *
 * The app's own domain tables (roles, permissions, per-tenant scoping) link to
 * the token's `sub` — identity lives in the realm, authorization stays in the
 * app.
 */
export interface OidcConfig {
    issuerUrl: string;
    clientId: string;
    /** Absent in {@link publicOidcConfig} output. */
    clientSecret?: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userinfoEndpoint: string;
    endSessionEndpoint: string;
    jwksUri: string;
}
export interface VerifyOptions {
    /** Issuer override (default: `ONKLAVE_OIDC_ISSUER_URL`). */
    issuerUrl?: string;
    /** Seconds of clock skew tolerated on `exp`/`nbf` (default 30). */
    clockToleranceSec?: number;
    /**
     * When set, the token's `aud` (or Keycloak's `azp`) must include this value.
     * Pass your client id to reject tokens minted for another client.
     */
    audience?: string;
    /** Override fetch (tests). Default: global `fetch` (Node 18+). */
    fetchImpl?: typeof fetch;
}
/** A verified token's claims. */
export interface VerifiedToken {
    sub: string;
    claims: Record<string, unknown>;
}
/** Resolve the app's OIDC config (server-side, includes the client secret). */
export declare function getOidcConfig(): OidcConfig;
/** The browser-safe subset (no secret) — serve this to your SPA. */
export declare function publicOidcConfig(): Omit<OidcConfig, 'clientSecret'>;
/**
 * Verify an RS256 access token against the realm's JWKS. Checks signature,
 * `iss`, `exp`/`nbf` (with tolerance) and — when `audience` is given —
 * `aud`/`azp`. Throws on any failure; returns the claims on success.
 */
export declare function verifyAccessToken(token: string, options?: VerifyOptions): Promise<VerifiedToken>;
/** Test hook: drop cached JWKS so a spec can exercise refresh behaviour. */
export declare function clearJwksCache(): void;
