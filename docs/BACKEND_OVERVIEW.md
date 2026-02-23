# Pillars Backend Overview

Last updated: 2026-02-23

## Executive Summary

Pillars uses a Node.js + Express backend deployed on Vercel serverless functions.

Firebase is the core backend platform:
- Firebase Auth for identity and token verification
- Cloud Firestore for app data
- Firebase Storage for uploaded files and OCR artifacts

The backend also integrates Anthropic, OpenAI, Twilio, Mistral OCR, and Upstash QStash for AI and async workflows.

## Runtime Architecture

### Entry Points
- Production/serverless entrypoint: `backend/api/index.js`
- Local dev entrypoint: `backend/src/index.js`

### Vercel Routing
- `backend/vercel.json` rewrites:
- `/api/title-worker` -> `/api/title-worker`
- `/(.*)` -> `/api`

### Middleware
- Security: `helmet`
- CORS: enabled globally
- Body parsing: JSON + URL-encoded
- Logging: `morgan` (non-production) + `pino`
- Rate limiting: `/api` is limited to 100 requests per 15 minutes per client key

## Auth Model

Primary auth uses Firebase ID tokens in `Authorization: Bearer <idToken>`.

- Verification middleware: `backend/src/middleware/auth.js`
- Role checks: `requireRole('admin')` for selected `users` endpoints
- Optional/worker helpers exist (`optionalAuth`, `workerAuth`, `verifyServiceToken`)

Important current behavior:
- Public and admin-write controls are mixed in some routes (especially onboarding content), so auth hardening is still a cleanup target.
- User-scoped routes can authenticate via user API keys (`x-api-key` or `Authorization: Bearer plr_*`) in addition to Firebase ID tokens.
- Internal service auth is also supported: `Authorization: Bearer <INTERNAL_SERVICE_SECRET>` plus `x-user-id: <firebaseUid>`.

## API Surface

Mounted route groups from `backend/src/index.js` and `backend/api/index.js`:

| Prefix | Purpose | Typical Auth |
|---|---|---|
| `/auth` | token verify/refresh/session/logout/password reset | mixed (some public, some token) |
| `/auth/phone` | phone OTP send/verify/resend | public |
| `/users` | profile + admin user operations + user API key lifecycle (`/users/api-key`) | token |
| `/api` | health/sample endpoints | mixed |
| `/api/pillars` | user pillar CRUD + stats | token, user API key, or internal service secret + `x-user-id` |
| `/api/pillar-templates` | pillar template library + template rubric CRUD | read: token/user API key/internal; write: Firebase admin claim (`role=admin`) or internal service secret bearer |
| `/api/pillar-visuals` | pillar icon/color token catalog CRUD | read: token/user API key/internal; write: Firebase admin claim (`role=admin`) or internal service secret bearer |
| `/api/principles` | user principle CRUD/assignment | token, user API key, or internal service secret + `x-user-id` |
| `/api/insights` | user insight CRUD/assignment | token, user API key, or internal service secret + `x-user-id` |
| `/api/conversations` | conversation CRUD + nested message writes | token |
| `/api/messages` | direct message CRUD by conversationId | token |
| `/api/ai` | Claude chat streaming + embedding endpoint | token for key actions |
| `/api/realtime` | OpenAI realtime session/token brokering + function proxy | token |
| `/api/attachments` | upload + OCR status/content endpoints | currently open |
| `/api/sms` | Twilio inbound webhook + status | webhook/public |
| `/api/coach-preferences` | coach preference read/write | token |
| `/api/cron` | scheduled trigger processing | cron secret/header |
| `/api/onboarding-content` | onboarding pillar/principle admin/content generation | currently open |
| `/api/skills` | hosted OpenClaw skill template + manifest | open |
| `/api/days` | day read + generation (Block System v1) | token, user API key, or internal service secret + `x-user-id` |
| `/api/days/:date/blocks` | day block CRUD + projected primitive write-through | token, user API key, or internal service secret + `x-user-id` |
| `/api/day-templates` | per-user day templates | token, user API key, or internal service secret + `x-user-id` |
| `/api/block-types` | user-scoped block type definitions (built-in + custom) | token, user API key, or internal service secret + `x-user-id` |
| `/api/schemas` | canonical machine-readable write schemas (`blockTypes`, `todoSchema`, `habitSchema`, `pillarSchema`, `daySchema`, `eventTypes`) | token, user API key, or internal service secret + `x-user-id` |
| `/api/context` | single-call aggregated context read (days + selected primitives) | token, user API key, or internal service secret + `x-user-id` |
| `/api/todos` | per-user Todo primitive (Todoist-style task API, optional `pillarId`) | token, user API key, or internal service secret + `x-user-id` |
| `/api/habits` | per-user Habit primitive + daily logs (optional `pillarId`) | token, user API key, or internal service secret + `x-user-id` |
| `/api/point-events` | user-scoped point event read/write/rollup | token, user API key, or internal service secret + `x-user-id` |
| `/api/test` | test/debug endpoints | mixed |

Block System v1 routes:
- `GET /api/block-types`
- `GET /api/schemas` (canonical write contracts for Step 2 agents)
- `GET /api/block-types/:id`
- `POST /api/block-types`
- `PUT /api/block-types/:id`
- `DELETE /api/block-types/:id` (custom only, `409` if instances exist)
- `POST /api/days/:date/blocks`
- `POST /api/days/:date/blocks/batch` (`mode=replace|append|merge`; supports surgical deletes via `deletes`; returns final day sections + `created/updated/deleted`)
- `GET /api/days/:date/blocks` (supports `sectionId`, `typeId`, `resolve=true`)
- `GET /api/days/:date/blocks/:blockId` (supports `resolve=true`)
- `PATCH /api/days/:date/blocks/:blockId` (deep merge on `data`; projected todo/habit writes through to primitives)
- `DELETE /api/days/:date/blocks/:blockId`
- `PATCH /api/days/:date/blocks/:blockId/move`
- `GET /api/days/today` and `GET /api/days/by-date/:date` return `200` with `exists:false` when a day has no persisted blocks (empty-day is not treated as an error)
- `POST /api/days/by-date/:date/generate` is disabled (`410 Gone`)
- Day-native default block types (`sleep`, `feeling`, `workout`, `reflection`) are disabled from write surfaces
- `POST /api/todos` supports optional `schedule: { date, sectionId, order }`, optional `rubricItemId`, optional `autoClassify:boolean`, and returns `{ todo, scheduled }` where `scheduled` includes deterministic projection id `proj_todo_<todoId>` when scheduled
- Todo bounty payouts are trigger-driven:
- iOS/clients write todo completion directly in Firestore.
- Firebase function `functions/src/todoBountyTrigger.js` reconciles `pointEvents` (`pe_todo_<todoId>`) and `todos.bountyPaidAt`.
- `POST /api/todos/:id/close|complete|reopen|incomplete` remains available for agents and state transitions, but payout side effects are eventual via trigger.
- Habit bounty payouts are trigger-driven:
- iOS/clients write habit logs directly in Firestore.
- Firebase function `functions/src/habitBountyTrigger.js` reconciles `pointEvents` (`pe_habit_<habitId>_<YYYY-MM-DD>`) from habit bounty settings.
- `PUT|POST /api/habits/:id/logs/:date` remains available for agents and status transitions, but payout side effects are eventual via trigger.
- `GET /api/context` (aggregates date-window Day payloads plus optional `todos`, `habits`, `pillars`, `principles`, `insights`)
- Context query supports:
- `days` (default `7`, max `30`) or explicit `fromDate` + `toDate` (inclusive, max span `30`)
- `include=todos,habits,pillars,principles,insights`
- `resolve=blockInheritance` (also accepts boolean-ish values: `true|1|yes|on`)
- `todoStatus=active|completed|all` (default `active`)
- `todoArchived=exclude|include|only` (default `exclude`)

Removed in hard cutover:
- `POST /api/days`
- `PUT /api/days/:id`
- `PUT /api/days/by-date/:date`
- `/api/custom-block-types` route group
- legacy by-type day block mutation endpoint

Day template scheduling:
- `dayTemplates.daysOfWeek` can optionally target weekdays (`sunday` ... `saturday`).
- Template-based day generation is disabled; defaults must be pushed explicitly via `POST /api/plan/by-date/:date`.

Pillar-linked primitive contract:
- `pillarId` is first-class and nullable on `todo`, `habit`, and Day-native `block` payloads.
- `POST /api/pillars` requires `pillarType` when `rubricItems` is omitted.
- `pillarType=custom` creates an empty rubric; non-custom `pillarType` copies active rubric defaults from `pillarTemplates`.
- Copied template rubric items are a snapshot at creation time (`metadata.templateSource`) and are never back-propagated from later template edits.
- Pillar visuals are token-only. Backend publishes selectable options (`id`, `label`, ordering, active flags, and icon `defaultColorToken`); clients render token values locally.
- `rubricItemId` is optional on `todo` and `habit`; when provided, backend resolves pillar + bounty points from the pillar rubric item.
- On todo/habit create, when `rubricItemId` is omitted, backend auto-classifies only when `source=clawdbot` or `autoClassify=true` (requires `pillarId`).
- `POST /api/point-events` accepts `rubricItemId` (plus optional `pillarId`) as an alternative to explicit allocations, and supports reason-driven classification when both `allocations` and `rubricItemId` are omitted.
- Validation is strict: provided `pillarId` must belong to the authenticated user, otherwise `400 Invalid pillarId`.
- Day projection mirrors primitive tags:
- projected todo block `pillarId` mirrors `todo.pillarId` (`proj_todo_<todoId>`)
- projected habit block `pillarId` mirrors `habit.pillarId` (`proj_habit_<habitId>`)
- Filtering:
- `GET /api/todos` supports:
- `status=active|completed|all` (default `active`)
- `dueDate=YYYY-MM-DD|none` (omit for any due date)
- `archived=exclude|include|only` (default `exclude`)
- `q=<search>` (content + description + labels, case-insensitive)
- `sectionId=morning|afternoon|evening`
- `parentId=none|any|all|<todoId>` (`none` default)
- `pillarId=<id>|none`
- `includeSubtasks=true|false` and `flat=true|false`
- legacy aliases: `search` for `q`, `includeArchived` for `archived`
- `GET /api/habits` supports:
- `status=active|inactive|all` (default `active`)
- `archived=exclude|include|only` (default `exclude`)
- `q=<search>` (name + description + target unit, case-insensitive)
- `sectionId=morning|afternoon|evening`
- `dayOfWeek=sunday..saturday`
- `pillarId=<id>|none`
- `groupId=<id>|none`
- legacy aliases: `active` for `status`, `search` for `q`, `includeArchived` for `archived`
- Habit groups:
- `GET /api/habits/groups`
- `POST /api/habits/groups`
- `PUT /api/habits/groups/:id`
- `DELETE /api/habits/groups/:id`

### Removed (2026-02-19)
- `/api/admin`
- `/api/admin-chat`
- `/api/admin-conversations`
- `/api/admin-streaming`
- `/api/agents`
- `/api/rooms`
- `/api/agent-drafts`

## Data Model (Firestore)

### Top-Level Collections
- `users`
- `sessions`
- `pillars`
- `pillarTemplates`
- `principles`
- `insights`
- `conversations`
- `onboardingPillars`
- `onboardingPrinciples`
- `coachPreferences`
- `dayBlocks`
- `blockTypes`
- `dayTemplates`
- `todos`
- `habits`
- `habitGroups`
- `habitLogs`
- `triggerTemplates`
- `nudgeHistory`
- `clarificationRequests`

### Subcollections
- `conversations/{conversationId}/messages`
- `users/{userId}/triggers`
- `projects/{projectId}/attachments` (upload/OCR pipeline)
- `pillars/{pillarId}/attachments` (used by Claude `read_file` tool context)

## AI and Streaming

### Anthropic (primary chat engine)
- Service: `backend/src/services/anthropic.js`
- Streaming orchestration: `backend/src/llm/claude/toolStreamRunner.js`
- SSE event manager: `backend/src/llm/claude/sseManager.js`

### Claude Tooling
- Tool registry for main user AI path currently centers on `read_file`
- Tool modules under `backend/src/llm/tools/`
- Reads OCR text from attachment documents and streams `tool_call` / `tool_result` events

### OpenAI Usage
- Embeddings (`text-embedding-3-small`)
- Realtime voice session token creation for client WebRTC
- Async conversation title generation task (`gpt-4o-mini`)

## Async and Scheduled Jobs

### QStash Worker
- Publisher: `backend/src/services/qstash.js`
- Worker endpoint: `backend/api/title-worker.js`
- Task logic: `backend/src/services/tasks/generateTitle.js`

### Cron
- Vercel cron schedule: every 15 minutes
- Target: `POST /api/cron/process-triggers`
- Trigger engine: `backend/src/services/triggers.js`
- Sends SMS nudges based on user trigger schedules and preferences

## External Integrations

- Firebase Admin SDK (Auth, Firestore, Storage)
- Anthropic API (chat + tool use)
- OpenAI API (embeddings + realtime + title generation)
- Twilio (SMS send + inbound webhook)
- Mistral OCR API (PDF OCR + image extraction)
- Upstash QStash (async task queue)
- Brave Search API (web search service; mock results when key missing)

## Environment Variables

Commonly used variables (from code):

- Core runtime:
- `NODE_ENV`, `PORT`, `LOG_LEVEL`

- Firebase:
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `FIREBASE_SERVICE_ACCOUNT`
- `FIREBASE_DATABASE_URL`, `FIREBASE_STORAGE_BUCKET`

- AI:
- `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`
- `OPENAI_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `MISTRAL_API_KEY`

- Messaging:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

- Async/scheduling:
- `QSTASH_TOKEN`, `QSTASH_URL`
- `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- `CRON_SECRET`
- `APP_URL`, `VERCEL_URL`, `WORKER_BASE_URL`

- Misc:
- `INTERNAL_SERVICE_SECRET`
- `TEST_PHONE_NUMBERS`, `TEST_VERIFICATION_CODE`

## Known Gaps and Cleanup Targets

Current codebase has a few inconsistencies worth tracking:

- `QStash` signature verification is intentionally bypassed in `backend/src/services/worker.js`.
- Legacy naming is mixed (`projectId` and `pillarId`) across attachment/tool flows.
- Some mounted endpoints reference models/symbols that are not defined in current model exports (for example `UserTask`, `Wisdom`, `Resource`, `OnboardingTheme` in some code paths).
- `backend/src/routes/thoughts.js` exists but is not mounted in the main app.

## Practical Summary

If you think of Pillars backend as layers:

1. Express route surface for app, AI, SMS, and scheduling workflows.
2. Firebase-centric persistence and auth foundation.
3. LLM orchestration layer (Anthropic-first, OpenAI for specific tasks).
4. Async execution via QStash + cron for non-blocking jobs.

That is the current backend architecture in code today.
