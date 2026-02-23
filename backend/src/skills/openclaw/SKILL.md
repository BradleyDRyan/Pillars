---
name: pillars_api
description: Use the user's Pillars API key to read and update their personal Pillars, primitives, and day blocks.
---

# Pillars API Skill

Use this skill when the user asks you to read or modify their Pillars app data.

## Auth

- Base URL: `https://pillars-phi.vercel.app`
- Required header for all calls: `x-api-key: <user_api_key>`
- The key is user-scoped. It should only access that user’s data.

## Core Endpoints

- Skills:
  - `GET /api/skills/openclaw/manifest.json`
  - `GET /api/skills/openclaw/SKILL.md`
- Canonical Schemas:
  - `GET /api/schemas` (full canonical contract snapshot, includes all schema sections)
  - `GET /api/schemas/block-types`
  - `GET /api/schemas/todos`
  - `GET /api/schemas/habits`
  - `GET /api/schemas/day`
  - `GET /api/schemas/plan`
  - `GET /api/schemas/pillars` (or `/api/schemas/pillar-icons`) for pillar icon enum values
  - `GET /api/schemas/point-events`
  - `GET /api/schemas/event-types`
- Pillars / Principles / Insights:
  - `GET|POST|PUT|DELETE /api/pillars*`
  - `GET|POST|PUT|DELETE /api/principles*`
  - `GET|POST|PUT|DELETE /api/insights*`
- Pillar templates:
  - `GET /api/pillar-templates?includeInactive=true|false`
  - `GET /api/pillar-templates/:pillarType`
  - Write routes under `/api/pillar-templates/*` require Firebase admin claim or internal service secret and are not generally available to user API keys.
- Pillar visuals:
  - `GET /api/pillar-visuals` (token catalog for icons/colors)
  - Write routes under `/api/pillar-visuals/*` require Firebase admin claim or internal service secret and are not generally available to user API keys.
  - Visual catalogs are token-only (`id`, `label`, `order`, `isActive`, icon `defaultColorToken`). Clients render token values locally.
- Block Types:
  - `GET /api/block-types`
  - `GET /api/block-types/:id`
  - `POST /api/block-types`
  - `PUT /api/block-types/:id`
  - `DELETE /api/block-types/:id` (custom only)
- Day Blocks:
  - `POST /api/days/:date/blocks`
  - `POST /api/days/:date/blocks/batch` (legacy/deprecated; prefer plan endpoint)
  - `GET /api/days/:date/blocks?resolve=true`
  - `GET /api/days/:date/blocks/:blockId?resolve=true`
  - `PATCH /api/days/:date/blocks/by-type/:typeId` (singleton upsert by type/date; deep-merge `data`; `409` for multi-instance or ambiguous matches)
  - `PATCH /api/days/:date/blocks/:blockId`
  - `DELETE /api/days/:date/blocks/:blockId`
  - `PATCH /api/days/:date/blocks/:blockId/move`
- Plan (preferred write surface for day construction/revision):
  - `POST /api/plan/by-date/:date`
  - Supports `Idempotency-Key` header (`Idempotency-Replayed: true` on replayed responses)
  - Request uses `primitives` (currently `todos.upsert`) plus `day.blocks` (day-native blocks and todo projections via `todoRef`)
- Day Generation:
  - `POST /api/days/by-date/:date/generate` is disabled (`410 Gone`). Day defaults must be added explicitly through `POST /api/plan/by-date/:date` day-native blocks.
- Context (single-call read):
  - `GET /api/context?days=7`
  - Supports: `days`, `fromDate`, `toDate`, `include=todos,habits,pillars,principles,insights` (unknown include tokens are ignored), `resolve=blockInheritance` (also `resolve=true|1|yes|on`), `todoStatus=active|completed|all`, `todoArchived=exclude|include|only`
- Todos:
  - `GET /api/todos` (supports `?status=active|completed|all`, `?dueDate=YYYY-MM-DD|none`, `?archived=exclude|include|only`, `?sectionId=morning|afternoon|evening`, `?parentId=none|any|all|<todoId>`, `?pillarId=<id>|none`, `?q=<search>`, `?includeSubtasks=true|false`, `?flat=true|false`; legacy aliases `search` and `includeArchived` still work)
  - `POST /api/todos` (supports optional `schedule: { date, sectionId, order }`, optional `rubricItemId`, and optional `autoClassify:boolean`; response includes `{ todo, scheduled }`)
  - `GET /api/todos/:id`
  - `PUT /api/todos/:id`
  - `PATCH /api/todos/:id`
  - `POST /api/todos/:id/close`
  - `POST /api/todos/:id/reopen`
  - `POST /api/todos/:id/archive`
  - `POST /api/todos/:id/unarchive`
  - `DELETE /api/todos/:id`
- Habits:
  - `GET /api/habits` (supports `?status=active|inactive|all`, `?archived=exclude|include|only`, `?q=<search>`, `?sectionId=morning|afternoon|evening`, `?dayOfWeek=sunday|monday|tuesday|wednesday|thursday|friday|saturday`, `?pillarId=<id>|none`; legacy aliases `active`, `search`, and `includeArchived` still work)
  - `POST /api/habits` (supports optional `rubricItemId` and optional `autoClassify:boolean`)
  - `GET /api/habits/:id`
  - `PUT /api/habits/:id`
  - `PATCH /api/habits/:id`
  - `POST /api/habits/:id/archive`
  - `POST /api/habits/:id/unarchive`
  - `DELETE /api/habits/:id`
  - `GET /api/habits/scheduled/:date`
  - `PUT /api/habits/:id/logs/:date`
- Pillar rubrics:
  - `GET /api/pillars/:id/rubric`
  - `POST /api/pillars/:id/rubric`
  - `PUT /api/pillars/:id/rubric/:rubricItemId`
  - `DELETE /api/pillars/:id/rubric/:rubricItemId`
- Point events:
  - `POST /api/point-events` supports explicit `allocations`, explicit `rubricItemId`, or reason-driven auto-classification when both are omitted.

## Block System v1 Notes

- Built-in type ids: `sleep`, `feeling`, `workout`, `reflection`, `habits`, `todo`.
- `sleep`, `feeling`, `workout`, and `reflection` are currently disabled for day-native writes.
- `resolve=true` should be used when reading day blocks for UX/assistant responses.
- Projection ids are virtual:
  - todo: `proj_todo_<todoId>`
  - habit: `proj_habit_<habitId>`
- Patching a projected block writes through to its primitive source.

## Operating Rules

- Confirm intent before destructive writes (`DELETE`, overwrite generation).
- Show endpoint + payload before making write calls.
- If API returns `400 Invalid pillarId`, fetch valid ids with `GET /api/pillars` and retry.
- If API returns `401` or `403`, ask user to regenerate/copy their API key from Profile.
