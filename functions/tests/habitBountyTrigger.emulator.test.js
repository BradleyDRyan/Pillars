const assert = require('node:assert/strict');
const test = require('node:test');
const admin = require('firebase-admin');

const {
  buildHabitPointEventId,
  reconcileHabitLogWrite
} = require('../src/lib/habitBounty');

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

function initDb() {
  const suffix = Math.random().toString(36).slice(2, 10);
  const projectId = `demo-habit-bounty-${suffix}`;
  const appName = `habit-bounty-test-${suffix}`;
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

async function seedHabit(db, habitId, payload) {
  await db.collection('habits').doc(habitId).set({
    id: habitId,
    ...payload
  });
}

async function writeLog(db, logId, payload) {
  await db.collection('habitLogs').doc(logId).set({
    id: logId,
    ...payload
  });
}

async function deleteLog(db, logId) {
  await db.collection('habitLogs').doc(logId).delete();
}

async function readPointEvent(db, habitId, date) {
  const doc = await db.collection('pointEvents').doc(buildHabitPointEventId(habitId, date)).get();
  return doc.exists ? doc.data() : null;
}

function baseLog({ userId, habitId, date, status = 'pending', completed = false }) {
  return {
    userId,
    habitId,
    date,
    status,
    completed
  };
}

if (!emulatorHost) {
  test('habit bounty trigger emulator tests require FIRESTORE_EMULATOR_HOST', { skip: true }, () => {});
} else {
  test('pending -> completed creates deterministic pointEvent from habit bountyPoints', async () => {
    const { app, db } = initDb();
    try {
      const userId = 'habit_user_a';
      const habitId = 'habit_make_bed';
      const date = '2026-02-21';
      const logId = `${habitId}_${date}`;

      await seedPillar(db, { userId, pillarId: 'pillar_health' });
      await seedHabit(db, habitId, {
        userId,
        name: 'Make my bed',
        pillarId: 'pillar_health',
        bountyPoints: 5
      });

      const before = baseLog({ userId, habitId, date, status: 'pending', completed: false });
      const after = baseLog({ userId, habitId, date, status: 'completed', completed: true });
      await writeLog(db, logId, after);

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before,
        after,
        nowSeconds: () => 1700001000
      });

      const event = await readPointEvent(db, habitId, date);
      assert.ok(event);
      assert.equal(event.id, buildHabitPointEventId(habitId, date));
      assert.equal(event.userId, userId);
      assert.equal(event.ref.type, 'habit');
      assert.equal(event.ref.id, habitId);
      assert.equal(event.totalPoints, 5);
      assert.equal(event.allocations.length, 1);
      assert.equal(event.allocations[0].pillarId, 'pillar_health');
      assert.equal(event.allocations[0].points, 5);
      assert.equal(event.voidedAt, null);
    } finally {
      await app.delete();
    }
  });

  test('completed -> pending voids existing pointEvent', async () => {
    const { app, db } = initDb();
    try {
      const userId = 'habit_user_b';
      const habitId = 'habit_walk';
      const date = '2026-02-21';
      const logId = `${habitId}_${date}`;

      await seedPillar(db, { userId, pillarId: 'pillar_health' });
      await seedHabit(db, habitId, {
        userId,
        name: 'Go for a walk',
        pillarId: 'pillar_health',
        bountyPoints: 10
      });

      const completed = baseLog({ userId, habitId, date, status: 'completed', completed: true });
      await writeLog(db, logId, completed);

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before: null,
        after: completed,
        nowSeconds: () => 1700001100
      });

      const pending = baseLog({ userId, habitId, date, status: 'pending', completed: false });
      await writeLog(db, logId, pending);

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before: completed,
        after: pending,
        nowSeconds: () => 1700001200
      });

      const event = await readPointEvent(db, habitId, date);
      assert.ok(event);
      assert.equal(event.voidedAt, 1700001200);
    } finally {
      await app.delete();
    }
  });

  test('completed log with bountyAllocations creates split payout', async () => {
    const { app, db } = initDb();
    try {
      const userId = 'habit_user_c';
      const habitId = 'habit_mobility';
      const date = '2026-02-21';
      const logId = `${habitId}_${date}`;

      await seedPillar(db, { userId, pillarId: 'pillar_health' });
      await seedPillar(db, { userId, pillarId: 'pillar_family' });
      await seedHabit(db, habitId, {
        userId,
        name: 'Stretching',
        bountyAllocations: [
          { pillarId: 'pillar_health', points: 7 },
          { pillarId: 'pillar_family', points: 3 }
        ],
        bountyReason: 'Mobility stack'
      });

      const after = baseLog({ userId, habitId, date, status: 'completed', completed: true });
      await writeLog(db, logId, after);

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before: null,
        after,
        nowSeconds: () => 1700001300
      });

      const event = await readPointEvent(db, habitId, date);
      assert.ok(event);
      assert.equal(event.totalPoints, 10);
      assert.deepEqual(event.pillarIds, ['pillar_health', 'pillar_family']);
      assert.equal(event.reason, 'Mobility stack');
    } finally {
      await app.delete();
    }
  });

  test('completed log with no bounty creates no pointEvent', async () => {
    const { app, db } = initDb();
    try {
      const userId = 'habit_user_d';
      const habitId = 'habit_journal';
      const date = '2026-02-21';
      const logId = `${habitId}_${date}`;

      await seedPillar(db, { userId, pillarId: 'pillar_mind' });
      await seedHabit(db, habitId, {
        userId,
        name: 'Journal',
        pillarId: 'pillar_mind'
      });

      const after = baseLog({ userId, habitId, date, status: 'completed', completed: true });
      await writeLog(db, logId, after);

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before: null,
        after,
        nowSeconds: () => 1700001400
      });

      const event = await readPointEvent(db, habitId, date);
      assert.equal(event, null);
    } finally {
      await app.delete();
    }
  });

  test('invalid bounty pillar produces no payout', async () => {
    const { app, db } = initDb();
    try {
      const userId = 'habit_user_e';
      const habitId = 'habit_invalid';
      const date = '2026-02-21';
      const logId = `${habitId}_${date}`;

      await seedPillar(db, { userId, pillarId: 'pillar_valid' });
      await seedHabit(db, habitId, {
        userId,
        name: 'Invalid bounty',
        bountyPoints: 9,
        bountyPillarId: 'pillar_missing'
      });

      const after = baseLog({ userId, habitId, date, status: 'completed', completed: true });
      await writeLog(db, logId, after);

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before: null,
        after,
        nowSeconds: () => 1700001500
      });

      const event = await readPointEvent(db, habitId, date);
      assert.equal(event, null);
    } finally {
      await app.delete();
    }
  });

  test('repeated identical completion write remains idempotent', async () => {
    const { app, db } = initDb();
    try {
      const userId = 'habit_user_f';
      const habitId = 'habit_idempotent';
      const date = '2026-02-21';
      const logId = `${habitId}_${date}`;

      await seedPillar(db, { userId, pillarId: 'pillar_health' });
      await seedHabit(db, habitId, {
        userId,
        name: 'Hydration',
        pillarId: 'pillar_health',
        bountyPoints: 4
      });

      const after = baseLog({ userId, habitId, date, status: 'completed', completed: true });
      await writeLog(db, logId, after);

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before: null,
        after,
        nowSeconds: () => 1700001600
      });

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before: after,
        after,
        nowSeconds: () => 1700001601
      });

      const snapshot = await db.collection('pointEvents').get();
      assert.equal(snapshot.size, 1);
      const event = snapshot.docs[0].data();
      assert.equal(event.id, buildHabitPointEventId(habitId, date));
      assert.equal(event.totalPoints, 4);
    } finally {
      await app.delete();
    }
  });

  test('deleting a completed log voids existing pointEvent', async () => {
    const { app, db } = initDb();
    try {
      const userId = 'habit_user_g';
      const habitId = 'habit_delete_log';
      const date = '2026-02-21';
      const logId = `${habitId}_${date}`;

      await seedPillar(db, { userId, pillarId: 'pillar_health' });
      await seedHabit(db, habitId, {
        userId,
        name: 'Read',
        pillarId: 'pillar_health',
        bountyPoints: 6
      });

      const after = baseLog({ userId, habitId, date, status: 'completed', completed: true });
      await writeLog(db, logId, after);

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before: null,
        after,
        nowSeconds: () => 1700001700
      });

      await deleteLog(db, logId);

      await reconcileHabitLogWrite({
        db,
        habitLogId: logId,
        before: after,
        after: null,
        nowSeconds: () => 1700001800
      });

      const event = await readPointEvent(db, habitId, date);
      assert.ok(event);
      assert.equal(event.voidedAt, 1700001800);
    } finally {
      await app.delete();
    }
  });
}
