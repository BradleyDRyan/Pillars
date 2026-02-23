/**
 * Pillars Core Entities
 * 
 * - User: A user in the system (app or SMS)
 * - Pillar: A major domain of life (e.g., Work, Relationship, Health)
 * - Principle: Guiding beliefs that define how the user wants to operate
 * - Insight: User-captured experiences, lessons, reflections
 * - Conversation: An ongoing dialogue between user and system
 * - Message: A single turn within a Conversation
 * - OnboardingPillar/Principle: Global content templates for onboarding
 * - Agent: AI agents that can be invoked via @ mentions
 * - AdminConversation/AdminMessage: Admin chat with block sequencing
 */

const User = require('./User');
const Pillar = require('./Pillar');
const Principle = require('./Principle');
const Insight = require('./Insight');
const Conversation = require('./Conversation');
const Message = require('./Message');
const { OnboardingPillar, OnboardingPrinciple } = require('./OnboardingContent');
const Agent = require('./Agent');
const AdminConversation = require('./AdminConversation');
const AdminMessage = require('./AdminMessage');
const Room = require('./Room');
const RoomMessage = require('./RoomMessage');
const AgentDraft = require('./AgentDraft');
const PillarTemplate = require('./PillarTemplate');

module.exports = {
  User,
  Pillar,
  Principle,
  Insight,
  Conversation,
  Message,
  OnboardingPillar,
  OnboardingPrinciple,
  Agent,
  AdminConversation,
  AdminMessage,
  Room,
  RoomMessage,
  AgentDraft,
  PillarTemplate
};
