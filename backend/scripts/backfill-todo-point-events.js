#!/usr/bin/env node

const { db } = require('../src/config/firebase');
const {
  buildTodoPointEventId,
  reconcileTodoBountyWrite,
  resolveTodoPayout
} = require('../../functions/src/lib/todoBounty');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: null,
    userId: null
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length));
      if (Number.isInteger(parsed) && parsed > 0) {
        args.limit = parsed;
      }
      continue;
    }

    if (arg.startsWith('--userId=')) {
      const value = arg.slice('--userId='.length).trim();
      args.userId = value || null;
      continue;
    }
  }

  return args;
}

async function predictAction(todoId, todo) {
  const userId = typeof todo.userId === 'string' ? todo.userId.trim() : null;
  if (!userId) {
    return { action: 'skipped', reason: 'missing-user-id' };
  }

  const payout = await resolveTodoPayout({ db, todo, userId, logger: console });
  const eventDoc = await db.collection('pointEvents').doc(buildTodoPointEventId(todoId)).get();
  const event = eventDoc.exists ? eventDoc.data() || {} : null;
  const hasPaidAt = typeof todo.bountyPaidAt === 'number';

  if (payout.allocations) {
    if (!event || event.voidedAt || !hasPaidAt) {
      return { action: 'would-pay', reason: 'completed-with-valid-bounty' };
    }
    return { action: 'noop', reason: 'already-paid' };
  }

  if ((event && !event.voidedAt) || hasPaidAt) {
    return { action: 'would-void', reason: payout.diagnostic || 'no-valid-bounty' };
  }

  return { action: 'noop', reason: payout.diagnostic || 'no-bounty' };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  console.log('[backfill-todo-point-events] starting', args);

  let query = db.collection('todos').where('status', '==', 'completed');
  if (args.userId) {
    query = query.where('userId', '==', args.userId);
  }

  const snapshot = await query.get();
  let docs = snapshot.docs;

  if (args.limit && docs.length > args.limit) {
    docs = docs.slice(0, args.limit);
  }

  const summary = {
    scanned: docs.length,
    paid: 0,
    voided: 0,
    noop: 0,
    skipped: 0,
    wouldPay: 0,
    wouldVoid: 0,
    errors: 0
  };

  for (const doc of docs) {
    const todoId = doc.id;
    const todo = { id: todoId, ...doc.data() };

    try {
      if (args.dryRun) {
        const prediction = await predictAction(todoId, todo);
        if (prediction.action === 'would-pay') {
          summary.wouldPay += 1;
        } else if (prediction.action === 'would-void') {
          summary.wouldVoid += 1;
        } else if (prediction.action === 'skipped') {
          summary.skipped += 1;
        } else {
          summary.noop += 1;
        }

        console.log('[backfill-todo-point-events] dry-run', {
          todoId,
          action: prediction.action,
          reason: prediction.reason
        });
        continue;
      }

      const result = await reconcileTodoBountyWrite({
        db,
        todoId,
        before: null,
        after: todo,
        logger: console,
        source: 'system'
      });

      if (result.action === 'paid') {
        summary.paid += 1;
      } else if (result.action === 'voided') {
        summary.voided += 1;
      } else if (result.action === 'noop') {
        summary.noop += 1;
      } else {
        summary.skipped += 1;
      }

      console.log('[backfill-todo-point-events] applied', {
        todoId,
        action: result.action,
        reason: result.reason
      });
    } catch (error) {
      summary.errors += 1;
      console.error('[backfill-todo-point-events] failed', {
        todoId,
        message: error.message
      });
    }
  }

  console.log('[backfill-todo-point-events] complete', summary);
}

run().catch((error) => {
  console.error('[backfill-todo-point-events] fatal', error);
  process.exit(1);
});
