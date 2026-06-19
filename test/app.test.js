import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';

/**
 * Boot the app on an ephemeral port and run a single request against it.
 */
function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const { port } = server.address();
      http
        .get({ host: '127.0.0.1', port, path }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            server.close();
            resolve({ status: res.statusCode, body });
          });
        })
        .on('error', (err) => {
          server.close();
          reject(err);
        });
    });
  });
}

test('GET /healthz returns 200 and { status: "ok" }', async () => {
  const res = await request(createApp(), '/healthz');
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { status: 'ok' });
});

test('GET / returns a greeting', async () => {
  const res = await request(createApp(), '/');
  assert.equal(res.status, 200);
  assert.ok(JSON.parse(res.body).message.length > 0);
});
