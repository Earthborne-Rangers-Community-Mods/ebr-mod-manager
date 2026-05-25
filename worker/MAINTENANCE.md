# Cloudflare Worker Maintenance - `ebr-mod-proxy`

This worker proxies GitHub zipball downloads to bypass CORS. Deployed at `https://ebr-mod-proxy.ebr-mods.workers.dev`.

---

## Secrets

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Fine-grained PAT for GitHub API calls (zipball downloads). Must have read access to all public repos. |

## Rotate the GitHub PAT

1. Create a new fine-grained PAT at <https://github.com/settings/personal-access-tokens/new>.
   - Token name: something like `ebr-mod-proxy-worker`
   - Expiration: set a reminder for before it expires
   - Repository access: **All public repositories** (the worker downloads from forks owned by other users, not just your repos)
   - Permissions: Contents -> Read-only
2. From this directory (`worker/`), run:
   ```
   npx wrangler secret put GITHUB_TOKEN
   ```
   Paste the new token when prompted. The secret is encrypted at rest and injected at runtime.
3. Verify the worker still works:
   ```
   curl -o test.zip -w "%{http_code}" https://ebr-mod-proxy.ebr-mods.workers.dev/repos/SunberryKeeper/ebr-mod-base-content/zipball/62c25940e2471dfc0a27782dd39b29de81dd8330
   ```
   Should return 200 and write a valid zip. A 401/403 means the new token is wrong.
   A 404 means the path failed validation.
4. Revoke the old PAT at <https://github.com/settings/tokens>.

---

## Deploy the Worker

From this directory (`worker/`):

```
npx wrangler deploy
```

This publishes the current `src/index.ts` to the `ebr-mod-proxy` worker. Secrets are not affected by deploys - they persist independently.

---

## Local Development

From this directory (`worker/`):

```
npx wrangler dev --port 8787
```

Note: `wrangler dev` does NOT inject production secrets. You need a `.dev.vars` file in this directory:

```
GITHUB_TOKEN=ghp_your_dev_token_here
```

`.dev.vars` is gitignored. Never commit it.

---

## Check Worker Status

```
npx wrangler tail
```

Streams live request logs from the deployed worker. Useful for debugging 4xx/5xx responses.

---

## Configuration Reference

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Worker name, entry point, env vars |
| `src/index.ts` | Worker source code |
| `.dev.vars` | Local-only secrets (gitignored) |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| 401 from GitHub | PAT expired or revoked. Rotate it (see above). |
| 403 from GitHub | PAT lacks read access to the target repo, or rate limit hit. |
| CORS error in browser | `ALLOWED_ORIGIN` does not match the requesting origin. |
| Worker returns 500 | Check `wrangler tail` for the error. Usually a code bug or missing secret. |
| `wrangler secret put` fails | Make sure you are authenticated (`wrangler login`) and have access to the account that owns the worker. |
