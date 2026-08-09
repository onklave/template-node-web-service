import { initOnklave } from './onklave.js';

// Platform wiring first: per-environment secrets land in process.env and
// error tracking starts. A no-op off-platform (local dev, CI).
await initOnklave(process.env.APP_NAME || 'template-node-web-service');

const { createApp } = await import('./app.js');

const port = process.env.PORT || 3000;
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
