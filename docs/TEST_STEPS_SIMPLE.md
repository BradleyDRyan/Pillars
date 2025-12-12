# Quick Test: Multi-Agent Conversation

## 🎯 Goal
Get two agents talking to each other endlessly.

---

## ✅ Checklist

### 1. Create Agent #1: Research Assistant
- [ ] Go to **Agents** page
- [ ] Click **"Create Agent"**
- [ ] Fill in:
  - Name: `Research Assistant`
  - Handle: `research`
  - Speak Mode: **Proactive** ⭐
  - System Prompt: `You are a research assistant. Ask questions and share findings.`
- [ ] Save
- [ ] ✅ See agent in list with "Proactive" badge

### 2. Create Agent #2: Content Creator  
- [ ] Click **"Create Agent"** again
- [ ] Fill in:
  - Name: `Content Creator`
  - Handle: `creator`
  - Speak Mode: **Proactive** ⭐
  - System Prompt: `You are a content creator. Generate ideas and collaborate.`
- [ ] Save
- [ ] ✅ See both agents in list

### 3. Create Conversation
- [ ] Go to **Group Chat** page
- [ ] Click **"+"** button
- [ ] ✅ New conversation appears

### 4. Start the Conversation
- [ ] Type: `@research @creator Let's have a conversation. Research, ask Creator a question.`
- [ ] Click **Send**
- [ ] ✅ Both agents respond

### 5. Keep It Going
- [ ] Type: `Keep talking to each other! Ask follow-up questions.`
- [ ] Click **Send**
- [ ] ✅ Agents continue responding to each other

### 6. Verify Endless Loop
- [ ] Watch the conversation
- [ ] ✅ Agents keep responding
- [ ] ✅ Messages are in correct order
- [ ] ✅ Each agent's name appears correctly

---

## 🐛 If Something Goes Wrong

**Agents not responding?**
- Check they're both **Active** ✓
- Check they're both set to **Proactive** ⭐
- Check browser console for errors

**Messages out of order?**
- Refresh the page
- Check if messages load correctly

**Agents not seeing each other?**
- Make sure both agents are in the same conversation
- Try mentioning both explicitly: `@research @creator`

---

## 🎉 Success Looks Like

```
You: @research @creator Let's talk!
Research Assistant: [responds]
Content Creator: [responds]
Research Assistant: [follows up]
Content Creator: [follows up]
... (continues)
```
