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
    const beforeStatus = typeof before?.status === 'string' ? before.status : null;
    const afterStatus = typeof after?.status === 'string' ? after.status : null;
    const beforeCompleted = typeof before?.completed === 'boolean' ? before.completed : null;
    const afterCompleted = typeof after?.completed === 'boolean' ? after.completed : null;

    try {
      logger.info('[habit-bounty-trigger] received habitLog write', {
        habitLogId,
        beforeExists: Boolean(before),
        afterExists: Boolean(after),
        beforeStatus,
        afterStatus,
        beforeCompleted,
        afterCompleted,
        beforeUserId: before?.userId ?? null,
        afterUserId: after?.userId ?? null,
        beforeHabitId: before?.habitId ?? null,
        afterHabitId: after?.habitId ?? null,
        beforeDate: before?.date ?? null,
        afterDate: after?.date ?? null
      });

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
        reason: result.reason,
        pointEventId: result.pointEventId || null,
        beforeStatus,
        afterStatus
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
