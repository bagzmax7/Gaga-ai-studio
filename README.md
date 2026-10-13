# Gaga AI Studio

Internal image and video generation workspace built with Next.js App Router, Supabase, RunningHub, GitHub, and Vercel. BytePlus generation models are intentionally excluded.

## Local setup

1. Install Node.js 20+ and npm.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the project settings.
4. Run `supabase/migrations/001_gaga_studio.sql` in the Supabase SQL Editor, or link the repository to the Gaga project and apply it with Supabase CLI migrations.
5. Set `GAGA_BOOTSTRAP_ADMIN_EMAIL`, `GAGA_BOOTSTRAP_ADMIN_PASSWORD`, and `GAGA_BOOTSTRAP_ADMIN_NAME` in local `.env.local`, then run `npm run admin:provision` to create/update its Supabase Auth account and Gaga profile.
6. `GAGA_ADMIN_EMAILS` supports comma-separated bootstrap admin overrides, and should contain only trusted admin accounts.
7. Run `npm run dev` and open http://localhost:3000.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: URL for the existing Supabase project/account used with Metaverz. Gaga uses its own `gaga_*` tables and does not use Metaverz organizations, wallets, billing or application tables.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon/publishable key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key. Never prefix this with `NEXT_PUBLIC_` or commit it.
- `RUNNINGHUB_API_KEY`, `RUNNINGHUB_BASE_URL`, `RUNNINGHUB_STANDARD_API_BASE_URL`: RunningHub server integration values from the Metaverz provider configuration.
- `GAGA_ADMIN_EMAILS`: bootstrap admin email(s), separated by commas.
- `APP_SECRET`: reserve a unique random secret for Gaga session/integration features; do not reuse the Metaverz app secret.
- `GAGA_BOOTSTRAP_ADMIN_*`: local one-time user provisioning values. Keep out of Vercel and source control; remove them from local configuration after provisioning.

Never copy Stripe secrets, payment keys, wallet/pricing configuration, or Metaverz production database credentials into the Gaga environment. Billing is usage reporting only in this internal studio; the UI currently does not deduct a wallet balance.

## Image/video model behavior

- Image: RunningHub Standard Model API, image task status via `/openapi/v2/query`.
- Video: Boutiqaat Flow-compatible RunningHub Standard Video API using model-specific endpoint paths and payloads; task status via `/openapi/v2/query`.
- Generation endpoints require a valid Supabase user token and persist task ownership to `gaga_tasks`.

The image/video integration and task record are in place. Confirm each selected model is enabled for the shared RunningHub API key before using paid generation.

## GitHub and Vercel

1. Create an empty private GitHub repository for Gaga AI Studio.
2. Push this project to that repository.
3. Import the repository into Vercel; framework detection should select Next.js automatically.
4. Add the required environment variables in Vercel Project Settings for Preview and Production environments.
5. Apply the SQL migration to the intended Supabase project before inviting team members.
6. Deploy through the GitHub-to-Vercel integration. Do not add `.env.local` to the repository.

## Commands

- `npm run dev` — local development (uses the local Windows TLS workaround required by the current Supabase certificate chain)
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm start` — serve a production build
