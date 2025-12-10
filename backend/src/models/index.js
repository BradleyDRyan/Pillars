/**
 * Pillars Core Entities
 * 
 * - Pillar: A major domain of life (e.g., Work, Relationship, Health)
 * - Principle: Guiding beliefs that define how the user wants to operate
 * - Insight: User-captured experiences, lessons, reflections
 * - Conversation: An ongoing dialogue between user and system
 * - Message: A single turn within a Conversation
 */

const Pillar = require('./Pillar');
const Principle = require('./Principle');
const Insight = require('./Insight');
const Conversation = require('./Conversation');
const Message = require('./Message');

module.exports = {
  Pillar,
  Principle,
  Insight,
  Conversation,
  Message
};
