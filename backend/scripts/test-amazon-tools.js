#!/usr/bin/env node

/**
 * Test script for Amazon tools
 * Tests: search_amazon and fetch_amazon_product
 */

require('dotenv').config();
const { Agent, Conversation, Message } = require('../src/models');
const { generateInstructions } = require('../src/services/instructionGenerator');
const { runAgent } = require('../services/agentRunner');

async function testAmazonTools() {
  console.log('🧪 Testing Amazon Tools\n');

  try {
    // Test 1: Create agent with Amazon tools
    console.log('Test 1: Creating agent with Amazon tools...');
    const conversation = await Conversation.create({
      userId: 'test-user',
      agentId: null,
      title: 'Amazon Deal Finder',
      lastMessage: null
    });

    const instructions = await generateInstructions('Find the best deals on Amazon products, specifically Nuna strollers');

    const agent = await Agent.create({
      userId: 'test-user',
      name: 'Amazon Deal Finder',
      description: 'Find the best deals on Amazon products, specifically Nuna strollers',
      instructions,
      model: null,
      enableWebSearch: false,
      allowedTools: ['search_amazon', 'fetch_amazon_product'],
      conversationId: conversation.id,
      metadata: {
        createdBy: 'test'
      }
    });

    conversation.agentId = agent.id;
    await conversation.save();

    console.log('✅ Agent created:', {
      id: agent.id,
      name: agent.name,
      allowedTools: agent.allowedTools
    });

    // Test 2: Create a message asking about Nuna stroller
    console.log('\nTest 2: Creating user message...');
    const userMessage = await Message.create({
      conversationId: conversation.id,
      userId: 'test-user',
      sender: 'test-user',
      content: 'Find me the best deals on Nuna strollers',
      type: 'text',
      role: 'user'
    });

    console.log('✅ Message created:', userMessage.id);

    // Test 3: Run the agent
    console.log('\nTest 3: Running agent to search Amazon...');
    console.log('(This will use search_amazon tool if SCRAPINGBEE_API_KEY is configured)');
    
    const result = await runAgent(agent.id, {
      model: null,
      temperature: 0.7,
      maxTokens: 2000
    });

    console.log('\n✅ Agent run completed!');
    console.log('\nAgent response:');
    console.log('─'.repeat(60));
    console.log(result.message.content);
    console.log('─'.repeat(60));

    // Cleanup
    console.log('\nCleaning up test data...');
    await Agent.delete(agent.id);
    const messages = await Message.findByConversationId(conversation.id, 100);
    for (const msg of messages) {
      await Message.collection(conversation.id).doc(msg.id).delete();
    }
    await conversation.delete();
    console.log('✅ Cleanup complete\n');

    console.log('🎉 Amazon tools test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testAmazonTools();


