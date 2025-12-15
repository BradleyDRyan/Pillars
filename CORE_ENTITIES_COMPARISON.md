# Core Entities: Desired vs Current State

## ✅ What You Want (Core Entities)

### 1. **Pillar** — A major domain of life (e.g., Work, Relationship, Health)
**Status:** ✅ **EXISTS** - Fully implemented

**Current Implementation:**
- Collection: `pillars`
- Fields: `id`, `userId`, `name`, `description`, `color`, `icon`, `isDefault`, `isArchived`, `settings`, `stats`, `createdAt`, `updatedAt`, `metadata`
- ✅ Matches desired concept perfectly
- ✅ Has stats tracking for related entities
- ✅ Supports multiple pillars per user

---

### 2. **Principle** — Guiding beliefs that define how the user wants to operate within a Pillar
**Status:** ✅ **EXISTS** - Fully implemented

**Current Implementation:**
- Collection: `principles`
- Fields: `id`, `userId`, `pillarId` (optional), `title`, `description`, `isActive`, `priority`, `tags`, `createdAt`, `updatedAt`, `metadata`
- ✅ Can be linked to a Pillar (via `pillarId`)
- ✅ Can exist without a Pillar (optional `pillarId`)
- ✅ Has priority/importance tracking
- ✅ Matches desired concept

---

### 3. **Wisdom** — User-captured experiences, lessons, reflections, quotes
**Status:** ✅ **EXISTS** - Fully implemented

**Current Implementation:**
- Collection: `wisdoms`
- Fields: `id`, `userId`, `pillarId` (optional), `title`, `content`, `type` (lesson/reflection/quote/experience/insight), `source`, `wisdomDate`, `isInternalized`, `tags`, `createdAt`, `updatedAt`, `metadata`
- ✅ Can be linked to a Pillar (via `pillarId`)
- ✅ Can exist without a Pillar (optional `pillarId`)
- ✅ Supports multiple types (lesson, reflection, quote, experience, insight)
- ✅ Has internalization tracking
- ✅ Matches desired concept

---

### 4. **Resource** — External ideas/frameworks (books, podcasts, theories) the user saves
**Status:** ✅ **EXISTS** - Fully implemented

**Current Implementation:**
- Collection: `resources`
- Fields: `id`, `userId`, `pillarId` (optional), `title`, `description`, `type` (book/article/podcast/video/course/framework/person/other), `author`, `url`, `imageUrl`, `status` (saved/in_progress/completed/revisiting/archived), `rating`, `notes`, `takeaways`, `tags`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`, `metadata`
- ✅ Can be linked to a Pillar (via `pillarId`)
- ✅ Can exist without a Pillar (optional `pillarId`)
- ✅ Supports multiple resource types
- ✅ Has consumption tracking (status, startedAt, completedAt)
- ✅ Matches desired concept

---

### 5. **Conversation** — An ongoing dialogue between the user and the system
**Status:** ✅ **EXISTS** - Partially matches

**Current Implementation:**
- Collection: `conversations`
- Fields: `id`, `userId`, `agentId`, `pillarIds` (array), `title`, `titleGenerated`, `lastMessage`, `createdAt`, `updatedAt`, `metadata`
- ✅ Supports multiple conversations
- ✅ Can be linked to multiple Pillars (via `pillarIds`)
- ⚠️ Has `agentId` field (not mentioned in desired spec - may be intentional for agent system)
- ✅ Matches desired concept (supports multiple conversations, can link to Pillars)

**Note:** The spec mentions "at least one 'primary' Conversation (the Home View chat)" - this could be handled via `isDefault` flag or by checking if `agentId` is null. Currently no explicit `isPrimary` field.

---

### 6. **Message** — A single turn within a Conversation
**Status:** ⚠️ **EXISTS BUT MISSING KEY FEATURE**

**Current Implementation:**
- Collection: `conversations/{id}/messages` (subcollection)
- Fields: `id`, `conversationId`, `userId`, `sender`, `content`, `type`, `role`, `photoId`, `attachments`, `blocks`, `toolCalls`, `createdAt`, `editedAt`, `metadata`

**❌ MISSING:** The spec says Messages should be "optionally linked to Pillars, Principles, Wisdom, and Resources so the system can learn from and reuse them."

**Current State:**
- ❌ No `pillarIds` field (Conversation has it, but not Message)
- ❌ No `principleIds` field
- ❌ No `wisdomIds` field  
- ❌ No `resourceIds` field
- ⚠️ Could theoretically store in `metadata`, but not explicit/exposed

**What's Needed:**
```javascript
// Add to Message model:
this.pillarIds = data.pillarIds || [];
this.principleIds = data.principleIds || [];
this.wisdomIds = data.wisdomIds || [];
this.resourceIds = data.resourceIds || [];
```

---

## 📊 Summary

### ✅ Fully Implemented (5/6)
1. Pillar ✅
2. Principle ✅
3. Wisdom ✅
4. Resource ✅
5. Conversation ✅

### ⚠️ Needs Enhancement (1/6)
6. Message ⚠️ - Missing linking fields to Pillars, Principles, Wisdom, Resources

---

## 🔍 Additional Entities (Not in Core Spec)

You have these entities that aren't part of your "core entities" spec:

### Legacy/Supporting Entities:
- **Entry** - Journal entries, notes, reflections (seems to overlap with Wisdom?)
- **Thought** - Personal thoughts/insights (seems to overlap with Wisdom?)
- **UserTask** - Task management (not mentioned in core spec)
- **Collection** - Collection system for organizing entries
- **CollectionEntry** - Entries within collections
- **CollectionEntrySuggestion** - AI suggestions for collections
- **Photo** - Photo storage and metadata
- **Agent** - AI agent configuration (used by Conversation)
- **Trigger** - Scheduled triggers for agents

### Questions to Consider:
1. **Entry vs Wisdom:** Do you still need both? Entry seems more journal-like, Wisdom more curated learnings.
2. **Thought vs Wisdom:** Similar overlap - Thoughts seem like raw thoughts, Wisdom like processed insights.
3. **UserTask:** Is this part of the core system or a separate feature?
4. **Collection System:** Is this part of the core or a separate organizational feature?

---

## 🎯 Action Items

### Critical (Required for Spec)
1. **Add linking fields to Message model:**
   - `pillarIds: string[]` (array of Pillar IDs)
   - `principleIds: string[]` (array of Principle IDs)
   - `wisdomIds: string[]` (array of Wisdom IDs)
   - `resourceIds: string[]` (array of Resource IDs)

### Recommended (Clarification)
2. **Consider adding `isPrimary` flag to Conversation** if you want to explicitly mark the "Home View chat"
3. **Document relationship between Entry/Thought and Wisdom** - clarify if they're separate concepts or should be consolidated
4. **Decide on Collection system** - is it core or supporting infrastructure?

---

## 📝 Implementation Notes

### Message Linking Implementation

To add linking to Messages, you'll need to:

1. **Update Message model** (`backend/src/models/Message.js`):
```javascript
this.pillarIds = data.pillarIds || [];
this.principleIds = data.principleIds || [];
this.wisdomIds = data.wisdomIds || [];
this.resourceIds = data.resourceIds || [];
```

2. **Update Message creation** in routes to accept these fields

3. **Update Message queries** to support filtering by these linked entities

4. **Update frontend types** if you have TypeScript interfaces

5. **Consider indexing** in Firestore for efficient queries:
   - Index on `pillarIds` (array-contains)
   - Index on `principleIds` (array-contains)
   - Index on `wisdomIds` (array-contains)
   - Index on `resourceIds` (array-contains)

### Conversation Primary Flag (Optional)

If you want to mark a primary conversation:
```javascript
this.isPrimary = data.isPrimary || false;
```

Then query for primary conversation:
```javascript
static async findPrimaryConversation(userId) {
  const snapshot = await this.collection()
    .where('userId', '==', userId)
    .where('isPrimary', '==', true)
    .limit(1)
    .get();
  // ...
}
```



