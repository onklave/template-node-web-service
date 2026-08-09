/**
 * Onklave app-runtime STORAGE lib — durable object storage for apps built on
 * the platform. Containers are replaced on every deploy, so the local
 * filesystem is never a place to keep uploads; objects go to the platform's
 * asset storage instead, where they are:
 *
 *  - scoped to this app's (project, environment) prefix — the platform
 *    resolves the scope from the storage key (`ONKLAVE_STORAGE_KEY`,
 *    provisioned as an app-secret and injected by the secret lib at startup);
 *    nothing in the request chooses where bytes land;
 *  - encrypted per organisation at the application level (bucket encryption
 *    is only the outer layer);
 *  - size- and quota-capped per environment.
 *
 * Dependency-free (global `fetch`, Node 18+) so it drops into any tenant app.
 */
export interface StoredObjectInfo {
    objectKey: string;
    sizeBytes: number;
    contentType: string;
    createdAt: string;
}
export interface RetrievedObject {
    bytes: Uint8Array;
    contentType: string;
}
export interface ListObjectsOptions {
    /** Only keys starting with this prefix. */
    prefix?: string;
    /** Page size (server-capped). */
    limit?: number;
    /** `nextCursor` from the previous page. */
    cursor?: string;
}
export interface ListObjectsResult {
    objects: StoredObjectInfo[];
    /** Pass back as `cursor` for the next page; null on the last page. */
    nextCursor: string | null;
}
export interface SignedUrlResult {
    /** Public, time-boxed download URL — shareable (email, portal links). */
    url: string;
    /** ISO timestamp the URL stops working. */
    expiresAt: string;
}
/** Store (or overwrite) an object. Throws with detail on any non-2xx. */
export declare function putObject(objectKey: string, body: Uint8Array | Buffer | string, options?: {
    contentType?: string;
}): Promise<StoredObjectInfo>;
/** Fetch an object's bytes + stored content type. Throws (404) if absent. */
export declare function getObject(objectKey: string): Promise<RetrievedObject>;
/** Delete an object. Throws (404) if absent. */
export declare function deleteObject(objectKey: string): Promise<void>;
/** List this environment's objects (metadata only), keyset-paged. */
export declare function listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult>;
/**
 * Mint a public, time-boxed download URL for an object (default 15 minutes,
 * max 24 hours). The platform signs a token binding this app's scope + the
 * object key; anyone holding the URL can download until it expires — treat it
 * like the bytes themselves. Bytes still flow through the platform's per-org
 * decrypt path (this is NOT a raw bucket URL).
 */
export declare function getSignedUrl(objectKey: string, options?: {
    ttlSeconds?: number;
}): Promise<SignedUrlResult>;
