import { createApp } from './app.js';
import { injectOnklaveSecrets } from '@onklave/app-runtime';

const port = process.env.PORT || 3000;

// On Onklave, per-environment secrets (DATABASE_URL, API keys, …) live in the
// project's vault and are fetched at startup via the pod's projected token,
// then injected into process.env. Local dev is unaffected: the pod identity
// env vars are absent, so this is a no-op. Read secrets AFTER this block.
if (process.env.ONKLAVE_PROJECT_ID) {
  try {
    await injectOnklaveSecrets();
  } catch (err) {
    // Fail open for the scaffold (it needs no secrets). An app that requires
    // one should guard for it explicitly after this block and exit loudly.
    console.error(`Onklave secret fetch failed: ${err.message}`);
  }
}

const app = createApp();

const server = app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

// Explicit timeouts. Without them a client can hold connections open by
// dribbling out a request (slowloris) and exhaust the server's sockets.
// Order matters: keepAlive < headers < request. Raise these if the service
// legitimately handles slow uploads or long-running requests.
server.keepAliveTimeout = 10_000;
server.headersTimeout = 20_000;
server.requestTimeout = 30_000;
