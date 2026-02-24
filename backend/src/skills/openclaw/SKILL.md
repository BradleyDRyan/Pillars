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
  - `GET /api/schemas/actions`
  - `GET /api/schemas/action-templates`
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
- Actions:
  - `GET /api/actions/by-date/:date?ensure=true|false&status=pending|completed|skipped|canceled|all&sectionId=morning|afternoon|evening`
  - `POST /api/actions` (classifier assigns bounties when `bounties` is omitted)
  - `GET /api/actions/:id`
  - `PATCH /api/actions/:id`
  - `DELETE /api/actions/:id` (soft archive)
- Action Templates:
  - `GET /api/action-templates`
  - `POST /api/action-templates` (classifier assigns defaultBounties when omitted)
  - `PATCH /api/action-templates/:id`
  - `DELETE /api/action-templates/:id` (soft archive)
- Context (single-call read):
  - `GET /api/context?days=7`
  - Supports: `days`, `fromDate`, `toDate`, `include=todos,habits,pillars,principles,insights` (unknown include tokens are ignored), `resolve=blockInheritance` (also `resolve=true|1|yes|on`), `todoStatus=active|completed|all`, `todoArchived=exclude|include|only`
- Pillar rubrics:
  - `GET /api/pillars/:id/rubric`
  - `POST /api/pillars/:id/rubric`
  - `PUT /api/pillars/:id/rubric/:rubricItemId`
  - `DELETE /api/pillars/:id/rubric/:rubricItemId`
- Point events:
  - `POST /api/point-events` supports explicit `allocations`, explicit `rubricItemId`, or reason-driven auto-classification when both are omitted.

## Action-First Notes

- Action is the canonical primitive.
- ActionTemplate exists only to generate recurring actions.
- Legacy todo/habit/day-block/day-template/block-type execution endpoints were hard-cut from the API write path.

## Operating Rules

- Confirm intent before destructive writes (`DELETE`, overwrite generation).
- Show endpoint + payload before making write calls.
- If API returns `400 Invalid pillarId`, fetch valid ids with `GET /api/pillars` and retry.
- If API returns `401` or `403`, ask user to regenerate/copy their API key from Profile.
