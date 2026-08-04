import express from 'express';

const APP_NAME = process.env.APP_NAME || 'template-node-web-service';

/**
 * Build the Express application.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  // Do not advertise the framework: it hands attackers a free fingerprint.
  app.disable('x-powered-by');

  app.get('/', (_req, res) => {
    res.json({ message: `Hello from ${APP_NAME}` });
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Unknown routes get a plain JSON 404, not Express's default HTML page.
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Errors are logged server-side only: the response carries no stack trace
  // or error message, which would otherwise leak internals to callers.
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

export default createApp;
