# Onklave tenant SDKs (vendored)

Prebuilt copies of the Onklave runtime SDKs, vendored at project creation so
this repo is self-contained (no private registry needed). Consume them with
`file:` dependencies in package.json:

```json
{
  "dependencies": {
    "@onklave/app-runtime": "file:vendor/@onklave/app-runtime",
    "@onklave/errors": "file:vendor/@onklave/errors"
  }
}
```

- **@onklave/app-runtime** — zero-trust per-environment secret loading
  (`injectOnklaveSecrets()` at process start; DATABASE_URL and friends),
  app-identity auth helpers, and governed outbound email
  (`sendOnklaveEmail()`, using the per-environment `ONKLAVE_COURIER_KEY`).
- **@onklave/app-runtime** storage — durable object storage
  (`putObject`/`getObject`/`listObjects`/`deleteObject`; reads
  `ONKLAVE_STORAGE_KEY`).
- **@onklave/errors** — error reporting to the Onklave errors service
  (`@onklave/errors` for Node, `/browser` for web, `/nestjs` for NestJS).
  Reads `ONKLAVE_ERRORS_INGEST_KEY`, provisioned per environment.

Do not edit these files — they are refreshed by the platform.
