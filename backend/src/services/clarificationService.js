const { firestore, logger } = require('../config/firebase');

const COLLECTION = 'clarificationRequests';
const DEFAULT_EXPIRATION_HOURS = 24;

const clarificationCollection = () => firestore.collection(COLLECTION);

const createClarificationRequest = async ({
  userId,
  conversationId,
  toolCallId,
  payload,
  expiresInHours = DEFAULT_EXPIRATION_HOURS
}) => {
  if (!conversationId) {
    throw new Error('conversationId is required to create clarification request');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

  const docRef = await clarificationCollection().add({
    userId: userId || null,
    conversationId,
    toolCallId: toolCallId || null,
    payload,
    status: 'pending',
    createdAt: now,
    expiresAt
  });

  logger.info(
    {
      id: docRef.id,
      conversationId
    },
    '[clarificationService] Clarification request created'
  );

  return {
    id: docRef.id,
    expiresAt,
    expiresAtIso: expiresAt.toISOString(),
    payload
  };
};

module.exports = {
  createClarificationRequest,
  DEFAULT_EXPIRATION_HOURS
};

