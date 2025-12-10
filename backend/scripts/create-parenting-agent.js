const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();

// Use the existing Firebase initialization from config
require('../src/config/firebase');

const { Agent, Conversation, Message, Trigger } = require('../src/models');
const { generateInstructions } = require('../src/services/instructionGenerator');

async function createParentingAgent() {
  try {
    const userId = 'admin-user'; // Default user ID
    const name = 'Parenting Advisor';
    const description = 'Provide helpful, evidence-based parenting advice on topics like child development, discipline strategies, sleep training, feeding, education, and emotional support. Be empathetic, practical, and age-appropriate in your guidance.';

    console.log('Creating parenting advice agent...');
    console.log(`Name: ${name}`);
    console.log(`Description: ${description}`);

    // Generate instructions from description
    let instructions;
    try {
      instructions = await generateInstructions(description);
      console.log('Generated instructions successfully');
    } catch (error) {
      console.error('Failed to generate instructions, using fallback:', error);
      instructions = `You are a helpful parenting advisor. Your task is to: ${description.trim()}\n\nProvide empathetic, evidence-based advice on parenting topics including child development, discipline, sleep, feeding, education, and emotional support. Always consider the child's age and individual needs when giving advice.`;
    }

    // Create conversation for the agent
    const conversation = await Conversation.create({
      userId,
      agentId: null, // Will be set after agent creation
      title: name.trim(),
      lastMessage: null
    });
    console.log(`Created conversation: ${conversation.id}`);

    // Create agent
    const agent = await Agent.create({
      userId,
      name: name.trim(),
      description: description.trim(),
      instructions,
      model: null,
      enableWebSearch: true, // Enable web search for parenting advice
      conversationId: conversation.id,
      metadata: {
        createdBy: 'script',
        category: 'parenting'
      }
    });
    console.log(`Created agent: ${agent.id}`);

    // Update conversation with agentId
    conversation.agentId = agent.id;
    await conversation.save();

    // Create initial message from user (the description)
    await Message.create({
      conversationId: conversation.id,
      userId,
      sender: userId,
      content: description.trim(),
      type: 'text',
      role: 'user',
      metadata: {
        isInitialMessage: true
      }
    });
    console.log('Created initial message');

    // Create default trigger
    const triggerSchedule = 'daily:10:00';
    const trigger = await Trigger.create({
      agentId: agent.id,
      type: 'time_based',
      schedule: triggerSchedule,
      enabled: true,
      metadata: {
        createdBy: 'script',
        isDefault: true
      }
    });
    console.log(`Created trigger: ${trigger.id}`);

    console.log('\n✅ Parenting advice agent created successfully!');
    console.log(`Agent ID: ${agent.id}`);
    console.log(`Conversation ID: ${conversation.id}`);
    console.log(`Trigger ID: ${trigger.id}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create parenting agent:', error);
    process.exit(1);
  }
}

createParentingAgent();

