# Imagine Backend Architecture Analysis

## Overview

This document analyzes the **imagine** backend architecture and compares it to **squirrel2**'s current implementation, identifying gaps and providing a roadmap for parity.

---

## 1. IMAGINE Architecture Deep Dive

### 1.1 Directory Structure

```
imagine/backend/
├── llm/
│   ├── claude/                    # Core Claude streaming system
│   │   ├── index.js               # Public API - exports streamClaudeChat
│   │   ├── config.js              # Constants (model, max tokens, etc.)
│   │   ├── streamCoordinator.js   # Main orchestration loop ⭐
│   │   ├── contextBuilder.js      # System prompt building ⭐
│   │   ├── messageTransformer.js  # Message format conversion
│   │   ├── toolOrchestrator.js    # Tool definition management
│   │   ├── toolExecutor.js        # Tool execution
│   │   ├── toolResultHandlers.js  # Post-processing (save plans, etc.)
│   │   ├── uiEmitters.js          # Tool-specific UI components ⭐
│   │   ├── sseManager.js          # SSE event emission
│   │   └── userResolver.js        # Anonymous user handling
│   │
│   ├── tools/                     # Tool definitions
│   │   ├── index.js               # Tool exports
│   │   ├── registry.js            # Tool registration
│   │   ├── workflowPrompts.js     # Cross-tool instructions ⭐
│   │   ├── tasks/                 # Planning tools
│   │   │   ├── createPlan.js
│   │   │   ├── askClarifyingQuestions.js
│   │   │   ├── updateTaskStatus.js
│   │   │   ├── updateTaskBrief.js
│   │   │   └── manageTaskSubtasks.js
│   │   ├── web/                   # Web tools
│   │   │   ├── webSearch.js
│   │   │   └── webFetch.js
│   │   ├── amazon/                # Shopping tools
│   │   ├── dataWeather/           # Weather
│   │   ├── dataStocks/            # Stocks
│   │   ├── gcal/                  # Google Calendar
│   │   └── gmail/                 # Gmail
│   │
│   ├── background/                # Background task system ⭐
│   │   ├── queue.js               # In-memory task queue
│   │   ├── worker.js              # Task worker
│   │   ├── noteExtractor.js       # Extract notes from conversations
│   │   └── tasks/                 # Background task definitions
│   │       ├── generateTitle.js
│   │       ├── suggestedSpacesPipeline.js
│   │       ├── autoTagPipeline.js
│   │       └── ... (many more)
│   │
│   ├── agents/                    # Specialized agents
│   │   ├── plannerAgent.js
│   │   ├── planClarifierAgent.js
│   │   └── emailDraftAgent.js
│   │
│   ├── orchestrator/              # High-level orchestration
│   │   └── index.js
│   │
│   └── kickoff/                   # Task kickoff system
│       ├── index.js
│       └── streamCollector.js
│
├── services/                      # Business logic services
│   ├── taskContextService.js      # Build task context for Claude ⭐
│   ├── spaceContextService.js     # Space context management
│   ├── fastSpaceDetector.js       # Quick space detection ⭐
│   ├── planService.js             # Plan CRUD operations
│   ├── taskListService.js         # Task list management
│   ├── userTaskService.js         # User task management
│   ├── conversationStatusService.js
│   ├── cacheService.js            # In-memory caching
│   ├── ocrService.js              # PDF OCR
│   └── ... (many more)
│
└── routes/
    ├── streaming.js               # Main streaming endpoint
    └── ... (many more)
```

### 1.2 Core Streaming Flow

```
Request → streamCoordinator.js → Claude API → SSE Response
                ↓
         [Setup Phase]
         1. setSSEHeaders()
         2. resolveUserId() - handle anonymous users
         3. detectSpace() - auto-detect space from message ⭐
         4. buildSpaceContext() - fetch space data + instructions
         5. buildTaskContext() - fetch task/plan context
         6. transformMessages() - convert to Anthropic format
         7. buildToolDefinitions() - filter tools by context
         8. buildSystemPrompt() - combine all context
                ↓
         [Streaming Loop]
         1. anthropic.messages.stream()
         2. Stream text deltas → emitTextDelta()
         3. Detect tool_use blocks
         4. executeToolsInParallel()
            → emitToolCall()
            → handler()
            → processToolResult() - post-processing
            → emitUIForTool() - render UI components
            → emitToolResult()
         5. Continue loop until no tools
                ↓
         [Cleanup Phase]
         1. emitFinal()
         2. Queue background tasks (note extraction, etc.)
         3. emitEndOfStream()
```

### 1.3 Context Building System

**contextBuilder.js** builds system prompts from multiple sources:

```javascript
async function buildSystemPrompt({
  system,           // Base system messages
  spaceContext,     // Space instructions + character
  taskContext,      // Task/plan context
  userId,           // For user-specific instructions
  promptPills       // User-selected prompt modifiers
}) {
  // 1. System messages from conversation
  // 2. Space context (title, instructions, character role)
  // 3. Task context (plan overview, focused task, siblings)
  // 4. Prompt pills (user-selected instructions)
  // 5. Date context
  // 6. User-specific instructions
  // 7. Tool behavior prompts
}
```

**Key Feature: Space Detection**
- Imagine auto-detects which space a message belongs to
- Uses `fastSpaceDetector.js` service
- Fetches space instructions, character data
- Tells Claude about the space context

**Key Feature: Task Context**
- `taskContextService.js` builds rich context for task-focused chats
- Includes plan overview, current task, sibling tasks
- Includes PM scratchpad notes, plan brief
- Provides "ASSISTANT GUIDANCE" rules

### 1.4 Tool System Architecture

**Tool Definition Pattern:**
```javascript
// Each tool exports:
module.exports = {
  definition: {
    name: 'tool_name',
    description: '...',
    input_schema: { /* JSON Schema */ }
  },
  behaviorPrompt: '...', // Instructions for Claude
  handler: async (input, context) => { /* execute */ }
};
```

**Tool Registration (registry.js):**
```javascript
const TOOL_REGISTRY = [
  createTool('create_plan', './tasks/createPlan'),
  createTool('web_search', './web/webSearch', { disableEnv: 'DISABLE_WEB_TOOLS' }),
  // ...
];
```

**Cross-Tool Workflows (workflowPrompts.js):**
```javascript
const CROSS_TOOL_WORKFLOW_PROMPTS = {
  create_plan: 'Before calling create_plan, MUST first call ask_clarifying_questions...',
  get_stock_info: 'If user needs weather AND plan, fetch weather first...'
};
```

### 1.5 UI Emitter System

**uiEmitters.js** - Registry pattern for tool-specific UI:

```javascript
// Register UI handler
registerUIEmitter('create_plan', emitPlanUI);
registerUIEmitter('get_weather', emitWeatherUI);
registerUIEmitter('web_search', emitWebSearchUI);

// Emit UI component
emitUIForTool(toolName, res, toolBlock, result, context);
```

**SSE Event Types:**
- `text` - Streaming text from Claude
- `tool_call` - Claude is calling a tool
- `tool_result` - Tool execution result
- `ui_component` - Rich UI component data
- `web_search` - Search results UI
- `weather` - Weather widget
- `stock` - Stock info widget
- `final` - Complete response
- `end_of_stream` - Connection closing

### 1.6 Result Handlers

**toolResultHandlers.js** - Post-processing after tool execution:

```javascript
// Register handler
registerResultHandler('create_plan', handleCreatePlanResult);

// handleCreatePlanResult:
// 1. Parse plan payload
// 2. Save to Firestore (savePlanDraft)
// 3. Update result with listId, spaceId
// 4. Return enriched result
```

### 1.7 Background Task System

**queue.js** - Simple in-memory task queue:

```javascript
class TaskQueue {
  registerWorker(taskType, handler);
  addTask(taskType, data);
  processQueue(); // Priority-based execution
}
```

**Background Tasks:**
- `generateTitle` - Generate conversation title
- `noteExtractor` - Extract notes from conversation
- `suggestedSpacesPipeline` - Suggest spaces for conversation
- `autoTagPipeline` - Auto-tag conversations
- `planKickoffBatch` - Kick off plan tasks

---

## 2. SQUIRREL2 Current State

### 2.1 Directory Structure

```
squirrel2/backend/src/
├── llm/
│   ├── claude/
│   │   ├── toolStreamRunner.js    # Main streaming (simplified)
│   │   ├── contextBuilder.js      # Basic context building
│   │   ├── toolExecutor.js        # Tool execution
│   │   ├── toolOrchestrator.js    # Tool definitions
│   │   ├── toolResultHandlers.js  # Minimal handlers
│   │   └── sseManager.js          # SSE emission
│   │
│   └── tools/
│       ├── index.js
│       ├── registry.js
│       └── files/
│           └── readFile.js        # Only tool: PDF reading
│
├── services/
│   ├── anthropic.js               # Claude client
│   ├── openai.js                  # OpenAI (embeddings)
│   ├── ocrService.js              # PDF OCR
│   ├── qstash.js                  # QStash integration
│   ├── queue.js                   # Task queue
│   └── backgroundTasks.js         # Background tasks
│
└── routes/
    └── ai.js                      # Streaming endpoint
```

### 2.2 Current Capabilities

| Feature | Squirrel2 | Imagine |
|---------|-----------|---------|
| Claude Streaming | ✅ Basic | ✅ Full |
| Tool Execution | ✅ Single tool | ✅ 20+ tools |
| SSE Events | ✅ Basic types | ✅ Rich types + UI |
| Space Context | ⚠️ Basic | ✅ Full (detection, instructions, character) |
| Task Context | ❌ None | ✅ Full (plans, siblings, notes) |
| UI Emitters | ❌ None | ✅ Registry pattern |
| Result Handlers | ⚠️ Basic | ✅ Full (save plans, refresh context) |
| Background Tasks | ⚠️ Basic | ✅ Full pipeline |
| Space Detection | ❌ None | ✅ Auto-detect |
| Workflow Prompts | ❌ None | ✅ Cross-tool |
| File Context | ❌ None | ✅ Lists available files |

---

## 3. Gap Analysis & Recommendations

### 3.1 Critical Gaps (Must Fix)

#### Gap 1: File Context in System Prompt ⭐
**Problem:** Claude doesn't know what files exist in the space.
**Solution:** Already partially implemented - update contextBuilder to fetch and list files.

```javascript
// In buildSpaceContext:
if (spaceContext.files.length > 0) {
  spaceContextText += '\n\nAVAILABLE FILES:';
  spaceContext.files.forEach(file => {
    spaceContextText += `\n- "${file.title}" (ID: ${file.id})`;
  });
}
```

#### Gap 2: Space Detection
**Problem:** Conversations aren't auto-assigned to spaces.
**Solution:** Implement `fastSpaceDetector.js` pattern.

#### Gap 3: Tools Not Loading in Vercel
**Problem:** Module initialization timing issue.
**Solution:** Lazy loading pattern (recently fixed).

### 3.2 Important Gaps (Should Fix)

#### Gap 4: UI Emitters
**Problem:** No rich UI for tool results.
**Solution:** Copy `uiEmitters.js` pattern.

#### Gap 5: Result Handlers
**Problem:** Tool results aren't post-processed (no saving).
**Solution:** Copy `toolResultHandlers.js` pattern.

#### Gap 6: Background Tasks
**Problem:** No post-response processing.
**Solution:** Use existing `queue.js` + add workers.

### 3.3 Nice-to-Have Gaps

- Task context service
- Workflow prompts
- User resolver (anonymous handling)
- Caching service

---

## 4. Recommended Action Plan

### Phase 1: Get Tools Working (Current)
1. ✅ Fix tool loading in Vercel
2. ✅ Add file context to system prompt
3. 🔄 Test read_file tool end-to-end

### Phase 2: Context Enhancement
1. Implement space detection service
2. Add space instructions to context
3. Add conversation-to-space assignment

### Phase 3: UI & Polish
1. Add UI emitters for read_file
2. Add result handlers
3. Implement background title generation

### Phase 4: Advanced Features
1. Task context service
2. Multiple tools (web search, etc.)
3. Cross-tool workflows

---

## 5. Key Files to Reference

When implementing features, reference these imagine files:

| Feature | Imagine File |
|---------|-------------|
| Streaming | `llm/claude/streamCoordinator.js` |
| Context | `llm/claude/contextBuilder.js` |
| Tools | `llm/tools/*.js` |
| UI | `llm/claude/uiEmitters.js` |
| Results | `llm/claude/toolResultHandlers.js` |
| Space Detection | `services/fastSpaceDetector.js` |
| Task Context | `services/taskContextService.js` |
| Background | `llm/background/queue.js` |

---

## 6. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        iOS App                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ConversationViewModel                                    │   │
│  │  - Sends messages to /api/ai/chat/stream                  │   │
│  │  - Receives SSE events (text, tool_call, tool_result)     │   │
│  │  - Renders ToolCallView for tool status                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ SSE
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Vercel)                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  routes/ai.js - /chat/stream                              │   │
│  │  └── runClaudeToolStream()                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  llm/claude/toolStreamRunner.js                           │   │
│  │  1. Build space context (fetch files)                     │   │
│  │  2. Build system prompt                                   │   │
│  │  3. Stream Claude response                                │   │
│  │  4. Execute tools → read_file                             │   │
│  │  5. Continue until done                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  llm/tools/files/readFile.js                              │   │
│  │  - Fetch attachment from Firestore                        │   │
│  │  - Return OCR content                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Firestore                                                │   │
│  │  - spaces/{spaceId}/attachments/{attachmentId}            │   │
│  │  - ocrContent, ocrStatus, title, etc.                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

*Generated: December 5, 2025*

