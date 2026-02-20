function createInvalidPillarIdError() {
  const error = new Error('Invalid pillarId');
  error.status = 400;
  return error;
}

async function resolveValidatedPillarId({ db, userId, pillarId }) {
  if (pillarId === undefined) {
    return undefined;
  }

  if (pillarId === null) {
    return null;
  }

  if (typeof pillarId !== 'string') {
    throw createInvalidPillarIdError();
  }

  const normalized = pillarId.trim();
  if (!normalized) {
    return null;
  }

  const pillarDoc = await db.collection('pillars').doc(normalized).get();
  if (!pillarDoc.exists) {
    throw createInvalidPillarIdError();
  }

  const pillar = pillarDoc.data() || {};
  if (pillar.userId !== userId) {
    throw createInvalidPillarIdError();
  }

  return normalized;
}

module.exports = {
  resolveValidatedPillarId,
  createInvalidPillarIdError
};
