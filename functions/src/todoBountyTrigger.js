const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { reconcileTodoBountyWrite } = require('./lib/todoBounty');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const onTodoWrite = onDocumentWritten(
  {
    document: 'todos/{todoId}',
    region: 'us-central1'
  },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const todoId = event.params?.todoId;

    try {
      const result = await reconcileTodoBountyWrite({
        db,
        todoId,
        before,
        after,
        logger,
        source: 'system'
      });

      logger.info('[todo-bounty-trigger] processed todo write', {
        todoId,
        action: result.action,
        reason: result.reason
      });
    } catch (error) {
      logger.error('[todo-bounty-trigger] failed to process todo write', {
        todoId,
        message: error.message
      });
      throw error;
    }
  }
);

module.exports = {
  onTodoWrite
};
