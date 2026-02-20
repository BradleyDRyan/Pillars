/**
 * Pillars Core Entities
 * 
 * - User: A user in the system (app or SMS)
 * - Pillar: A major domain of life (e.g., Work, Relationship, Health)
 * - Principle: Guiding beliefs that define how the user wants to operate
 * - Insight: User-captured experiences, lessons, reflections
 * - Conversation: An ongoing dialogue between user and system
 * - Message: A single turn within a Conversation
 * - OnboardingPillar/Theme/Principle: Global content templates for onboarding
 */

const User = require('./User');
const Pillar = require('./Pillar');
const Principle = require('./Principle');
const Insight = require('./Insight');
const Conversation = require('./Conversation');
const Message = require('./Message');
const { OnboardingPillar, OnboardingTheme, OnboardingPrinciple } = require('./OnboardingContent');

module.exports = {
  User,
  Pillar,
  Principle,
  Insight,
  Conversation,
  Message,
  OnboardingPillar,
  OnboardingTheme,
  OnboardingPrinciple
};
