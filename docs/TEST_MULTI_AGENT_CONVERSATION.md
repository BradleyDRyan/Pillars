# Multi-Agent Conversation Test Plan

## Objective
Test that two agents can be created, participate in a conversation, and engage in an endless back-and-forth dialogue.

## Prerequisites
- Admin UI accessible at `https://pillars-rho.vercel.app/connection-admin/`
- User is logged in with admin access
- No existing agents required (we'll create them)

---

## Test Steps

### Step 1: Create Two Agents

#### Agent 1: "Research Assistant"
1. Navigate to **Agents** view in the sidebar
2. Click **"Create Agent"** button
3. Fill in the form:
   - **Name**: `Research Assistant`
   - **Handle**: `research` (without @)
   - **Description**: `A helpful research assistant that finds and summarizes information`
   - **System Prompt**: `You are a research assistant. You help find information, summarize findings, and ask clarifying questions. Be concise and helpful.`
   - **Tools**: Select any available tools (e.g., `list_pillars`, `create_pillar`)
   - **Model**: `Claude Sonnet 4`
   - **Speak Mode**: Select **"Proactive"** (so it can respond without being mentioned)
   - **Active**: ✓ Checked
4. Click **"Save"**
5. Verify agent appears in the list with a green "Proactive" badge

#### Agent 2: "Content Creator"
1. Click **"Create Agent"** button again
2. Fill in the form:
   - **Name**: `Content Creator`
   - **Handle**: `creator` (without @)
   - **Description**: `A creative content creator that generates ideas and writes content`
   - **System Prompt**: `You are a content creator. You generate creative ideas, write content, and collaborate with others. Be creative and engaging.`
   - **Tools**: Select any available tools
   - **Model**: `Claude Sonnet 4`
   - **Speak Mode**: Select **"Proactive"** (so it can respond without being mentioned)
   - **Active**: ✓ Checked
3. Click **"Save"**
4. Verify both agents appear in the list

**Expected Result**: Two agents are created and visible in the Agents list.

---

### Step 2: Create a Conversation

1. Navigate to **Group Chat** view in the sidebar
2. Click the **"+"** button (or "Create Conversation" button)
3. A new conversation should be created automatically with title "New Chat"
4. Verify the conversation appears in the conversation list on the left

**Expected Result**: A new conversation is created and selected.

---

### Step 3: Initiate Agent Conversation

#### Initial Message
1. In the message input at the bottom, type:
   ```
   @research @creator Let's discuss content strategy. Research, can you suggest some topics? Creator, what's your take?
   ```
2. Click **Send** (or press Enter)
3. Wait for responses to stream in

**Expected Result**: 
- Your user message appears
- Both agents respond (since they're both proactive and mentioned)
- Responses stream in real-time with proper formatting

#### Continue the Conversation
1. After both agents respond, send another message:
   ```
   @research Can you elaborate on that first topic?
   ```
2. Wait for Research Assistant to respond

**Expected Result**: Research Assistant responds to your question.

#### Let Agents Talk to Each Other
1. Send a message that encourages agents to discuss:
   ```
   @research @creator You two should discuss this together. Research, share your findings with Creator. Creator, respond with your creative ideas.
   ```
2. Wait for both agents to respond

**Expected Result**: Both agents respond, potentially referencing each other.

#### Create Endless Loop
1. Send a message that creates a conversation loop:
   ```
   @research @creator I want you two to have a conversation. Research, ask Creator a question. Creator, respond and ask Research a question back. Keep going!
   ```
2. Watch as agents respond to each other

**Expected Result**: 
- Agents respond to each other
- Each agent's response triggers the other to respond
- Conversation continues with multiple back-and-forth exchanges

---

## Test Scenarios

### Scenario A: Proactive Agents (Both Set to "Proactive")
- **Setup**: Both agents have `speakMode: "proactive"`
- **Behavior**: Both agents can respond even when not explicitly mentioned
- **Test**: Send a message without @mentions and verify both agents respond

### Scenario B: Mixed Speak Modes
- **Setup**: One agent "Proactive", one "Only when @mentioned"
- **Behavior**: Proactive agent responds freely, other only when mentioned
- **Test**: Send messages with and without mentions to verify behavior

### Scenario C: Agent-to-Agent References
- **Setup**: Both agents proactive
- **Behavior**: Agents should be able to reference each other by name/handle
- **Test**: Ask one agent to "ask @creator a question" and verify it works

---

## Success Criteria

✅ **Step 1**: Two agents created successfully
- Both agents visible in Agents list
- Both have "Proactive" badge
- Both are active

✅ **Step 2**: Conversation created successfully
- New conversation appears in list
- Conversation is selected and ready for messages

✅ **Step 3**: Agents engage in conversation
- User messages appear correctly
- Agent responses stream in real-time
- Agents respond to @mentions
- Proactive agents respond without explicit mentions
- Agents can reference each other
- Conversation continues with multiple exchanges
- Message ordering is correct (chronological)
- Tool calls (if any) are displayed correctly

---

## Known Issues to Watch For

- ❌ Messages appearing out of order
- ❌ Agents not responding when they should
- ❌ Proactive agents not responding without mentions
- ❌ Agents not seeing each other's messages
- ❌ Streaming blocks rendering incorrectly
- ❌ Tool results not displaying properly

---

## Notes

- Agents need to be **active** to participate
- Proactive agents will respond to any message in the conversation
- Agents set to "Only when @mentioned" require explicit `@handle` mentions
- Each agent's response is saved as a separate message
- The conversation history is preserved and can be viewed later

---

## Next Steps After Test

If the test passes:
- Consider adding more agents
- Test with different tool combinations
- Test with different models
- Test conversation limits/performance

If the test fails:
- Document the failure point
- Check browser console for errors
- Check network tab for API errors
- Verify agent configurations
- Check Firestore for message data
