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
import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
/**
 * Reports every uncaught exception to Onklave, then rethrows so the normal
 * Nest exception pipeline still produces the HTTP response.
 *
 * Register globally with `app.useGlobalFilters(new OnklaveExceptionFilter())`.
 */
export declare class OnklaveExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private buildContext;
}
