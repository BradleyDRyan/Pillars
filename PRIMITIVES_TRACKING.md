# Primitives Tracking Document

This document tracks all data primitives (models/types) that exist in both the backend and frontend of the Pillars application.

**Last Updated:** 2024-12-19

---

## Backend Primitives

Located in `/backend/src/models/`

### Core Domain Models

1. **Conversation**
   - Collection: `conversations`
   - Fields: `id`, `userId`, `agentId`, `pillarIds` (legacy: `projectIds`), `title`, `titleGenerated`, `lastMessage`, `createdAt`, `updatedAt`, `metadata`
   - Frontend Status: ❌ Not found in frontend types

2. **Message**
   - Collection: `conversations/{id}/messages` (subcollection)
   - Fields: `id`, `conversationId`, `userId`, `sender`, `content`, `type`, `role`, `photoId`, `attachments`, `blocks`, `toolCalls`, `createdAt`, `editedAt`, `metadata`
   - Frontend Status: ✅ Found in `backend/frontend/src/components/AgentConversation.tsx` as `Message` interface

3. **Entry**
   - Collection: `entries`
   - Fields: `id`, `userId`, `collectionIds` (legacy: `collectionId`), `pillarIds` (legacy: `projectIds`), `conversationId`, `title`, `content`, `type`, `mood`, `tags`, `attachments`, `location`, `weather`, `photoId`, `imageUrl`, `createdAt`, `updatedAt`, `metadata`
   - Frontend Status: ❌ Not found in frontend types

4. **Thought**
   - Collection: `thoughts`
   - Fields: `id`, `userId`, `pillarIds` (legacy: `projectIds`), `conversationId`, `content`, `type`, `category`, `tags`, `insights`, `linkedThoughts`, `isPrivate`, `createdAt`, `updatedAt`, `metadata`
   - Frontend Status: ❌ Not found in frontend types

5. **UserTask**
   - Collection: `tasks`
   - Fields: `id`, `userId`, `pillarIds` (legacy: `projectIds`), `conversationId`, `title`, `description`, `status`, `priority`, `dueDate`, `completedAt`, `tags`, `createdAt`, `updatedAt`, `metadata`
   - Frontend Status: ❌ Not found in frontend types

### Pillar System Models

6. **Pillar** (formerly Project)
   - Collection: `pillars`
   - Fields: `id`, `userId`, `name`, `description`, `color`, `icon`, `isDefault`, `isArchived`, `settings`, `stats`, `createdAt`, `updatedAt`, `metadata`
   - Legacy Alias: `Project` (for backwards compatibility)
   - Frontend Status: ❌ Not found in frontend types

7. **Principle**
   - Collection: `principles`
   - Fields: `id`, `userId`, `pillarId`, `title`, `description`, `isActive`, `priority`, `tags`, `createdAt`, `updatedAt`, `metadata`
   - Frontend Status: ❌ Not found in frontend types

8. **Wisdom**
   - Collection: `wisdoms`
   - Fields: `id`, `userId`, `pillarId`, `title`, `content`, `type`, `source`, `wisdomDate`, `isInternalized`, `tags`, `createdAt`, `updatedAt`, `metadata`
   - Frontend Status: ❌ Not found in frontend types

9. **Resource**
   - Collection: `resources`
   - Fields: `id`, `userId`, `pillarId`, `title`, `description`, `type`, `author`, `url`, `imageUrl`, `status`, `rating`, `notes`, `takeaways`, `tags`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`, `metadata`
   - Frontend Status: ❌ Not found in frontend types

### Collection System Models

10. **Collection**
    - Collection: `collections`
    - Fields: `id`, `userId`, `name`, `instructions`, `icon`, `color`, `entryFormat`, `template`, `settings`, `stats`, `createdAt`, `updatedAt`, `metadata`
    - Frontend Status: ❌ Not found in frontend types

11. **CollectionEntry**
    - Collection: `collection_entries`
    - Fields: `id`, `entryId`, `collectionId`, `userId`, `formattedData`, `userOverrides`, `createdAt`, `lastProcessedAt`, `metadata`
    - Frontend Status: ❌ Not found in frontend types

12. **CollectionEntrySuggestion**
    - Collection: `collection_entry_suggestions`
    - Fields: `id`, `collectionEntryId`, `entryId`, `collectionId`, `userId`, `type`, `status`, `payload`, `error`, `metadata`, `createdAt`, `updatedAt`
    - Frontend Status: ❌ Not found in frontend types

### Media Models

13. **Photo**
    - Collection: `photos`
    - Fields: `id`, `userId`, `urls` (original, thumbnail, small, medium, large), `storagePaths`, `mimeType`, `originalSize`, `dimensions`, `analysis`, `createdAt`, `updatedAt`, `metadata`
    - Frontend Status: ❌ Not found in frontend types

### Agent System Models

14. **Agent**
    - Collection: `agents`
    - Fields: `id`, `userId`, `name`, `description`, `instructions`, `model`, `enableWebSearch`, `allowedTools`, `conversationId`, `createdAt`, `updatedAt`, `metadata`
    - Frontend Status: ✅ Found in `backend/frontend/src/App.tsx` and `AgentConversation.tsx` as `Agent` interface

15. **Trigger**
    - Collection: `triggers`
    - Fields: `id`, `agentId` (legacy: `monitorId`), `type`, `schedule`, `enabled`, `lastRunAt`, `nextRunAt`, `metadata`, `createdAt`, `updatedAt`
    - Frontend Status: ❌ Not found in frontend types

---

## Frontend Primitives

Located in `/backend/frontend/src/`

### Agent System Types

1. **Agent** (TypeScript Interface)
   - Location: `backend/frontend/src/App.tsx`, `AgentConversation.tsx`
   - Fields: `id`, `name`, `description`, `instructions?`, `conversationId`, `enableWebSearch`, `allowedTools?`, `createdAt`, `lastMessage?`
   - Backend Status: ✅ Matches `Agent` model (with some optional fields)

2. **Message** (TypeScript Interface)
   - Location: `backend/frontend/src/components/AgentConversation.tsx`
   - Fields: `id`, `sender`, `content`, `role`, `createdAt`, `blocks?`
   - Backend Status: ✅ Matches `Message` model (simplified version)

3. **ToolDefinition** (TypeScript Interface)
   - Location: `backend/frontend/src/App.tsx`, `AgentConversation.tsx`
   - Fields: `name`, `label`, `description`
   - Backend Status: ⚠️ Not a backend model - frontend-only type

### Block System Types

4. **Block** (TypeScript Interface)
   - Location: `backend/frontend/src/utils/blockTypes.ts`
   - Fields: `type`, `data`, `metadata?`, `sealed?`, `key?`
   - Backend Status: ✅ Used in `Message.blocks` field

5. **BlockTypeValue** (TypeScript Type)
   - Location: `backend/frontend/src/utils/blockTypes.ts`
   - Values: `text`, `tool_use`, `tool_result`, `ui_component`, `web_search`, `web_fetch`, `plan`, `unknown`
   - Backend Status: ✅ Used in `Message.blocks` field

---

## Admin UI Primitives

Located in `/backend/admin-ui/src/`

### Admin-Only Types

1. **Person** (TypeScript Type)
   - Location: `backend/admin-ui/src/components/people-columns.tsx`
   - Fields: `id`, `userId?`, `name`, `relationship?`, `sharedInterests?`, `importantDates?`
   - Backend Status: ❌ Not found in backend models

2. **Signal** (TypeScript Type)
   - Location: `backend/admin-ui/src/components/signals-columns.tsx`, `App.tsx`
   - Fields: `id`, `userId`, `personId`, `monitorId`, `type`, `source`, `description`, `importance`, `occurredAt`, `createdAt`, `metadata`
   - Backend Status: ❌ Not found in backend models

3. **Monitor** (TypeScript Type)
   - Location: `backend/admin-ui/src/components/monitors-columns.tsx`
   - Fields: `id`, `monitorId`, `personId`, `userId`, `status`, `runCount`, `lastRunAt`, `lastResult`, `lastError`, `monitor`, `person`
   - Backend Status: ⚠️ Related to `Agent` model (monitorId = agentId)

4. **Assignment** (TypeScript Type)
   - Location: `backend/admin-ui/src/App.tsx`
   - Fields: Various (appears to be a composite type)
   - Backend Status: ⚠️ Composite type, not a direct backend model

5. **MonitorSummary** (TypeScript Type)
   - Location: `backend/admin-ui/src/App.tsx`
   - Fields: `id`, `name`, `type?`, `instructions`, `model`, `enableWebSearch`, `personId`, `status`, `runCount`, `lastRunAt`, `lastResult`, `lastError`
   - Backend Status: ⚠️ Composite type combining `Agent` and related data

6. **ScheduledTrigger** (TypeScript Type)
   - Location: `backend/admin-ui/src/App.tsx`
   - Fields: `id`, `agentId`, `type`, `schedule`, `enabled`, `lastRunAt`, `nextRunAt`, `createdAt`, `updatedAt`
   - Backend Status: ✅ Matches `Trigger` model

---

## Summary Statistics

### Backend Models
- **Total:** 15 models
- **With Frontend Types:** 2 (Agent, Message)
- **Missing Frontend Types:** 13

### Frontend Types
- **Total:** 5 types/interfaces
- **Matching Backend Models:** 2 (Agent, Message)
- **Frontend-Only Types:** 3 (ToolDefinition, Block, BlockTypeValue)

### Admin UI Types
- **Total:** 6 types
- **Matching Backend Models:** 1 (ScheduledTrigger → Trigger)
- **Admin-Only Types:** 5 (Person, Signal, Monitor, Assignment, MonitorSummary)

---

## Gaps & Recommendations

### Critical Gaps

1. **Missing Frontend Types for Core Models:**
   - Entry, Thought, UserTask, Pillar, Principle, Wisdom, Resource
   - These are core domain models but have no TypeScript definitions in the frontend

2. **Collection System Missing:**
   - Collection, CollectionEntry, CollectionEntrySuggestion have no frontend types

3. **Media Types Missing:**
   - Photo model has no frontend type definition

4. **Conversation Type Missing:**
   - Conversation model exists but no frontend type

### Recommendations

1. **Create Shared Type Definitions:**
   - Consider creating a shared types package or file that both backend and frontend can reference
   - Location suggestion: `/backend/shared/types/` or `/types/`

2. **Add Frontend Types for:**
   - All core domain models (Entry, Thought, UserTask, etc.)
   - Collection system models
   - Photo model
   - Conversation model

3. **Document Type Mappings:**
   - Document any differences between backend models and frontend types
   - Note any legacy field support (e.g., `projectIds` → `pillarIds`)

4. **Consider Type Generation:**
   - Generate TypeScript types from backend models automatically
   - Or use a schema-first approach (e.g., JSON Schema, OpenAPI)

---

## Notes

- **Legacy Support:** Several models support legacy field names (e.g., `projectIds` → `pillarIds`, `collectionId` → `collectionIds`)
- **Swift Models:** There are also Swift models in `/Pillars/Pillars/Models/` for the iOS app, but they are not tracked in this document
- **Subcollections:** Messages are stored as a subcollection of conversations, which is reflected in the backend model but not explicitly in frontend types

