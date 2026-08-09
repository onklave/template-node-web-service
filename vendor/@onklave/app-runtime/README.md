# @onklave/app-runtime

Curated runtime SDK for apps built on the Onklave platform. Dependency-free
(Node built-ins only), Node 18+.

## Secrets

Fetches this pod's per-environment secrets from vault at startup and injects them
into `process.env`, zero-trust — nothing baked into the image, nothing in git.

```ts
import { injectOnklaveSecrets } from '@onklave/app-runtime';

// At the very top of your entrypoint, before reading any config:
await injectOnklaveSecrets();

// ...now process.env.DATABASE_URL etc. are populated.
```

Or get the map without touching `process.env`:

```ts
import { loadOnklaveSecrets } from '@onklave/app-runtime';
const secrets = await loadOnklaveSecrets({ injectIntoEnv: false });
```

### How it works

1. Reads the pod's **projected Kubernetes ServiceAccount token** (mounted by
   shipyard at `/var/run/secrets/onklave/vault/vault-token`, audience `vault`).
   Cluster-issued, auto-rotated — the pod's only credential.
2. Generates an ephemeral RSA key pair and asks vault for its
   `(org, project, env)` secrets, presenting the token as a Bearer.
3. Vault verifies the token, binds it to this pod's `(project, env)`, and returns
   the map **re-encrypted to the ephemeral public key**. Only this process can
   decrypt it. Plaintext never rests in a K8s Secret or in transit.

### Environment (set automatically by shipyard)

- `ONKLAVE_ORG_ID`, `ONKLAVE_PROJECT_ID`, `ONKLAVE_ENV` — the pod's identity.
- `ONKLAVE_VAULT_URL` — override vault's URL (defaults to the in-cluster service).
- `ONKLAVE_VAULT_TOKEN_PATH` — override the token mount path.

## Auth (App Identity)

The server side of `authMode: 'app-identity'`: the platform provisions this app
a dedicated end-user realm + confidential OIDC client, delivered as
per-environment secrets (`ONKLAVE_OIDC_ISSUER_URL` / `ONKLAVE_OIDC_CLIENT_ID` /
`ONKLAVE_OIDC_CLIENT_SECRET` — fetched by the secret lib above).

```ts
import { publicOidcConfig, verifyAccessToken } from '@onklave/app-runtime';

// Hand the browser its OIDC config (never the secret) — the SPA runs a
// standard authorization-code + PKCE flow; login/MFA/passkeys happen on the
// realm's hosted page, so the app never touches a password.
app.get('/auth/config', (_req, res) => res.json(publicOidcConfig()));

// Authenticate API requests:
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  try {
    const { sub, claims } = await verifyAccessToken(token, { audience: 'app' });
    req.user = { id: sub, claims };
    next();
  } catch {
    res.status(401).end();
  }
});
```

Verification is dependency-free: RS256 against the realm's JWKS (cached
10 min). Keep roles/permissions in your own tables keyed by the token's `sub` —
identity lives in the realm, authorization stays in the app.

## Comms (outbound email, SMS, WhatsApp)

Governed outbound messaging through the Onklave courier service. Senders are
platform-governed — for email your app only contributes an optional display
name (rendered as `"<fromName> via Onklave"`); SMS and WhatsApp send from the
platform's numbers. Sends are capped per environment per channel per day and
audited. One send key covers all channels.

```ts
import { sendOnklaveEmail } from '@onklave/app-runtime';

await sendOnklaveEmail({
  to: 'owner@example.com',
  subject: 'Your appointment reminder',
  text: 'See you tomorrow at 09:00.',
  html: '<p>See you tomorrow at <strong>09:00</strong>.</p>', // optional
  replyTo: 'reception@happypaws.example', // optional
  fromName: 'Happy Paws Vet', // optional
});
```

SMS and WhatsApp take an E.164 recipient and a plain-text body (SMS: max 1600
chars; WhatsApp: max 4096, text-only — template messages are future work):

```ts
import { sendOnklaveSms, sendOnklaveWhatsapp } from '@onklave/app-runtime';

await sendOnklaveSms({
  to: '+27821234567',
  body: 'Reminder: Rex is due for his booster tomorrow at 09:00.',
});

await sendOnklaveWhatsapp({
  to: '+27821234567',
  body: 'Your invoice is ready. Reply here with any questions.',
});
```

All three throw with the response detail on any non-2xx (429 at the channel's
daily cap; 503 while that channel is not yet activated on the platform).

### Environment (set automatically by the platform)

- `ONKLAVE_COURIER_KEY` — this app's per-environment send key (an app-secret,
  injected by the secret lib at startup).
- `ONKLAVE_COURIER_URL` — override the courier base URL (defaults to
  `https://courier.onklave.app`).

## Storage (durable objects)

Durable object storage for uploads, documents and generated files — never the
local filesystem (the container is replaced on every deploy). Objects are
scoped to this app's (project, environment), encrypted per organisation, and
capped per object and per environment. Reads `ONKLAVE_STORAGE_KEY` (+ optional
`ONKLAVE_STORAGE_URL`), provisioned per environment.

```ts
import { putObject, getObject, listObjects, deleteObject } from '@onklave/app-runtime';

await putObject('invoices/2026/inv-001.pdf', pdfBytes, {
  contentType: 'application/pdf',
});
const { bytes, contentType } = await getObject('invoices/2026/inv-001.pdf');
const page = await listObjects({ prefix: 'invoices/2026/' });
await deleteObject('invoices/2026/inv-001.pdf');

// Shareable, time-boxed public link (default 15 min, max 24 h) — for emailing
// certificates, portal downloads, etc. Treat the URL like the bytes.
const { url, expiresAt } = await getSignedUrl('invoices/2026/inv-001.pdf', {
  ttlSeconds: 3600,
});
```

> Status: vendored into greenfield repos at project creation
> (`vendor/@onklave/app-runtime`, `file:` dep). Live end-to-end validation of
> the secret fetch is pending.

## AI (governed model access)

Governed AI through the Onklave AI gateway. Your app never holds a raw AI
provider key — it calls the gateway with its per-environment key
(`ONKLAVE_AI_KEY`) and the gateway proxies the Anthropic Messages API using
your organisation's BYO credential (configured under AI credentials). A model
allowlist, output-token cap and per-environment daily cap apply, and every
call is audited (metadata only — message content is never stored). Streaming
is not yet supported.

```ts
import { createOnklaveAiMessage, aiText } from '@onklave/app-runtime';

const message = await createOnklaveAiMessage({
  model: 'claude-haiku-4-5', // optional, default claude-opus-5
  maxTokens: 1024, // optional, default 4096
  system: 'You summarise veterinary visit notes.', // optional
  messages: [{ role: 'user', content: 'Summarise: Rex, 4y, vaccinated...' }],
});
console.log(aiText(message)); // concatenated text blocks
```

Throws with the response detail on any non-2xx (424 while the organisation has
no Anthropic credential configured; 429 at the daily cap; 503 while the AI
gateway is not yet activated on the platform; 501 for streaming).

### Environment (set automatically by the platform)

- `ONKLAVE_AI_KEY` — this app's per-environment AI gateway key (an app-secret,
  injected by the secret lib at startup).
- `ONKLAVE_AI_URL` — override the gateway base URL (defaults to
  `https://ai.onklave.app`).
