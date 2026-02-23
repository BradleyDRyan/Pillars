# Pillars

## High-Level Vision (Start Here)
Pillars is an API-first personal operating system centered on a single `Today` view.

The user should be able to see, in one place:
- How they slept
- Workout and health signals
- Mood/feeling updates
- Progress on daily routines (tracked as blocks, e.g. `morning_habits`)
- A running timeline of meaningful updates

Data enters Pillars through two lanes:

1. Agent lane (`Claudebot -> Pillars API`)
- Claudebot runs on the user's own machine and can write/read user-scoped data through Pillars APIs.
- This powers automatic updates (for example: workout syncs, mood logs from chat, journaling events).

2. UI lane (`User -> Pillars app -> Pillars API`)
- The user directly checks off fast actions in the app (for example: morning habit checklist items).
- Claudebot can read these user-entered updates back through the API.

Core product principle: Pillars backend is the source of truth. Both agent and UI writes converge into the same user timeline.

## Core Data Model
Pillars is organized around a `Day` document made up of `Blocks`.

- `Day`: the container for a user's "Today" state.
- `Block`: a typed unit of input/state within a day.
- Example block types: `sleep`, `morning_habits`, `workout`, `mood`, `journal`.

API design implication:
- Treat habits as a block type inside a day, not as a top-level `/habits` resource.
- "Morning habits" should be represented as a block (for example, `blockType: morning_habits`) on a day.

## Vision-First Build Rule
Before implementing features, we start from the user outcome in the `Today` view and then design the API/data contract needed to support it.

Order of operations:
1. Define the user-facing outcome in plain language.
2. Define how it is written/read via API (agent lane, UI lane, or both).
3. Implement backend contract.
4. Implement client surfaces (iOS/app/agent tooling).

## How Codex Works In This Repo
Codex is used as a coding agent for implementation, refactors, and review support.

Practical model:
1. Human gives intent (goal + constraints).
2. Codex reads repo instructions/context, edits code, and runs commands.
3. Human reviews diffs and test output.
4. Merge after human validation.

Important Codex behaviors from current OpenAI docs:
- Codex app and Codex cloud support parallel threads/tasks.
- Codex CLI can inspect/edit files and run commands from the terminal.
- Codex uses instruction layering via `AGENTS.md` (global + project + nested overrides).
- Codex supports approval/permission modes (`Auto`, `Read-only`, `Full Access`).

Recommended repo convention:
- Keep this `README.md` focused on product vision and architecture.
- Add/maintain repo-specific operational guidance in `AGENTS.md` when needed.

## Repository Layout
```text
Pillars/                  # iOS app (SwiftUI)
backend/                  # Node.js + Express API (Vercel/Firebase)
docs/                     # Architecture and backend documentation
imessage-bot/             # Local bot integration scripts
```

## Local Development
### Backend
```bash
cd backend
npm install
npm run dev
```

### iOS app
```bash
open Pillars/Pillars.xcodeproj
```

## Key Project Docs
- `docs/BACKEND_OVERVIEW.md`
- `docs/BACKEND_API_GUIDELINES.md`
- `docs/README.md`

## Codex References (Reviewed Feb 19, 2026)
- [Codex app docs](https://developers.openai.com/codex/app)
- [Codex CLI docs](https://developers.openai.com/codex/cli)
- [Codex CLI features](https://developers.openai.com/codex/cli/features)
- [AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md)
- [Introducing Codex](https://openai.com/index/introducing-codex/)

## Design Lab (React + Dial Kit)
A standalone visual sandbox for rapid UI iteration lives at `/Users/bradley/Documents/Pillars/design-lab`.

Run locally:
```bash
cd /Users/bradley/Documents/Pillars/design-lab
npm install
npm run dev
```
