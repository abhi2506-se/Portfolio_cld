# Cloudflare Workers deployment (OpenNext)

## Dashboard build settings (Workers Builds)
| Setting | Value |
|---|---|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Root directory | repo root |
| Node.js version (build var) | `NODE_VERSION=22` |

* `wrangler` and `@opennextjs/cloudflare` are pinned devDependencies, so nothing is auto-installed and no setup wizard appears.
* `"name"` in `wrangler.jsonc` (and the `WORKER_SELF_REFERENCE` service) **must equal the Worker name in the dashboard**. Currently `portfolio` – change both if yours differs.
* The Worker bundle is ~5 MiB gzipped → **Workers Paid plan required** (Free limit is 3 MiB).

## Production variables / secrets (Dashboard → Settings → Variables and Secrets)
Add as **Secret** unless noted. Never put them in `wrangler.jsonc`, `.dev.vars` or git.

**Required for core site / admin**
- `DATABASE_URL` (Neon connection string, existing DB)
- `SESSION_SECRET` (code falls back to a hard-coded default if missing – always set it)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`
- `NEXT_PUBLIC_BASE_URL` = `https://www.theabhisheksingh.in` (Text; also set as *build* variable – `NEXT_PUBLIC_*` is inlined at build time)

**Email / notifications**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SALES_SMTP_*`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `*_EMAIL_FROM`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

**Storage / realtime**: `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**Portal / payments**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GOOGLE_TRANSLATE_API_KEY`

**AI / integrations (as used)**: `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GITHUB_TOKEN`, `GITHUB_USERNAME`, `GIPHY_API_KEY`, `METERED_APP_NAME`, `METERED_API_KEY`, `CALENDLY_*`, `ZOOM_*`, `AZURE_*`, `TEAMS_USER_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `CRON_SECRET`

The complete list is in `.dev.vars.example`.

## Local preview
```
cp .dev.vars.example .dev.vars   # use TEST values only; file is git-ignored
npm install
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview
```

## Known follow-ups (not changed by this fix)
1. `vercel.json` crons do not run on Cloudflare – add `triggers.crons` + a `scheduled` handler (or Cloudflare Cron → fetch the `/api/cron/*` routes with `CRON_SECRET`).
2. `proxy.ts` is the Next.js 16 convention; the project runs Next 15, so it is **not executed** (see `.next/server/middleware-manifest.json`). `/admin/dashboard` protection currently relies on page/API-level checks only.
3. SMTP via `nodemailer` uses raw TCP sockets; verify delivery on Workers (or switch to Resend/HTTP API).
4. `typescript.ignoreBuildErrors` is still `true` – 256 pre-existing type errors.
