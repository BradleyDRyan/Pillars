#!/usr/bin/env node

/**
 * Test the full API flow for agent creation with web search
 * Simulates: POST /api/agents -> Check response -> Verify web search enabled
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:4310';

async function testAPIFlow() {
  console.log('🧪 Testing Agent Creation API Flow\n');
  console.log(`Using API URL: ${BASE_URL}\n`);

  try {
    // Test 1: Create agent with web search via API
    console.log('Test 1: Creating agent via POST /api/agents with web search...');
    const createResponse = await axios.post(`${BASE_URL}/api/agents`, {
      name: 'AI News Finder',
      description: 'Find the latest news about artificial intelligence',
      enableWebSearch: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (createResponse.status !== 201) {
      throw new Error(`Expected status 201, got ${createResponse.status}`);
    }

    const { agent, conversation, trigger } = createResponse.data;

    console.log('✅ Agent created via API:', {
      id: agent.id,
      name: agent.name,
      enableWebSearch: agent.enableWebSearch,
      allowedTools: agent.allowedTools,
      instructionsLength: agent.instructions?.length || 0
    });

    // Verify web search is enabled
    if (!agent.enableWebSearch) {
      throw new Error('❌ Web search should be enabled');
    }
    if (!agent.allowedTools.includes('web_search')) {
      throw new Error('❌ web_search should be in allowedTools');
    }

    // Verify instructions are short (not from LLM)
    if (agent.instructions && agent.instructions.length > 500) {
      throw new Error('❌ Instructions are too long - should be short template');
    }

    console.log('✅ Web search correctly enabled');
    console.log('✅ Instructions are short and template-based\n');

    // Test 2: Verify conversation was created
    console.log('Test 2: Verifying conversation was created...');
    if (!conversation || !conversation.id) {
      throw new Error('❌ Conversation should be created');
    }
    if (conversation.agentId !== agent.id) {
      throw new Error('❌ Conversation should be linked to agent');
    }
    console.log('✅ Conversation created correctly\n');

    // Test 3: Get agent details
    console.log('Test 3: Getting agent details via GET /api/agents/:id...');
    const getResponse = await axios.get(`${BASE_URL}/api/agents/${agent.id}`);
    
    if (getResponse.status !== 200) {
      throw new Error(`Expected status 200, got ${getResponse.status}`);
    }

    const fetchedAgent = getResponse.data.agent;
    if (fetchedAgent.enableWebSearch !== true) {
      throw new Error('❌ Fetched agent should have web search enabled');
    }
    console.log('✅ Agent details retrieved correctly\n');

    // Test 4: Create agent without web search
    console.log('Test 4: Creating agent without web search...');
    const createNoWebResponse = await axios.post(`${BASE_URL}/api/agents`, {
      name: 'Simple Agent',
      description: 'A simple agent without web search',
      enableWebSearch: false
    });

    const agentNoWeb = createNoWebResponse.data.agent;
    if (agentNoWeb.enableWebSearch) {
      throw new Error('❌ Web search should be disabled');
    }
    if (agentNoWeb.allowedTools.includes('web_search')) {
      throw new Error('❌ web_search should not be in allowedTools');
    }
    console.log('✅ Agent without web search created correctly\n');

    // Cleanup
    console.log('Cleaning up test agents...');
    await axios.delete(`${BASE_URL}/api/agents/${agent.id}`);
    await axios.delete(`${BASE_URL}/api/agents/${agentNoWeb.id}`);
    console.log('✅ Cleanup complete\n');

    console.log('🎉 All API tests passed!');
    console.log('\nSummary:');
    console.log('  ✅ Agent creation with web search works');
    console.log('  ✅ Instructions are generated quickly (template-based)');
    console.log('  ✅ Web search flag is properly set');
    console.log('  ✅ Conversation is created and linked');
    console.log('  ✅ Agent retrieval works');
    console.log('  ✅ Agent creation without web search works');
    
    process.exit(0);
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Connection refused. Is the backend server running?');
      console.error('   Start it with: cd backend && npm run dev');
    } else {
      console.error('❌ Test failed:', error.message);
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the test
testAPIFlow();


