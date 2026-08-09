/**
 * Onklave app-runtime COMMS lib — governed outbound messaging (email, SMS,
 * WhatsApp) for apps built on the platform. Sends go through the Onklave
 * courier service, which:
 *
 *  - authenticates this app via its per-(project, environment) send key
 *    (`ONKLAVE_COURIER_KEY`, provisioned as an app-secret and injected by the
 *    secret lib at startup — one key covers all channels);
 *  - enforces platform-governed senders — for email an app can only
 *    contribute a display name (`fromName`, rendered as "<name> via
 *    Onklave"), never the sender address; SMS / WhatsApp send from the
 *    platform's numbers;
 *  - applies a per-environment, per-channel daily cap and writes an
 *    append-only audit row for every send.
 *
 * Dependency-free (global `fetch`, Node 18+) so it drops into any tenant app.
 */
export interface SendEmailOptions {
    /** Recipient email address (single). */
    to: string;
    /** Subject line. */
    subject: string;
    /** Plaintext body. */
    text: string;
    /** Optional HTML body. */
    html?: string;
    /** Optional Reply-To address. */
    replyTo?: string;
    /**
     * Optional display name, rendered by the platform as "<fromName> via
     * Onklave". The FROM ADDRESS itself is platform-governed.
     */
    fromName?: string;
}
export interface SendEmailResult {
    /** The courier audit-row id for this send. */
    id: string;
    status: 'sent' | 'failed';
    providerMessageId: string | null;
}
export interface SendMessageOptions {
    /** Recipient phone number in E.164 format (e.g. `+27821234567`). */
    to: string;
    /** Plain-text message body (SMS: max 1600 chars; WhatsApp: max 4096). */
    body: string;
}
export interface SendMessageResult {
    /** The courier audit-row id for this send. */
    id: string;
    status: 'sent' | 'failed';
    providerMessageId: string | null;
}
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
export declare function sendOnklaveEmail(options: SendEmailOptions): Promise<SendEmailResult>;
/**
 * Send an SMS through the Onklave courier service. The sender number is
 * platform-governed. Throws with the response detail on any non-2xx
 * (including 503 while SMS is not yet activated for the platform, and 429 at
 * the daily cap). Uses the same `ONKLAVE_COURIER_KEY` / `ONKLAVE_COURIER_URL`
 * environment as {@link sendOnklaveEmail}.
 */
export declare function sendOnklaveSms(options: SendMessageOptions): Promise<SendMessageResult>;
/**
 * Send a WhatsApp text message through the Onklave courier service. Plain
 * text only — template messages are future work. Throws with the response
 * detail on any non-2xx (including 503 while WhatsApp is not yet activated
 * for the platform, and 429 at the daily cap). Uses the same
 * `ONKLAVE_COURIER_KEY` / `ONKLAVE_COURIER_URL` environment as
 * {@link sendOnklaveEmail}.
 */
export declare function sendOnklaveWhatsapp(options: SendMessageOptions): Promise<SendMessageResult>;
