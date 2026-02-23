# Agent API Config (Production)

Last updated: 2026-02-23

Use this for external agents (not local dev).

```json
{
  "name": "pillars-api",
  "baseUrl": "https://pillars-phi.vercel.app",
  "auth": {
    "type": "user-api-key",
    "headers": {
      "x-api-key": "${PILLARS_USER_API_KEY}",
      "Content-Type": "application/json"
    }
  },
  "endpoints": {
    "health": {
      "status": "GET /api/status"
    },
    "skills": {
      "manifest": "GET /api/skills/openclaw/manifest.json",
      "skillFile": "GET /api/skills/openclaw/SKILL.md"
    },
    "schemas": {
      "canonical": "GET /api/schemas"
    },
    "pillars": {
      "list": "GET /api/pillars",
      "get": "GET /api/pillars/:id",
      "create": "POST /api/pillars",
      "update": "PUT /api/pillars/:id",
      "rubricGet": "GET /api/pillars/:id/rubric",
      "rubricAdd": "POST /api/pillars/:id/rubric",
      "rubricUpdate": "PUT /api/pillars/:id/rubric/:rubricItemId",
      "rubricDelete": "DELETE /api/pillars/:id/rubric/:rubricItemId",
      "delete": "DELETE /api/pillars/:id"
    },
    "pillarTemplates": {
      "list": "GET /api/pillar-templates?includeInactive=true|false",
      "get": "GET /api/pillar-templates/:pillarType",
      "create": "POST /api/pillar-templates (admin claim or internal secret)",
      "update": "PATCH /api/pillar-templates/:pillarType (admin claim or internal secret)",
      "deactivate": "DELETE /api/pillar-templates/:pillarType (soft delete)",
      "restore": "POST /api/pillar-templates/:pillarType/restore",
      "rubricAdd": "POST /api/pillar-templates/:pillarType/rubric",
      "rubricUpdate": "PATCH /api/pillar-templates/:pillarType/rubric/:rubricItemId (label/points)",
      "rubricDelete": "DELETE /api/pillar-templates/:pillarType/rubric/:rubricItemId"
    },
    "pillarVisuals": {
      "list": "GET /api/pillar-visuals",
      "replace": "PUT /api/pillar-visuals (admin claim or internal secret)",
      "colorsCreate": "POST /api/pillar-visuals/colors (admin claim or internal secret)",
      "colorsUpdate": "PATCH /api/pillar-visuals/colors/:colorId (admin claim or internal secret)",
      "colorsDelete": "DELETE /api/pillar-visuals/colors/:colorId (admin claim or internal secret)",
      "iconsCreate": "POST /api/pillar-visuals/icons (admin claim or internal secret)",
      "iconsUpdate": "PATCH /api/pillar-visuals/icons/:iconId (admin claim or internal secret)",
      "iconsDelete": "DELETE /api/pillar-visuals/icons/:iconId (admin claim or internal secret)"
    },
    "principles": {
      "list": "GET /api/principles",
      "get": "GET /api/principles/:id",
      "create": "POST /api/principles",
      "update": "PUT /api/principles/:id",
      "delete": "DELETE /api/principles/:id"
    },
    "insights": {
      "list": "GET /api/insights",
      "get": "GET /api/insights/:id",
      "create": "POST /api/insights",
      "update": "PUT /api/insights/:id",
      "delete": "DELETE /api/insights/:id"
    },
    "blockTypes": {
      "list": "GET /api/block-types",
      "get": "GET /api/block-types/:id",
      "create": "POST /api/block-types",
      "update": "PUT /api/block-types/:id",
      "delete": "DELETE /api/block-types/:id"
    },
    "dayBlocks": {
      "create": "POST /api/days/:date/blocks",
      "batch": "POST /api/days/:date/blocks/batch (body: { blocks?: [...], deletes?: [\"blockId\" | { \"blockId\": \"...\" }], mode: replace|append|merge }; at least one of blocks/deletes required; delete-only defaults to merge)",
      "list": "GET /api/days/:date/blocks?resolve=true",
      "get": "GET /api/days/:date/blocks/:blockId?resolve=true",
      "upsertByType": "PATCH /api/days/:date/blocks/by-type/:typeId (singleton upsert; deep-merge data; creates in type default section when missing; sleep/feeling/workout/reflection disabled)",
      "update": "PATCH /api/days/:date/blocks/:blockId",
      "delete": "DELETE /api/days/:date/blocks/:blockId",
      "move": "PATCH /api/days/:date/blocks/:blockId/move"
    },
    "days": {
      "today": "GET /api/days/today?date=YYYY-MM-DD (returns 200 with exists:false when the day has no saved blocks)",
      "byDate": "GET /api/days/by-date/:date (returns 200 with exists:false when the day has no saved blocks)",
      "generateByDate": "POST /api/days/by-date/:date/generate (disabled; returns 410)"
    },
    "context": {
      "get": "GET /api/context?days=7&include=todos,habits,pillars,principles",
      "range": "GET /api/context?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD",
      "resolve": "GET /api/context?resolve=blockInheritance (also accepts resolve=true|1|yes|on)",
      "todoStatus": "todoStatus supports active|completed|all (default active)"
    },
    "todos": {
      "list": "GET /api/todos (filters: status=active|completed|all; dueDate=YYYY-MM-DD|none; archived=exclude|include|only; q=<search>; sectionId=morning|afternoon|evening; parentId=none|any|all|<todoId>; pillarId=<id>|none where pillarId matches any bounty allocation; includeSubtasks=true|false; flat=true|false; legacy aliases: search, includeArchived)",
      "create": "POST /api/todos (assignment-driven: assignment.mode=auto|manual, manual requires assignment.pillarIds; optional schedule:{date,sectionId,order}; response includes {todo,scheduled,classificationSummary})",
      "get": "GET /api/todos/:id",
      "update": "PUT /api/todos/:id and PATCH /api/todos/:id (supports assignment.mode=auto|manual for retag/reclassify; response may include classificationSummary)",
      "delete": "DELETE /api/todos/:id",
      "close": "POST /api/todos/:id/close (todo status mutation; bounty payout side effects are trigger-driven)",
      "reopen": "POST /api/todos/:id/reopen (todo status mutation; bounty reversal side effects are trigger-driven)",
      "subtasksList": "GET /api/todos/:id/subtasks (supports archived=exclude|include|only; includeArchived legacy alias)",
      "subtasksCreate": "POST /api/todos/:id/subtasks (optional pillarId)"
    },
    "habits": {
      "list": "GET /api/habits (filters: status=active|inactive|all; archived=exclude|include|only; q=<search>; sectionId=morning|afternoon|evening; dayOfWeek=sunday..saturday; pillarId=<id>|none; groupId=<id>|none; legacy aliases: active, search, includeArchived)",
      "create": "POST /api/habits (optional pillarId, optional rubricItemId, optional autoClassify:boolean, optional groupId, optional bountyPoints/bountyAllocations)",
      "get": "GET /api/habits/:id",
      "update": "PUT|PATCH /api/habits/:id (optional pillarId, optional rubricItemId, optional groupId, optional bountyPoints/bountyAllocations; response includes {habit})",
      "archive": "POST /api/habits/:id/archive",
      "unarchive": "POST /api/habits/:id/unarchive",
      "delete": "DELETE /api/habits/:id",
      "groupsList": "GET /api/habits/groups",
      "groupsCreate": "POST /api/habits/groups",
      "groupsUpdate": "PUT /api/habits/groups/:id",
      "groupsDelete": "DELETE /api/habits/groups/:id",
      "scheduled": "GET /api/habits/scheduled/:date",
      "logGet": "GET /api/habits/:id/logs/:date",
      "logUpsert": "PUT /api/habits/:id/logs/:date",
      "logToggle": "POST /api/habits/:id/logs/:date/toggle"
    },
    "dayTemplates": {
      "list": "GET /api/day-templates",
      "default": "GET /api/day-templates/default",
      "create": "POST /api/day-templates",
      "update": "PUT /api/day-templates/:id"
    }
  },
  "removedEndpoints": [
    "/api/custom-block-types",
    "POST /api/days",
    "PUT /api/days/:id",
    "PUT /api/days/by-date/:date",
    "/api/admin",
    "/api/admin-chat",
    "/api/admin-conversations",
    "/api/admin-streaming",
    "/api/agents",
    "/api/rooms",
    "/api/agent-drafts"
  ]
}
```

## Todo Bounty Payout

- Todo bounty payout is reconciled by Firestore trigger `functions/src/todoBountyTrigger.js`.
- Point events use deterministic ids: `pe_todo_<todoId>`.
- On completion, trigger upserts/unvoids payout event and sets `todos.bountyPaidAt`.
- On incompletion or invalid/removed bounty, trigger voids payout event and clears `todos.bountyPaidAt`.
- Agent-facing todo close/reopen endpoints remain valid, but payout is eventual-consistent via trigger.

## Habit Bounty Payout

- Habit bounty payout is reconciled by Firestore trigger `functions/src/habitBountyTrigger.js`.
- Point events use deterministic ids per day: `pe_habit_<habitId>_<YYYY-MM-DD>`.
- On habit log completion (`status=completed`), trigger upserts/unvoids payout event from habit bounty settings.
- On habit log incompletion (`status=pending|skipped`), trigger voids that day’s payout event.
- Agent-facing habit log endpoints remain valid, but payout side effects are eventual-consistent via trigger.

## Key Provisioning

- In-app path: `Profile -> API Access -> Generate API Key -> Copy API Key`
- OpenClaw helper path: `Profile -> API Access -> Copy OpenClaw Setup`
- Backend endpoints (authenticated user):
  - `GET /users/api-key` (metadata only)
  - `POST /users/api-key` (create/rotate and return plaintext key once)
  - `DELETE /users/api-key` (revoke)
- Hosted skill files (public):
  - `GET /api/skills/openclaw/manifest.json`
  - `GET /api/skills/openclaw/SKILL.md`

## Pillar Tagging Contract

- `pillarId` is optional/nullable on habits and Day-native blocks; todos are allocation-first for pillar semantics.
- `rubricItemId` is optional on `todo` and `habit` mutations.
- For `POST /api/pillars`, when `rubricItems` is omitted, `pillarType` is required.
- `pillarType=custom` creates with an empty rubric; non-custom types copy active defaults from `/api/pillar-templates`.
- Pillar visuals are token-only: use `colorToken` and `icon` tokens. `hex`, `systemName`, and `customColorHex` are not accepted on visual catalog writes.
- Copied rubric defaults are a snapshot at pillar creation time and do not retroactively update existing pillars.
- When `rubricItemId` is provided, backend resolves its owning pillar and auto-sets bounty points from rubric.
- When `rubricItemId` is omitted on create, backend auto-classifies only when `source=clawdbot` or `autoClassify=true` (requires `pillarId`).
- Projected ids are virtual:
  - todo projection: `proj_todo_<todoId>`
  - habit projection: `proj_habit_<habitId>`
- Projected block `pillarId` mirrors primitive `pillarId` and cannot diverge.
- Ownership validation is strict: foreign/unknown `pillarId` returns `400 Invalid pillarId`.

## Ad Hoc Scoring Contract

- `POST /api/point-events` supports either:
- explicit `allocations`, or
- `rubricItemId` (optional `pillarId` for disambiguation), which auto-derives allocation points from the matched pillar rubric item, or
- reason-driven classification when both `allocations` and `rubricItemId` are omitted (scoped by optional `pillarId`, otherwise across all pillars).

## Quick Smoke Test

```bash
curl "https://pillars-phi.vercel.app/api/context?days=7&include=todos,habits,pillars,principles&resolve=blockInheritance" \
  -H "x-api-key: $PILLARS_USER_API_KEY"
```
