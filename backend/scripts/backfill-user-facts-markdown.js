#!/usr/bin/env node

const admin = require('firebase-admin');
const { db } = require('../src/config/firebase');
const {
  MAX_USER_FACTS,
  parseFactsMarkdown,
  buildFactsMarkdown
} = require('../src/utils/userFactsMarkdown');

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
    }
  }

  return args;
}

function toFactList(value) {
  if (typeof value === 'string') {
    return parseFactsMarkdown(value);
  }
  if (Array.isArray(value)) {
    if (value.some(item => typeof item !== 'string')) {
      return [];
    }
    return parseFactsMarkdown(value.join('\n'));
  }
  return [];
}

function collectFacts(data) {
  const sources = [
    data?.factsMarkdown,
    data?.facts,
    data?.additionalData?.facts,
    data?.profileData?.facts,
    data?.profile?.facts,
    data?.persona?.facts
  ];

  const dedup = new Set();
  const facts = [];
  for (const source of sources) {
    const list = toFactList(source);
    for (const fact of list) {
      const key = fact.toLowerCase();
      if (dedup.has(key)) {
        continue;
      }
      dedup.add(key);
      facts.push(fact);
      if (facts.length >= MAX_USER_FACTS) {
        return facts;
      }
    }
  }

  return facts;
}

function hasLegacyFactFields(data) {
  return (
    data?.facts !== undefined ||
    data?.additionalData?.facts !== undefined ||
    data?.profileData?.facts !== undefined ||
    data?.profile?.facts !== undefined ||
    data?.persona?.facts !== undefined
  );
}

async function getUserDocs(userId) {
  if (userId) {
    const doc = await db.collection('users').doc(userId).get();
    return doc.exists ? [doc] : [];
  }
  const snapshot = await db.collection('users').get();
  return snapshot.docs;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  console.log('[backfill-user-facts-markdown] starting', args);

  let docs = await getUserDocs(args.userId);
  if (args.limit && docs.length > args.limit) {
    docs = docs.slice(0, args.limit);
  }

  const summary = {
    scanned: docs.length,
    updated: 0,
    skipped: 0,
    errors: 0
  };

  for (const doc of docs) {
    const data = doc.data() || {};
    const mergedFacts = collectFacts(data);
    const nextMarkdown = buildFactsMarkdown(mergedFacts);
    const currentMarkdown = buildFactsMarkdown(toFactList(data.factsMarkdown));
    const legacyPresent = hasLegacyFactFields(data);

    const shouldUpdate = legacyPresent || nextMarkdown !== currentMarkdown;
    if (!shouldUpdate) {
      summary.skipped += 1;
      continue;
    }

    const updatePayload = {
      updatedAt: new Date().toISOString(),
      facts: admin.firestore.FieldValue.delete(),
      'additionalData.facts': admin.firestore.FieldValue.delete(),
      'profileData.facts': admin.firestore.FieldValue.delete(),
      'profile.facts': admin.firestore.FieldValue.delete(),
      'persona.facts': admin.firestore.FieldValue.delete()
    };
    updatePayload.factsMarkdown = nextMarkdown ?? admin.firestore.FieldValue.delete();

    if (args.dryRun) {
      summary.updated += 1;
      console.log('[backfill-user-facts-markdown] dry-run', {
        userId: doc.id,
        factsCount: mergedFacts.length,
        hasMarkdown: Boolean(nextMarkdown)
      });
      continue;
    }

    try {
      await doc.ref.update(updatePayload);
      summary.updated += 1;
    } catch (error) {
      summary.errors += 1;
      console.error('[backfill-user-facts-markdown] failed', {
        userId: doc.id,
        message: error.message
      });
    }
  }

  console.log('[backfill-user-facts-markdown] complete', summary);
}

run().catch(error => {
  console.error('[backfill-user-facts-markdown] fatal', error);
  process.exit(1);
});
