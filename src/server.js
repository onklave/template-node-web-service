import { createApp } from './app.js';

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
