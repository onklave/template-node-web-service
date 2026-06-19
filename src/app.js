import express from 'express';

const APP_NAME = process.env.APP_NAME || 'template-node-web-service';

/**
 * Build the Express application.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  app.get('/', (_req, res) => {
    res.json({ message: `Hello from ${APP_NAME}` });
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}

export default createApp;
