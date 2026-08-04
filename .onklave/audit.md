# Template audit

- **Last audited:** 2026-08-04
- **Audited by:** Onklave platform maintenance (automated, Claude Code)
- **Next review due:** 2026-11-04 (quarterly, or sooner on a dependency alert)

## Why this file exists
So we know when this template was last deliberately checked, and what was true at
the time. Apps are generated from this repo — stale or vulnerable dependencies
here propagate to every app created from it.

## Scope of this audit
- Clean-install, test, lint and Docker build/run verification of the template as shipped.
- Dependency currency and vulnerability status (`npm audit`, `npm outdated`).
- Node base image currency against the official Node.js release schedule.
- Dockerfile security review: base image, non-root execution, build/runtime split,
  `.dockerignore` correctness.
- Repo security review: committed secrets (full git history), CORS posture,
  HTTP server timeouts, error/fingerprint leakage in responses.
- Not in scope: `onklave.yaml` (written and verified in a previous pass, untouched here);
  no OS-package CVE scan of the built image (see Findings #6).

## Verification run
| Check | Command | Result |
|---|---|---|
| Clean install (before) | `npm ci` | Pass — 68 packages, 1 low severity vulnerability |
| Unit tests (before) | `npm test` | Pass — 2/2 (`# pass 2`, `# fail 0`) |
| Lint (before) | `npm run lint` | Pass — `node --check` clean on both source files |
| Vulnerability scan (before) | `npm audit` | 1 low — body-parser `<1.20.6`, GHSA-v422-hmwv-36x6 |
| Outdated check (before) | `npm outdated` | express 4.22.2 installed, 5.2.1 latest |
| Transitive CVE fix | `npm audit fix` | Pass — body-parser 1.20.5 → 1.20.6, 0 vulnerabilities |
| Major upgrade trial | `npm install express@5` | Pass — express 5.2.1, 0 vulnerabilities |
| Unit tests (after) | `npm test` | Pass — 2/2 (`# pass 2`, `# fail 0`) |
| Lint (after) | `npm run lint` | Pass |
| Vulnerability scan (after) | `npm audit` | Pass — 0 vulnerabilities |
| Outdated check (after) | `npm outdated` | Pass — nothing outdated (exit 0, empty) |
| Local runtime smoke | `PORT=3998 node src/server.js` + `curl` | Pass — `/` 200 JSON, `/healthz` 200 `{"status":"ok"}`, `/nope` 404 JSON, no `X-Powered-By` |
| Docker build | `docker build -t template-node-web-service:audit .` | Pass — image built, 235MB |
| Container smoke | `docker run -p 3997:3000 …` + `curl /healthz` | Pass — HTTP 200 `{"status":"ok"}` |
| Container user | `docker exec … id` | Pass — `uid=1000(node) gid=1000(node)`, non-root |
| Container Node version | `docker exec … node -v` | Pass — v24.19.0 |
| Image contents (`.dockerignore`) | `docker exec … ls -a /app` | Pass — only `node_modules`, `onklave.yaml`, `package.json`, `package-lock.json`, `src` |
| Secret scan | `git grep -E '(api_key\|secret\|password\|token\|PRIVATE KEY\|AKIA…\|ghp_…\|xox…)' $(git rev-list --all)` | Pass — no matches across all commits |
| Image OS CVE scan | `docker scout cves …` | **Not run** — requires Docker Hub login, unavailable in this environment |

All checks above were executed; results are the real observed output, not assumed.

## Dependency status
Direct dependencies:

| Package | Before | After | Type |
|---|---|---|---|
| express | ^4.21.2 (4.22.2 resolved) | ^5.2.1 (5.2.1 resolved) | major — applied |

Transitive:

| Package | Before | After | Reason |
|---|---|---|---|
| body-parser | 1.20.5 | 2.3.0 (via express 5; 1.20.6 as an interim step) | GHSA-v422-hmwv-36x6 |

**Upgraded:**
- `express` 4.22.2 → 5.2.1. Applied as a major because the diff is trivially safe here:
  the template uses only `app.get` with static paths, `res.json` and `res.status`, all
  of which are unchanged in Express 5. Tests, lint, local runtime and a container smoke
  test all pass afterwards. Express 4 is maintenance-only; leaving the template on it
  would generate every new app on an unsupported major.
- Transitive `body-parser` past the advisory (first via `npm audit fix` on the v4 tree,
  then superseded by body-parser 2.x that ships with Express 5).

**Deliberately not upgraded:**
- `npm` itself (11.17.0 → 12.0.2 notice during the Docker build). This is the npm bundled
  in the base image, not a repo dependency; it moves with the base image and is not pinned here.
- Nothing else — `npm outdated` is empty after this audit.

## Findings

1. **(medium) Node base image was on Maintenance LTS.** `node:22-alpine` is still supported
   but Node 22 ("Jod") entered maintenance on 2025-10-21 and reaches EOL 2027-04-30, per the
   official Node release schedule. Node 24 ("Krypton") is the current Active LTS through
   2028-04-30. **Action taken:** both Dockerfile stages moved to `node:24-alpine`; verified
   the container runs v24.19.0 and serves `/healthz` 200.

2. **(low) Vulnerable transitive dependency.** body-parser `<1.20.6` — denial of service
   when an invalid `limit` value silently disables size enforcement (GHSA-v422-hmwv-36x6).
   **Action taken:** resolved; the tree now carries body-parser 2.3.0 and `npm audit`
   reports 0 vulnerabilities.

3. **(low) Framework fingerprint leaked on every response.** Express sends
   `X-Powered-By: Express` by default, which tells an attacker exactly what to target.
   **Action taken:** `app.disable('x-powered-by')` in `src/app.js`; confirmed absent from
   live responses.

4. **(low) Error and 404 responses leaked internals and broke the JSON contract.**
   Unknown routes returned Express's default HTML page reflecting the request path, and
   with no error handler an unhandled exception would return a stack trace whenever
   `NODE_ENV` is not `production` (the Dockerfile sets it, but local and non-Onklave runs
   do not). **Action taken:** added a JSON 404 handler and an error handler that logs the
   error server-side and returns only `{"error":"Internal Server Error"}`.

5. **(low) No explicit HTTP server timeouts.** The service relied on Node's defaults,
   leaving it open to slowloris-style socket exhaustion. **Action taken:** set
   `keepAliveTimeout` 10s, `headersTimeout` 20s, `requestTimeout` 30s in `src/server.js`,
   with a comment noting the required ordering and that they should be raised for slow
   uploads or long-running requests.

6. **(low) No OS-package vulnerability scan of the built image.** `docker scout` requires
   a Docker Hub login that is not available in this environment, so the Alpine base layer
   was not scanned for OS-level CVEs. Node-level dependencies are clean. **Recommended:**
   wire an authenticated image scan (Docker Scout, Trivy or Grype) into whatever pipeline
   builds template images, so base-layer CVEs surface without a manual audit.

7. **(low, not fixed — deliberate) Base image is a floating tag, not digest-pinned.**
   `node:24-alpine` picks up patched base images automatically, which is good for security
   but means builds are not byte-reproducible. **Recommended:** leave as-is for a template
   (auto-patching matters more than reproducibility here); pin by digest only if a generated
   app needs reproducible builds for compliance.

8. **(low, not fixed — deliberate) `npm ci` runs dependency lifecycle scripts at build time.**
   `npm ci --omit=dev` without `--ignore-scripts` lets a compromised transitive package
   execute arbitrary code during the image build. Adding `--ignore-scripts` is safe for this
   template (express only) but would silently break any generated app that adds a dependency
   needing a native build step. **Recommended:** treat as a per-app decision, not a template
   default; revisit if Onklave gains a build-time supply-chain policy.

9. **(low, not fixed — deliberate) No graceful SIGTERM shutdown.** On rollout the container
   is killed rather than draining, so in-flight requests can be dropped and shutdown waits
   for the orchestrator's kill timeout. Out of scope for this security/dependency audit and
   it changes runtime behaviour. **Recommended:** add a `SIGTERM` handler that calls
   `server.close()` before exit, as a separate change.

**Verified clean (no action needed):**
- **No secrets committed.** Full-history scan across every commit and every file ever added
  found no keys, tokens, passwords or private-key material. No `.env` file is tracked.
- **Container runs non-root.** `USER node` is set and confirmed at runtime as uid/gid 1000.
- **`.dockerignore` is correct.** Verified by listing `/app` inside the running container:
  no `.git`, no `test/`, no `Dockerfile`, no `README.md`, no `.env*`, no host `node_modules`.
- **No permissive CORS.** The app sets no CORS headers at all, so it is same-origin by
  default. Anything looser must be an explicit, deliberate choice in a generated app.
- **Multi-stage build is sound.** Production dependencies are installed in the build stage
  and copied into a clean runtime stage; no dev dependencies or npm cache reach the image.

## Changes made in this audit
- Upgraded `express` 4.22.2 → 5.2.1 and cleared the body-parser advisory (0 vulnerabilities).
- Moved the Dockerfile from `node:22-alpine` to `node:24-alpine` (Maintenance → Active LTS).
- `src/app.js`: disabled `x-powered-by`; added a JSON 404 handler and a non-leaking JSON
  error handler.
- `src/server.js`: captured the server handle and set explicit `keepAliveTimeout`,
  `headersTimeout` and `requestTimeout`.
- `README.md`: noted the container runs Node 24 and documented the JSON 404/500 behaviour.
- Added this file (`.onklave/audit.md`).
- `onklave.yaml` deliberately untouched.

## Open items
1. **Decide whether `engines.node` should move from `>=22` to `>=24`.** It is currently a
   permissive floor, so local Node 22 development is allowed while the container runs Node 24.
   That is intentional and non-breaking, but it does mean dev and prod can differ by a major
   version. A human should decide which parity model this template should teach.
2. **Add an authenticated image CVE scan** to the template pipeline (Finding #6) — this audit
   could only clear npm-level dependencies, not the Alpine base layer.
3. **Consider a graceful-shutdown change** (Finding #9) as a small follow-up, since every
   generated app inherits the current abrupt-kill behaviour.
4. **Express 5 note for downstream apps:** Express 5 uses path-to-regexp v8, so route syntax
   from Express 4 (`/:param?` optionals, bare `*` wildcards) no longer parses. The template's
   own routes are unaffected, but any documentation or examples aimed at app authors should
   reflect Express 5 syntax.
