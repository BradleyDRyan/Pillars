const assert = require('node:assert/strict');
const test = require('node:test');
const admin = require('firebase-admin');

const {
  buildTodoPointEventId,
  reconcileTodoBountyWrite
} = require('../src/lib/todoBounty');

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

function initDb() {
  const suffix = Math.random().toString(36).slice(2, 10);
  const projectId = `demo-bounty-${suffix}`;
  const appName = `todo-bounty-test-${suffix}`;
  const app = admin.initializeApp({ projectId }, appName);
  const db = app.firestore();
  return { app, db };
}

async function seedPillar(db, { userId, pillarId }) {
  await db.collection('pillars').doc(pillarId).set({
    id: pillarId,
    userId,
    name: `Pillar ${pillarId}`,
    createdAt: 1,
    updatedAt: 1
  });
}

async function writeTodo(db, todoId, payload) {
  await db.collection('todos').doc(todoId).set({
    id: todoId,
    ...payload
  });
}

async function readTodo(db, todoId) {
  const doc = await db.collection('todos').doc(todoId).get();
  return doc.exists ? doc.data() : null;
}

async function readPointEvent(db, todoId) {
  const doc = await db.collection('pointEvents').doc(buildTodoPointEventId(todoId)).get();
  return doc.exists ? doc.data() : null;
}

function baseTodo({ userId, pillarId, status = 'active', content = 'Ship trigger' }) {
  return {
    userId,
    status,
    content,
    pillarId,
    dueDate: '2026-02-21',
    bountyPaidAt: null
  };
}

if (!emulatorHost) {
  test('todo bounty trigger emulator tests require FIRESTORE_EMULATOR_HOST', { skip: true }, () => {});
} else {
  test('active -> completed with bountyPoints creates deterministic pointEvent', async () => {
    const { app, db } = initDb();
    try {
      const todoId = 'todo_active_complete_points';
      const userId = 'user_points';
      await seedPillar(db, { userId, pillarId: 'pillar_a' });

      const before = baseTodo({ userId, pillarId: 'pillar_a', status: 'active' });
      const after = {
        ...before,
        status: 'completed',
        bountyPoints: 25
      };
      await writeTodo(db, todoId, after);

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before,
        after,
        nowSeconds: () => 1700000100
      });

      const event = await readPointEvent(db, todoId);
      assert.ok(event);
      assert.equal(event.id, buildTodoPointEventId(todoId));
      assert.equal(event.userId, userId);
      assert.equal(event.ref.type, 'todo');
      assert.equal(event.ref.id, todoId);
      assert.equal(event.totalPoints, 25);
      assert.equal(event.allocations.length, 1);
      assert.equal(event.allocations[0].pillarId, 'pillar_a');
      assert.equal(event.allocations[0].points, 25);
      assert.equal(event.reason, 'Ship trigger');
      assert.equal(event.voidedAt, null);

      const todo = await readTodo(db, todoId);
      assert.equal(todo.bountyPaidAt, 1700000100);
    } finally {
      await app.delete();
    }
  });

  test('active -> completed with bountyAllocations creates split payout', async () => {
    const { app, db } = initDb();
    try {
      const todoId = 'todo_active_complete_split';
      const userId = 'user_split';
      await seedPillar(db, { userId, pillarId: 'pillar_a' });
      await seedPillar(db, { userId, pillarId: 'pillar_b' });

      const before = baseTodo({ userId, pillarId: 'pillar_a', status: 'active' });
      const after = {
        ...before,
        status: 'completed',
        content: 'Deep work block',
        bountyAllocations: [
          { pillarId: 'pillar_a', points: 30 },
          { pillarId: 'pillar_b', points: 20 }
        ]
      };
      await writeTodo(db, todoId, after);

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before,
        after,
        nowSeconds: () => 1700000200
      });

      const event = await readPointEvent(db, todoId);
      assert.ok(event);
      assert.equal(event.totalPoints, 50);
      assert.deepEqual(event.pillarIds, ['pillar_a', 'pillar_b']);
      assert.equal(event.allocations.length, 2);
      assert.equal(event.reason, 'Deep work block');
    } finally {
      await app.delete();
    }
  });

  test('completed -> active voids existing pointEvent and clears bountyPaidAt', async () => {
    const { app, db } = initDb();
    try {
      const todoId = 'todo_complete_active';
      const userId = 'user_void';
      await seedPillar(db, { userId, pillarId: 'pillar_a' });

      const completedTodo = {
        ...baseTodo({ userId, pillarId: 'pillar_a', status: 'completed' }),
        bountyPoints: 40,
        bountyPaidAt: 1700000300
      };

      await writeTodo(db, todoId, completedTodo);
      await db.collection('pointEvents').doc(buildTodoPointEventId(todoId)).set({
        id: buildTodoPointEventId(todoId),
        userId,
        date: '2026-02-21',
        reason: 'Existing payout',
        source: 'system',
        ref: { type: 'todo', id: todoId },
        allocations: [{ pillarId: 'pillar_a', points: 40 }],
        pillarIds: ['pillar_a'],
        totalPoints: 40,
        createdAt: 1700000200,
        updatedAt: 1700000200,
        voidedAt: null
      });

      const activeTodo = {
        ...completedTodo,
        status: 'active'
      };
      await writeTodo(db, todoId, activeTodo);

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before: completedTodo,
        after: activeTodo,
        nowSeconds: () => 1700000400
      });

      const event = await readPointEvent(db, todoId);
      assert.ok(event);
      assert.equal(event.voidedAt, 1700000400);

      const todo = await readTodo(db, todoId);
      assert.equal(todo.bountyPaidAt, null);
    } finally {
      await app.delete();
    }
  });

  test('completed bounty edit auto-adjusts the same pointEvent', async () => {
    const { app, db } = initDb();
    try {
      const todoId = 'todo_complete_adjust';
      const userId = 'user_adjust';
      await seedPillar(db, { userId, pillarId: 'pillar_a' });

      const before = {
        ...baseTodo({ userId, pillarId: 'pillar_a', status: 'completed' }),
        bountyPoints: 10,
        bountyPaidAt: 1700000500
      };
      await writeTodo(db, todoId, before);

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before: null,
        after: before,
        nowSeconds: () => 1700000500
      });

      const after = {
        ...before,
        bountyPoints: 35,
        content: 'Adjusted reward'
      };
      await writeTodo(db, todoId, after);

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before,
        after,
        nowSeconds: () => 1700000600
      });

      const event = await readPointEvent(db, todoId);
      assert.ok(event);
      assert.equal(event.totalPoints, 35);
      assert.equal(event.reason, 'Adjusted reward');

      const todo = await readTodo(db, todoId);
      assert.equal(todo.bountyPaidAt, 1700000500);
    } finally {
      await app.delete();
    }
  });

  test('completed bounty removal voids event and clears bountyPaidAt', async () => {
    const { app, db } = initDb();
    try {
      const todoId = 'todo_complete_remove_bounty';
      const userId = 'user_remove';
      await seedPillar(db, { userId, pillarId: 'pillar_a' });

      const before = {
        ...baseTodo({ userId, pillarId: 'pillar_a', status: 'completed' }),
        bountyPoints: 20,
        bountyPaidAt: 1700000700
      };
      await writeTodo(db, todoId, before);

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before: null,
        after: before,
        nowSeconds: () => 1700000700
      });

      const after = {
        ...before,
        bountyPoints: null,
        bountyAllocations: null,
        bountyPillarId: null
      };
      await writeTodo(db, todoId, after);

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before,
        after,
        nowSeconds: () => 1700000800
      });

      const event = await readPointEvent(db, todoId);
      assert.ok(event);
      assert.equal(event.voidedAt, 1700000800);

      const todo = await readTodo(db, todoId);
      assert.equal(todo.bountyPaidAt, null);
    } finally {
      await app.delete();
    }
  });

  test('idempotent repeated completion writes keep a single deterministic event', async () => {
    const { app, db } = initDb();
    try {
      const todoId = 'todo_idempotent';
      const userId = 'user_idempotent';
      await seedPillar(db, { userId, pillarId: 'pillar_a' });

      const after = {
        ...baseTodo({ userId, pillarId: 'pillar_a', status: 'completed' }),
        bountyPoints: 15
      };
      await writeTodo(db, todoId, after);

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before: null,
        after,
        nowSeconds: () => 1700000900
      });

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before: after,
        after,
        nowSeconds: () => 1700000901
      });

      const snapshot = await db.collection('pointEvents').get();
      assert.equal(snapshot.size, 1);
      const event = snapshot.docs[0].data();
      assert.equal(event.id, buildTodoPointEventId(todoId));
      assert.equal(event.totalPoints, 15);
    } finally {
      await app.delete();
    }
  });

  test('creating a completed todo with bounty creates pointEvent', async () => {
    const { app, db } = initDb();
    try {
      const todoId = 'todo_create_completed';
      const userId = 'user_create_completed';
      await seedPillar(db, { userId, pillarId: 'pillar_a' });

      const after = {
        ...baseTodo({ userId, pillarId: 'pillar_a', status: 'completed' }),
        bountyPoints: 55
      };
      await writeTodo(db, todoId, after);

      await reconcileTodoBountyWrite({
        db,
        todoId,
        before: null,
        after,
        nowSeconds: () => 1700001000
      });

      const event = await readPointEvent(db, todoId);
      assert.ok(event);
      assert.equal(event.totalPoints, 55);
      assert.equal(event.voidedAt, null);
    } finally {
      await app.delete();
    }
  });

  test('invalid bounty pillar creates no payout and leaves bountyPaidAt cleared', async () => {
    const { app, db } = initDb();
    try {
      const todoId = 'todo_invalid_pillar';
      const userId = 'user_invalid';

      const after = {
        ...baseTodo({ userId, pillarId: 'missing_pillar', status: 'completed' }),
        bountyPoints: 30
      };
      await writeTodo(db, todoId, after);

      const result = await reconcileTodoBountyWrite({
        db,
        todoId,
        before: null,
        after,
        nowSeconds: () => 1700001100
      });

      assert.equal(result.action, 'noop');
      const event = await readPointEvent(db, todoId);
      assert.equal(event, null);

      const todo = await readTodo(db, todoId);
      assert.equal(todo.bountyPaidAt, null);
    } finally {
      await app.delete();
    }
  });
}
