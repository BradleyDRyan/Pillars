#!/usr/bin/env node

/**
 * Test script for agent creation flow with web search
 * Tests: Create agent -> Check web search enabled -> Verify instructions are short
 */

require('dotenv').config();
const { Agent } = require('../src/models');

async function testAgentCreation() {
  console.log('🧪 Testing Agent Creation Flow\n');

  try {
    // Test 1: Create agent with web search enabled
    console.log('Test 1: Creating agent with web search enabled...');
    const testAgent = await Agent.create({
      userId: 'test-user',
      name: 'Tech News Finder',
      description: 'Find the latest tech news about AI',
      instructions: '', // Will be generated
      model: null,
      enableWebSearch: true,
      allowedTools: ['web_search'],
      conversationId: null,
      metadata: {
        createdBy: 'test'
      }
    });

    console.log('✅ Agent created:', {
      id: testAgent.id,
      name: testAgent.name,
      enableWebSearch: testAgent.enableWebSearch,
      allowedTools: testAgent.allowedTools
    });

    // Verify web search is enabled
    if (!testAgent.enableWebSearch) {
      throw new Error('❌ Web search should be enabled');
    }
    if (!testAgent.allowedTools.includes('web_search')) {
      throw new Error('❌ web_search should be in allowedTools');
    }

    console.log('✅ Web search correctly enabled\n');

    // Test 2: Check instructions are short (not from LLM)
    console.log('Test 2: Checking instructions length...');
    const { generateInstructions } = require('../src/services/instructionGenerator');
    const instructions = await generateInstructions('Find news about AI');
    
    console.log('Generated instructions:', instructions);
    console.log('Instructions length:', instructions.length);

    if (instructions.length > 500) {
      throw new Error('❌ Instructions are too long - should be short template');
    }
    if (!instructions.includes('Find news about AI')) {
      throw new Error('❌ Instructions should include the description');
    }

    console.log('✅ Instructions are short and template-based\n');

    // Test 3: Create agent without web search
    console.log('Test 3: Creating agent without web search...');
    const agentNoWebSearch = await Agent.create({
      userId: 'test-user',
      name: 'Simple Agent',
      description: 'Just a simple agent',
      instructions: 'Do something simple',
      model: null,
      enableWebSearch: false,
      allowedTools: [],
      conversationId: null,
      metadata: {
        createdBy: 'test'
      }
    });

    if (agentNoWebSearch.enableWebSearch) {
      throw new Error('❌ Web search should be disabled');
    }
    if (agentNoWebSearch.allowedTools.includes('web_search')) {
      throw new Error('❌ web_search should not be in allowedTools');
    }

    console.log('✅ Agent without web search created correctly\n');

    // Cleanup
    console.log('Cleaning up test agents...');
    await Agent.delete(testAgent.id);
    await Agent.delete(agentNoWebSearch.id);
    console.log('✅ Cleanup complete\n');

    console.log('🎉 All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testAgentCreation();


