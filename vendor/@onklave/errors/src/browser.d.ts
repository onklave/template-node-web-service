/**
 * Browser entry (`@onklave/errors/browser`).
 *
 * Wires the global browser error handlers (`window.onerror` and
 * `unhandledrejection`) into the Onklave SDK. Install once after `init()`.
 *
 * See _docs/specs/ONKLAVE_CAPTURE_AND_ERROR_TRACKING_SPEC.md §5.3.
 */
import { CaptureContext } from './index';
export interface GlobalHandlerOptions {
    /** Extra context attached to every globally-captured event. */
    context?: CaptureContext;
}
/**
 * Install `window.onerror` + `unhandledrejection` listeners that forward to
 * {@link OnklaveErrors.captureException}. Chains any existing `window.onerror`
 * handler and returns an uninstall function. No-op outside a browser.
 */
export declare function installGlobalHandlers(options?: GlobalHandlerOptions): () => void;
