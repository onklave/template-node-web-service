# template-node-web-service

An **Onklave project template** for a minimal, containerised Node.js HTTP service.
Use it as the starting point for a new service: a tidy, runnable skeleton with a
health check, a test, and a production Dockerfile — nothing more.

## What it is

- A small [Express](https://expressjs.com/) app exposing two routes:
  - `GET /` — a greeting JSON.
  - `GET /healthz` — the health-check contract (see below).
- ESM (`"type": "module"`), Node 22+.
- Built and served by Onklave from the included `Dockerfile`.

## Run locally

```bash
npm ci
npm run dev
```

The service listens on `:3000` by default (override with `PORT`). Then:

```bash
curl localhost:3000/
curl localhost:3000/healthz
```

## Test

```bash
npm test
```

Uses the built-in `node:test` runner — no extra test dependencies.

## Health-check contract

`GET /healthz` returns HTTP `200` with body:

```json
{ "status": "ok" }
```

## Deployment

`onklave.yaml` at the repo root is the deployment contract: it tells Onklave which
Dockerfile to build, the port to serve (`3000`), the health path to probe
(`/healthz`) and the route to expose. GitHub Actions is not used — add a second
service as another entry under `services` in that file.

The container runs as a non-root user. No changes to the build or run commands are
needed — keep the service listening on the port Onklave provides via `PORT` (default
`3000`) and keep `/healthz` answering `200`.
