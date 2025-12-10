const { logger } = require('../config/firebase');
const Entry = require('../models/Entry');
const Conversation = require('../models/Conversation');

const resolveProjectId = async ({ userId, requestedProjectId, conversationId }) => {
  if (requestedProjectId) {
    return requestedProjectId;
  }

  if (conversationId) {
    const conversation = await Conversation.findById(conversationId);
    if (conversation?.projectIds?.length) {
      return conversation.projectIds[0];
    }
  }

  return null;
};

const savePlanNote = async ({
  userId,
  conversationId,
  projectId,
  title,
  summary,
  markdown,
  tasks = [],
  metadata = {}
}) => {
  if (!userId || !markdown) {
    logger.warn('[planService] Missing userId or markdown content, skipping persistence.');
    return null;
  }

  const resolvedProjectId = await resolveProjectId({
    userId,
    requestedProjectId: projectId,
    conversationId
  });

  const entry = await Entry.create({
    userId,
    conversationId: conversationId || null,
    projectIds: resolvedProjectId ? [resolvedProjectId] : [],
    title: title || 'Generated Plan',
    content: markdown,
    type: 'plan',
    metadata: {
      summary: summary || null,
      tasks,
      createdBy: 'tool:create_plan',
      ...metadata
    }
  });

  logger.info(
    {
      entryId: entry.id,
      userId,
      projectId: resolvedProjectId
    },
    '[planService] Plan note saved'
  );

  return {
    entryId: entry.id,
    projectId: resolvedProjectId
  };
};

module.exports = {
  savePlanNote
};


