<!--
  Copyright (c) 2026 Onklave (Pty) Ltd. All Rights Reserved.
-->

# @onklave/errors

Onklave error-tracking SDK — a thin, vendor-neutral client that posts errors to
the Onklave errors service ingest endpoint (`POST /api/v1/events/errors`),
authenticated with a per-project ingest key.

Implements §5.2.1–5.2.3 and §7.3 of
`_docs/specs/ONKLAVE_CAPTURE_AND_ERROR_TRACKING_SPEC.md`.

- Zero runtime dependencies (uses the platform `fetch`).
- Capture is fire-and-forget with a tiny retry and **never throws** into the host app.
- The server resolves org + project from the ingest key; the SDK never sends a
  trusted `projectId` in the body.

## Install

```bash
npm install @onklave/errors
```

## Core usage

```ts
import { OnklaveErrors } from '@onklave/errors';

OnklaveErrors.init({
  key: 'oerr_live_…',                      // project ingest key (resolves org+project server-side)
  serviceName: 'streaming-gateway',        // which app/service/lib in the monorepo
  release: '1.4.2',
  environment: 'production',
  component: '@onklave/streaming-gateway',  // optional finer-grained entry point
  commitSha: process.env.COMMIT_SHA,
  tags: { region: 'eu', tier: 'enterprise' },
  // endpoint defaults to https://api.onklave.app/errors
});

OnklaveErrors.captureException(err, {
  request: { method: 'GET', path: '/vaults/123', statusCode: 500 },
  context: { route: '/vaults/:id' },
});

OnklaveErrors.captureMessage('cache miss storm', 'warning');

await OnklaveErrors.flush(); // await pending sends (e.g. before process exit)
```

## Browser global handlers (`@onklave/errors/browser`)

```ts
import { OnklaveErrors } from '@onklave/errors';
import { installGlobalHandlers } from '@onklave/errors/browser';

OnklaveErrors.init({ key: '…', serviceName: 'portal', release: '1.0.0', environment: 'production' });
const uninstall = installGlobalHandlers(); // wires window.onerror + unhandledrejection
```

## NestJS exception filter (`@onklave/errors/nestjs`)

`@nestjs/common` is a peer dependency (not bundled). The filter reports the
exception then **rethrows**, so Nest's default handling still produces the
response.

```ts
import { OnklaveExceptionFilter } from '@onklave/errors/nestjs';

app.useGlobalFilters(new OnklaveExceptionFilter());
```

## Build / test / lint

```bash
npx nx build @onklave/errors
npx nx test @onklave/errors
npx nx lint @onklave/errors
```
