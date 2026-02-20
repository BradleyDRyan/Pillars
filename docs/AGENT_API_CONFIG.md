# Agent API Config (Production)

Last updated: 2026-02-20

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
      "delete": "DELETE /api/pillars/:id"
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
      "list": "GET /api/todos (filters: status=active|completed|all; dueDate=YYYY-MM-DD|none; archived=exclude|include|only; q=<search>; sectionId=morning|afternoon|evening; parentId=none|any|all|<todoId>; pillarId=<id>|none; includeSubtasks=true|false; flat=true|false; legacy aliases: search, includeArchived)",
      "create": "POST /api/todos (optional pillarId, optional schedule:{date,sectionId,order}; response includes {todo,scheduled})",
      "get": "GET /api/todos/:id",
      "update": "PUT /api/todos/:id (optional pillarId)",
      "delete": "DELETE /api/todos/:id",
      "close": "POST /api/todos/:id/close",
      "reopen": "POST /api/todos/:id/reopen",
      "subtasksList": "GET /api/todos/:id/subtasks (supports archived=exclude|include|only; includeArchived legacy alias)",
      "subtasksCreate": "POST /api/todos/:id/subtasks (optional pillarId)"
    },
    "habits": {
      "list": "GET /api/habits (supports ?pillarId=<id> and ?pillarId=none)",
      "create": "POST /api/habits (optional pillarId)",
      "get": "GET /api/habits/:id",
      "update": "PUT /api/habits/:id (optional pillarId)",
      "delete": "DELETE /api/habits/:id",
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

- `pillarId` is optional and nullable on `todo`, `habit`, and Day-native `block` payloads.
- Projected ids are virtual:
  - todo projection: `proj_todo_<todoId>`
  - habit projection: `proj_habit_<habitId>`
- Projected block `pillarId` mirrors primitive `pillarId` and cannot diverge.
- Ownership validation is strict: foreign/unknown `pillarId` returns `400 Invalid pillarId`.

## Quick Smoke Test

```bash
curl "https://pillars-phi.vercel.app/api/context?days=7&include=todos,habits,pillars,principles&resolve=blockInheritance" \
  -H "x-api-key: $PILLARS_USER_API_KEY"
```
