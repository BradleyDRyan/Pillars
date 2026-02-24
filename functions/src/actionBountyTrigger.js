const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { maybeClassifyActionWrite } = require('./lib/actionClassifier');
const { reconcileActionWrite } = require('./lib/actionBounty');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const internalServiceSecret = defineSecret('INTERNAL_SERVICE_SECRET');

const onActionWrite = onDocumentWritten(
  {
    document: 'actions/{actionId}',
    region: 'us-central1',
    secrets: [internalServiceSecret]
  },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const actionId = event.params?.actionId;

    try {
      logger.info('[action-bounty-trigger] received action write', {
        actionId,
        beforeExists: Boolean(before),
        afterExists: Boolean(after),
        beforeStatus: before?.status ?? null,
        afterStatus: after?.status ?? null,
        beforeUserId: before?.userId ?? null,
        afterUserId: after?.userId ?? null,
        beforeTargetDate: before?.targetDate ?? null,
        afterTargetDate: after?.targetDate ?? null
      });

      const classificationResult = await maybeClassifyActionWrite({
        actionId,
        before,
        after,
        internalServiceSecret: internalServiceSecret.value(),
        logger
      });

      logger.info('[action-bounty-trigger] classifier step complete', {
        actionId,
        attempted: Boolean(classificationResult?.attempted),
        success: Boolean(classificationResult?.success),
        reason: classificationResult?.reason || null,
        status: classificationResult?.status || null,
        matchedPillarIds: classificationResult?.classificationSummary?.matchedPillarIds || null,
        trimmedPillarIds: classificationResult?.classificationSummary?.trimmedPillarIds || null,
        modelUsed: classificationResult?.classificationSummary?.modelUsed || null
      });

      let afterForReconcile = after;
      if (classificationResult?.success && after) {
        const latestDoc = await db.collection('actions').doc(actionId).get();
        if (latestDoc.exists) {
          afterForReconcile = latestDoc.data();
        }
      }

      const result = await reconcileActionWrite({
        db,
        actionId,
        before,
        after: afterForReconcile,
        logger,
        source: 'system'
      });

      logger.info('[action-bounty-trigger] processed action write', {
        actionId,
        action: result.action,
        reason: result.reason,
        pointEventId: result.pointEventId || null
      });
    } catch (error) {
      logger.error('[action-bounty-trigger] failed to process action write', {
        actionId,
        message: error.message
      });
      throw error;
    }
  }
);

module.exports = {
  onActionWrite
};
