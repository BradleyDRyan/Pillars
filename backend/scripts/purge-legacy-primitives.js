#!/usr/bin/env node

const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();

const { db } = require('../src/config/firebase');

const BATCH_DELETE_LIMIT = 450;
const LEGACY_BLOCK_TYPE_IDS = new Set(['todo', 'todos', 'habits', 'morninghabits']);

function parseArgs(argv) {
  const options = {
    dryRun: false,
    userId: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--user-id' || arg === '--userId') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error(`${arg} requires a value`);
      }
      options.userId = nextValue.trim();
      index += 1;
      continue;
    }

    if (arg.startsWith('--user-id=')) {
      options.userId = arg.slice('--user-id='.length).trim();
      continue;
    }

    if (arg.startsWith('--userId=')) {
      options.userId = arg.slice('--userId='.length).trim();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.userId !== null && !options.userId) {
    throw new Error('user id cannot be empty');
  }

  return options;
}

async function loadCollectionRefs({ collectionName, userId, includeDoc }) {
  let query = db.collection(collectionName);
  if (userId) {
    query = query.where('userId', '==', userId);
  }

  const snapshot = await query.get();
  const refs = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data() || {};
    if (includeDoc && !includeDoc(data, doc.id)) {
      return;
    }
    refs.push(doc.ref);
  });

  return {
    scannedCount: snapshot.size,
    refs
  };
}

async function deleteRefsInBatches(refs) {
  let deletedCount = 0;

  for (let offset = 0; offset < refs.length; offset += BATCH_DELETE_LIMIT) {
    const batch = db.batch();
    const chunk = refs.slice(offset, offset + BATCH_DELETE_LIMIT);

    chunk.forEach(ref => batch.delete(ref));
    await batch.commit();
    deletedCount += chunk.length;
    console.log(`deleted ${deletedCount}/${refs.length}`);
  }

  return deletedCount;
}

async function purgeCollection({ collectionName, userId, dryRun, includeDoc }) {
  const { scannedCount, refs } = await loadCollectionRefs({
    collectionName,
    userId,
    includeDoc
  });

  console.log(`[${collectionName}] scanned=${scannedCount} candidates=${refs.length}`);
  if (!refs.length || dryRun) {
    return { collectionName, scannedCount, deletedCount: 0, candidateCount: refs.length };
  }

  const deletedCount = await deleteRefsInBatches(refs);
  return { collectionName, scannedCount, deletedCount, candidateCount: refs.length };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scope = options.userId ? `user ${options.userId}` : 'all users';

  console.log(`purging legacy primitives for ${scope}${options.dryRun ? ' (dry run)' : ''}...`);

  const plans = [
    { collectionName: 'todos' },
    { collectionName: 'habits' },
    { collectionName: 'habitLogs' },
    { collectionName: 'dayBlocks' },
    { collectionName: 'dayTemplates' },
    {
      collectionName: 'blockTypes',
      includeDoc: (data, docId) => {
        const id = typeof data?.id === 'string' ? data.id.trim().toLowerCase() : String(docId || '').toLowerCase();
        return LEGACY_BLOCK_TYPE_IDS.has(id);
      }
    }
  ];

  const results = [];
  for (const plan of plans) {
    // eslint-disable-next-line no-await-in-loop
    const result = await purgeCollection({
      collectionName: plan.collectionName,
      userId: options.userId,
      dryRun: options.dryRun,
      includeDoc: plan.includeDoc
    });
    results.push(result);
  }

  const totalCandidates = results.reduce((sum, item) => sum + item.candidateCount, 0);
  const totalDeleted = results.reduce((sum, item) => sum + item.deletedCount, 0);

  console.log('--- summary ---');
  results.forEach(result => {
    console.log(`[${result.collectionName}] candidates=${result.candidateCount} deleted=${result.deletedCount}`);
  });
  console.log(`totalCandidates=${totalCandidates}`);
  console.log(`totalDeleted=${totalDeleted}`);

  if (options.dryRun) {
    console.log('dry run complete (no deletes applied)');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('purge failed:', error.message || error);
    process.exit(1);
  });
