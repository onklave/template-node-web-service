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
exports.OnklaveExceptionFilter = void 0;
const tslib_1 = require("tslib");
/**
 * NestJS entry (`@onklave/errors/nestjs`).
 *
 * A catch-all exception filter that reports the exception to the Onklave SDK
 * and then rethrows, so it composes with Nest's built-in exception handling
 * rather than replacing it.
 *
 * `@nestjs/common` is a peer dependency — it is not bundled.
 *
 * See _docs/specs/ONKLAVE_CAPTURE_AND_ERROR_TRACKING_SPEC.md §5.3.
 */
const common_1 = require("@nestjs/common");
const index_1 = require("./index");
/**
 * Reports every uncaught exception to Onklave, then rethrows so the normal
 * Nest exception pipeline still produces the HTTP response.
 *
 * Register globally with `app.useGlobalFilters(new OnklaveExceptionFilter())`.
 */
let OnklaveExceptionFilter = class OnklaveExceptionFilter {
    catch(exception, host) {
        try {
            index_1.OnklaveErrors.captureException(exception, this.buildContext(host));
        }
        catch (_a) {
            // Capture must never interfere with the host app's error handling.
        }
        // Rethrow so Nest's default handling produces the response.
        throw exception;
    }
    buildContext(host) {
        if (host.getType() !== 'http') {
            return undefined;
        }
        try {
            const http = host.switchToHttp();
            const req = http.getRequest();
            return {
                request: {
                    method: req === null || req === void 0 ? void 0 : req.method,
                    path: req === null || req === void 0 ? void 0 : req.url,
                },
            };
        }
        catch (_a) {
            return undefined;
        }
    }
};
exports.OnklaveExceptionFilter = OnklaveExceptionFilter;
exports.OnklaveExceptionFilter = OnklaveExceptionFilter = tslib_1.__decorate([
    (0, common_1.Catch)()
], OnklaveExceptionFilter);
//# sourceMappingURL=nestjs.js.map