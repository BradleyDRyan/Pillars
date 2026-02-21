# AGENTS

## Product Vision (Canonical)
Pillars is built on two core primitives:

1. Days
- Composed of Blocks.
- Days are structured daily records.
- Blocks are the core primitives of Days.

2. Pillars
- Composed of Principles.
- Pillars represent the key areas of life that matter, and Principles define how to live them.

### Block Model
- Built-in blocks are opinionated, high-frequency defaults with tailored native UI.
- Custom blocks are API-defined block types that render dynamically in app.
- Claudebot can create and update custom block types through API contracts.

### Input Model
- User input: direct in-app interactions (fast manual updates).
- Claudebot input: API-driven updates (expected majority of writes).
- Both paths write to the same user-scoped backend source of truth.

### Write Path Rules (Canonical)
- External agents: API-first. Treat backend API contracts as the primary write path for agent-driven state changes.
- iOS app: Firebase-first. Default to direct Firebase SDK reads/writes for app-native primitive interactions.
- Use backend API from iOS only when server-only behavior is required (for example privileged validation, server orchestration, or non-Firebase integrations).

Design features in this order:
1. User outcome
2. Data model contract
3. API contract
4. Client implementation

## Prelaunch Data Policy (Canonical)
Pillars is currently prelaunch. Treat all existing app data as non-production test data.

- Assume data can be reset or replaced during active development.
- Default to evolving schemas/contracts directly instead of adding migration frameworks.
- Do not add backward-compatibility layers, legacy adapters, or long-term support code for fake/test data unless explicitly requested for a concrete need.
- If a one-off data fix is required, prefer a targeted script/runbook over permanent migration infrastructure.
- Revisit and formalize migration/versioning strategy when preparing for production launch.

## Schema Sync Policy (Canonical)
If a backend change impacts request/response shape, field names/types, validation rules, or endpoint contracts, update canonical schema artifacts in the same change.

- Do not merge backend schema changes without corresponding schema updates.
- Keep schema consumers in sync in the same PR (for example `/api/schemas` outputs and typed schema clients such as `admin-web/src/lib/schemas.ts`).
- Update schema-producing sources when changed (for example `backend/src/routes/schemas.js`).
- If a top-level `/schema` directory is added, treat it as canonical and keep it in sync.
- Call out the schema update explicitly in the final status/PR notes.

## CPO Status Updates (Canonical)
Agents will often be asked to provide status updates intended for CPO `JJ` and forwarding to others.

- Write updates as forward-ready messages (no agent/tool chatter, no terminal transcript style).
- Lead with outcome and status: `done`, `in progress`, or `blocked`.
- Include only the essentials:
1. What changed (scope shipped or validated).
2. Current impact (user/product effect).
3. Risks or blockers (if any).
4. Next steps with owner and concrete ETA/date.
- Use concrete environment and date language (`production`, `staging`, `YYYY-MM-DD`) instead of relative terms like "today" or "soon".
- If blocked, end with a single explicit unblock request.
- Keep it concise enough that JJ can forward it without editing.

## Design System (Canonical UI Rules)
Always use the design system for UI work.
- Any new UI, UI refactor, or visual adjustment MUST use DS tokens/components first.
- Do not ship ad-hoc UI styling. If a needed style is missing, add it to the design system in the same change, then consume it from the feature.

### Source of Truth Files
- Global tokens/components: `Pillars/Pillars/DesignSystem/DesignSystem.swift`
- My Day tokens/components: `Pillars/Pillars/DesignSystem/MyDayDesignSystem.swift`

### Color Rules
- Use semantic tokens from `S2.Colors` and feature-level tokens from `S2.MyDay.Colors`.
- Do not hardcode `UIColor` or raw SwiftUI color literals inside feature views unless there is no DS token and you add one in the same change.
- Prefer semantic names (`titleText`, `subtitleText`, `divider`, etc.) over visual names.

### Typography Rules
- Use DS typography tokens (`Font.squirrel*`, `S2.MyDay.Typography.*`) for all text.
- Avoid raw `.font(.system(...))` for text content.
- Exception: icon glyph sizing is allowed with `.font(.system(size: ...))`.

### Spacing Rules
- Use interval-based spacing from `S2.MyDay.Spacing`.
- `spacing2` is the base unit control and defaults to `2`.
- Build spacing with `S2.MyDay.Spacing.i(n)` and named tokens (`rowVertical`, `rowHorizontal`, `sectionGap`, etc.).
- Do not add new hardcoded spacing numbers in views; add/update a spacing token instead.
- Compact mode support should be implemented by adjusting `spacing2` (for example `1.5`) rather than rewriting layouts.

### Components and Composition Rules
- Prefer reusable DS components/modifiers over repeated local view styling.
- Reuse existing primitives first (`S2Button`, `S2ScreenHeaderView`, My Day modifiers/components).
- When repeated style appears 2+ times, extract a DS token/component/modifier in the same PR.
- Keep visual hierarchy minimal by default; add extra containers/chrome only when it improves clarity.

### Icon Rules
- Use SF Symbols.
- For list/row icons, prefer lightweight styling: no background container unless explicitly needed.
- Use multitone/hierarchical rendering when the UI direction calls for minimal icon treatment.

### PR / Change Expectations for UI Work
For UI changes, include:
1. Which DS tokens/components were reused.
2. Which new tokens/components were added (if any) and why.
3. Confirmation that hardcoded color/type/spacing values were avoided or intentionally justified.

## Firestore Composite Index Policy
When Firestore returns `FAILED_PRECONDITION` or `query requires an index`, do not leave it unresolved.

- Canonical index spec file: `firestore.indexes.json` (configured by `firebase.json`).
- Add/update the required composite index in `firestore.indexes.json` in the same change that introduces or changes the query.
- Include Firebase CLI index deploy commands in task notes or PR description.

Run from repo root:
```bash
firebase use <project-id>
firebase deploy --only firestore:indexes
```

## Vercel Deployment + Agent Target
External agents must not call `localhost`. Use production API.

- Production base URL: `https://pillars-phi.vercel.app`
- Vercel scope: `bradleyryan15-gmailcoms-projects`
- Vercel project: `pillars`
- Backend working directory for deploys: `/Users/bradley/Documents/Pillars/backend`

Deploy from backend directory:
```bash
vercel --prod --yes --scope bradleyryan15-gmailcoms-projects
```

If deploy fails with lockfile mismatch, refresh lockfile then redeploy:
```bash
pnpm install --lockfile-only
vercel --prod --yes --scope bradleyryan15-gmailcoms-projects
```

Agent service auth format:
- Preferred (user-scoped key):
  - `x-api-key: <user_api_key>`
  - or `Authorization: Bearer <user_api_key>`
- Internal service fallback:
  - `Authorization: Bearer <INTERNAL_SERVICE_SECRET>`
  - `x-user-id: <firebase_uid>`

Hosted OpenClaw skill:
- Manifest: `GET https://pillars-phi.vercel.app/api/skills/openclaw/manifest.json`
- Skill file: `GET https://pillars-phi.vercel.app/api/skills/openclaw/SKILL.md`
- When skill behavior changes, update the hosted `SKILL.md` and bump manifest version/checksum.
