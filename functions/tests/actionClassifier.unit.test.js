const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldClassifyAction,
  maybeClassifyActionWrite,
  requestActionClassification
} = require('../src/lib/actionClassifier');

test('shouldClassifyAction allows create writes with missing bounties', () => {
  const result = shouldClassifyAction({
    actionId: 'action_1',
    before: null,
    after: {
      userId: 'user_1',
      title: 'Morning workout',
      notes: '30 min',
      bounties: []
    }
  });

  assert.equal(result.allowed, true);
  assert.equal(result.actionId, 'action_1');
  assert.equal(result.userId, 'user_1');
});

test('shouldClassifyAction skips updates', () => {
  const result = shouldClassifyAction({
    actionId: 'action_1',
    before: { title: 'existing' },
    after: {
      userId: 'user_1',
      title: 'Morning workout',
      bounties: []
    }
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'not-create');
});

test('shouldClassifyAction skips template actions', () => {
  const result = shouldClassifyAction({
    actionId: 'action_1',
    before: null,
    after: {
      userId: 'user_1',
      title: 'Workout',
      templateId: 'tmpl_1',
      bounties: []
    }
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'template-action');
});

test('requestActionClassification returns missing secret when token absent', async () => {
  const result = await requestActionClassification({
    actionId: 'action_1',
    userId: 'user_1',
    internalServiceSecret: null,
    fetchImpl: async () => {
      throw new Error('should-not-run');
    }
  });

  assert.equal(result.attempted, false);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'missing-internal-service-secret');
});

test('maybeClassifyActionWrite issues PATCH classify call', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        action: { id: 'action_1' },
        classificationSummary: {
          matchedPillarIds: ['pillar_1']
        }
      })
    };
  };

  const result = await maybeClassifyActionWrite({
    actionId: 'action_1',
    before: null,
    after: {
      userId: 'user_1',
      title: 'Plan date night',
      bounties: []
    },
    internalServiceSecret: 'secret_1',
    baseUrl: 'https://pillars-phi.vercel.app',
    fetchImpl: fakeFetch,
    logger: {
      warn: () => {}
    }
  });

  assert.equal(result.attempted, true);
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://pillars-phi.vercel.app/api/actions/action_1');
  assert.equal(calls[0].options.method, 'PATCH');
  assert.equal(calls[0].options.headers['x-user-id'], 'user_1');
  assert.match(calls[0].options.body, /"bounties"\s*:\s*null/);
});
