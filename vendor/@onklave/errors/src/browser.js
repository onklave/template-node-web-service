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
exports.installGlobalHandlers = installGlobalHandlers;
/**
 * Browser entry (`@onklave/errors/browser`).
 *
 * Wires the global browser error handlers (`window.onerror` and
 * `unhandledrejection`) into the Onklave SDK. Install once after `init()`.
 *
 * See _docs/specs/ONKLAVE_CAPTURE_AND_ERROR_TRACKING_SPEC.md §5.3.
 */
const index_1 = require("./index");
/**
 * Install `window.onerror` + `unhandledrejection` listeners that forward to
 * {@link OnklaveErrors.captureException}. Chains any existing `window.onerror`
 * handler and returns an uninstall function. No-op outside a browser.
 */
function installGlobalHandlers(options = {}) {
    if (typeof window === 'undefined') {
        return () => undefined;
    }
    const baseContext = options.context;
    const onRejection = (event) => {
        index_1.OnklaveErrors.captureException(event.reason, baseContext);
    };
    const previousOnError = window.onerror;
    const onError = (message, source, lineno, colno, error) => {
        const captured = error !== null && error !== void 0 ? error : (typeof message === 'string' ? message : 'window.onerror');
        index_1.OnklaveErrors.captureException(captured, Object.assign(Object.assign({}, baseContext), { context: Object.assign(Object.assign({}, baseContext === null || baseContext === void 0 ? void 0 : baseContext.context), { source,
                lineno,
                colno }) }));
        if (typeof previousOnError === 'function') {
            return previousOnError.call(window, message, source, lineno, colno, error);
        }
        return false;
    };
    window.addEventListener('unhandledrejection', onRejection);
    window.onerror = onError;
    return () => {
        window.removeEventListener('unhandledrejection', onRejection);
        if (window.onerror === onError) {
            window.onerror = previousOnError;
        }
    };
}
//# sourceMappingURL=browser.js.map