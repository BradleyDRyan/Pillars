# Pillars Admin Web

Next.js admin control plane for inspecting canonical API contracts from `GET /api/schemas`.

## Features

- Schema explorer for:
  - `blockTypes`
  - `todoSchema`
  - `habitSchema`
  - `daySchema`
  - `eventTypes`
- Step Flow Runner:
  - Enter API key in UI.
  - Run Step 1 (`GET /api/context`), Step 2 (`GET /api/schemas`), Step 3 demo write (`POST /api/todos`, `/api/habits`, `/api/days/:date/blocks/batch`).
  - Inspect full JSON responses per step.
- Copy JSON actions for direct agent prompting/testing.
- Optional HTTP Basic Auth guard on `/` and `/schemas`.

## Environment Variables

Create `admin-web/.env.local`:

```bash
PILLARS_API_BASE_URL=https://pillars-phi.vercel.app

# Option A: user-scoped API key auth
PILLARS_API_KEY=your_user_scoped_api_key

# Option B: internal service auth (requires both)
PILLARS_INTERNAL_SERVICE_SECRET=your_internal_service_secret
PILLARS_USER_ID=your_firebase_uid

# Optional local panel auth
ADMIN_PANEL_USER=admin
ADMIN_PANEL_PASSWORD=change-me
```

Notes:
- You must set either:
  - `PILLARS_API_KEY`, or
  - both `PILLARS_INTERNAL_SERVICE_SECRET` and `PILLARS_USER_ID`.
- `PILLARS_API_BASE_URL` defaults to production if omitted.
- If `ADMIN_PANEL_USER` or `ADMIN_PANEL_PASSWORD` is missing, middleware allows access without auth.

## Local Development

```bash
cd /Users/bradley/Documents/Pillars/admin-web
npm install
npm run dev
```

Open [http://localhost:3000/schemas](http://localhost:3000/schemas).

## Build and Verification

```bash
cd /Users/bradley/Documents/Pillars/admin-web
npm run lint
npm run build
```

## Deploy (Vercel)

Deploy this app as a separate Vercel project (recommended: `pillars-admin-web`) and set the env vars above in Vercel.
