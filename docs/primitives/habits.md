# Habits Primitive Contract

Last updated: 2026-02-20

## Purpose
This document defines the current Habits primitive contract used by the Pillars backend and clients.

Use this when designing or implementing Habits features.

## Data Model
Habits are a primitive plus per-day log entries.

- `habits` collection:
  - Stores habit definitions and schedule metadata.
- `habitGroups` collection:
  - Stores user-defined habit grouping labels.
- `habitLogs` collection:
  - Stores daily completion/value/notes by `habitId + date`.

### Habit Record Shape
```json
{
  "id": "string",
  "userId": "string",
  "name": "string (1..200)",
  "description": "string",
  "sectionId": "morning|afternoon|evening",
  "schedule": {
    "type": "daily|weekly",
    "daysOfWeek": ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]
  },
  "target": {
    "type": "binary|count|duration",
    "value": "number (>0 in route validation)",
    "unit": "string|null"
  },
  "isActive": "boolean",
  "pillarId": "string|null",
  "groupId": "string|null",
  "groupName": "string|null",
  "createdAt": "unix-seconds",
  "updatedAt": "unix-seconds",
  "archivedAt": "unix-seconds|null"
}
```

### Habit Group Record Shape
```json
{
  "id": "string",
  "userId": "string",
  "name": "string (1..80)",
  "createdAt": "unix-seconds",
  "updatedAt": "unix-seconds",
  "archivedAt": "unix-seconds|null"
}
```

### Habit Log Record Shape
```json
{
  "id": "<habitId>_<YYYY-MM-DD>",
  "userId": "string",
  "habitId": "string",
  "date": "YYYY-MM-DD",
  "completed": "boolean",
  "value": "number|null (>=0)",
  "notes": "string",
  "createdAt": "unix-seconds|null",
  "updatedAt": "unix-seconds|null"
}
```

## API Surface
Habits endpoints:

- `GET /api/habits`
- `POST /api/habits`
- `GET /api/habits/:id`
- `PUT /api/habits/:id`
- `PATCH /api/habits/:id`
- `POST /api/habits/:id/archive`
- `POST /api/habits/:id/unarchive`
- `DELETE /api/habits/:id` (soft archive by default, hard delete with `?hard=true`)
- `GET /api/habits/groups`
- `POST /api/habits/groups`
- `PUT /api/habits/groups/:id`
- `DELETE /api/habits/groups/:id` (soft archive by default, hard delete with `?hard=true`)
- `GET /api/habits/scheduled/:date`
- `GET /api/habits/:id/logs/:date`
- `PUT /api/habits/:id/logs/:date`
- `POST /api/habits/:id/logs/:date/toggle`

Query behavior:

- `GET /api/habits` defaults to `status=active` and `archived=exclude`.
- Supported filters:
- `status=active|inactive|all` (legacy alias: `active=true|false`)
- `archived=exclude|include|only` (legacy alias: `includeArchived=true|false`)
- `q=<search>` (legacy alias: `search`) over name + description + target unit
- `sectionId=morning|afternoon|evening`
- `dayOfWeek=sunday..saturday`
- `pillarId=<id>|none`
- `groupId=<id>|none`

## Canonical Schema Source
Machine-readable schema is served by:

- `GET /api/schemas` -> `habitSchema`

`habitSchema` includes:

- `listQuery`
- `readQuery`
- `create`
- `update`
- `log`
- `createResponse`
- `updateResponse`

## Day Projection Contract
Habits project into Day block reads as virtual blocks.

- Projected id format: `proj_habit_<habitId>`
- Projected `typeId`: `habits`
- Projection source route: `GET /api/days/:date/blocks`

Projected block data keys:

- `habitId`
- `name`
- `completed`
- `value`
- `notes`
- `status` (`pending|completed`)

Important:

- Do not create direct day blocks with `typeId: habits`.
- Create the primitive via `/api/habits`.
- Day generation skips `habits` template entries because habits are projected.

## Projected Patch Contract
When patching `/api/days/:date/blocks/proj_habit_<habitId>`, supported fields are:

- Top-level: `sectionId`, `order`, `pillarId`, `title`, `data`
- `data` keys: `name`, `completed`, `value`, `notes`

Other projected habit fields are invalid contract.

## Change Checklist
When changing Habits behavior, update these together in the same change:

- `backend/src/routes/habits.js`
- `backend/src/routes/day-blocks.js`
- `backend/src/routes/schemas.js`
- `docs/AGENT_API_CONFIG.md`
- `docs/BACKEND_OVERVIEW.md`
- `firestore.indexes.json` (if query/index requirements changed)
