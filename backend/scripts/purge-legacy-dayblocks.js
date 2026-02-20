#!/usr/bin/env node

const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();

const { db } = require('../src/config/firebase');

const LEGACY_PROJECTED_TYPE_SET = new Set(['todo', 'todos', 'habits', 'morninghabits']);
const LEGACY_TEMPLATE_DEFAULT_NATIVE_TYPE_SET = new Set(['sleep', 'feeling', 'workout', 'reflection']);
const BATCH_DELETE_LIMIT = 450;

function parseArgs(argv) {
  const options = {
    dryRun: false,
    userId: null,
    includeTemplateDefaults: false
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

    if (arg === '--include-template-defaults') {
      options.includeTemplateDefaults = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.userId !== null && !options.userId) {
    throw new Error('user id cannot be empty');
  }

  return options;
}

function isLegacyProjectedType(typeId) {
  if (typeof typeId !== 'string') {
    return false;
  }
  return LEGACY_PROJECTED_TYPE_SET.has(typeId.trim().toLowerCase());
}

function isLegacyTemplateDefaultNativeBlock(data) {
  const normalizedType = typeof data?.typeId === 'string' ? data.typeId.trim().toLowerCase() : '';
  if (!LEGACY_TEMPLATE_DEFAULT_NATIVE_TYPE_SET.has(normalizedType)) {
    return false;
  }

  const normalizedSource = typeof data?.source === 'string' ? data.source.trim().toLowerCase() : '';
  return normalizedSource === 'template';
}

async function loadCandidateDocs(userId, options) {
  let query = db.collection('dayBlocks');
  if (userId) {
    query = query.where('userId', '==', userId);
  }

  const snapshot = await query.get();

  const refs = [];
  let projectedCount = 0;
  let templateDefaultCount = 0;
  snapshot.docs.forEach(doc => {
    const data = doc.data() || {};
    const isProjected = isLegacyProjectedType(data.typeId);
    const isTemplateDefault = options.includeTemplateDefaults && isLegacyTemplateDefaultNativeBlock(data);

    if (isProjected || isTemplateDefault) {
      refs.push(doc.ref);
      if (isProjected) {
        projectedCount += 1;
      } else if (isTemplateDefault) {
        templateDefaultCount += 1;
      }
    }
  });

  return {
    scannedCount: snapshot.size,
    refs,
    projectedCount,
    templateDefaultCount
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scope = options.userId ? `user ${options.userId}` : 'all users';
  const mode = options.includeTemplateDefaults
    ? 'legacy projected + template-generated default native blocks'
    : 'legacy projected blocks';

  console.log(`scanning dayBlocks for ${scope} (${mode})...`);
  const {
    scannedCount,
    refs,
    projectedCount,
    templateDefaultCount
  } = await loadCandidateDocs(options.userId, options);

  console.log(`scanned: ${scannedCount}`);
  console.log(`legacy projected records found: ${projectedCount}`);
  if (options.includeTemplateDefaults) {
    console.log(`template-generated default native records found: ${templateDefaultCount}`);
  }
  console.log(`total candidate records found: ${refs.length}`);

  if (refs.length === 0) {
    console.log('nothing to delete');
    return;
  }

  if (options.dryRun) {
    console.log('dry run complete (no deletes applied)');
    return;
  }

  const deletedCount = await deleteRefsInBatches(refs);
  console.log(`done. deleted ${deletedCount} legacy records.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('purge failed:', error.message || error);
    process.exit(1);
  });
