const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { reconcileHabitLogWrite } = require('./lib/habitBounty');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const onHabitLogWrite = onDocumentWritten(
  {
    document: 'habitLogs/{habitLogId}',
    region: 'us-central1'
  },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const habitLogId = event.params?.habitLogId;

    try {
      const result = await reconcileHabitLogWrite({
        db,
        habitLogId,
        before,
        after,
        logger,
        source: 'system'
      });

      logger.info('[habit-bounty-trigger] processed habitLog write', {
        habitLogId,
        action: result.action,
        reason: result.reason
      });
    } catch (error) {
      logger.error('[habit-bounty-trigger] failed to process habitLog write', {
        habitLogId,
        message: error.message
      });
      throw error;
    }
  }
);

module.exports = {
  onHabitLogWrite
};
