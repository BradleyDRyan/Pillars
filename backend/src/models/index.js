/**
 * Pillars Core Entities
 * 
 * The system builds a structured, evolving model of a user's life across these entities:
 * 
 * - Pillar: A major domain of life (e.g., Work, Relationship, Health)
 * - Principle: Guiding beliefs that define how the user wants to operate
 * - Wisdom: User-captured experiences, lessons, reflections, quotes
 * - Resource: External ideas/frameworks (books, podcasts, theories)
 * - Conversation: An ongoing dialogue between user and system
 * - Message: A single turn within a Conversation, linked to entities
 */

// Core Entities
const Pillar = require('./Pillar');
const Principle = require('./Principle');
const Wisdom = require('./Wisdom');
const Resource = require('./Resource');
const Conversation = require('./Conversation');
const Message = require('./Message');

// Supporting Entities
const Agent = require('./Agent');
const Trigger = require('./Trigger');
const Photo = require('./Photo');

// Legacy (being phased out)
const UserTask = require('./UserTask');

module.exports = {
  // Core Entities
  Pillar,
  Principle,
  Wisdom,
  Resource,
  Conversation,
  Message,
  
  // Supporting Entities
  Agent,
  Trigger,
  Photo,
  
  // Legacy
  UserTask
};
