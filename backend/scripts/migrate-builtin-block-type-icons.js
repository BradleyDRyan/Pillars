#!/usr/bin/env node

/**
 * Migration script to update built-in block type icons from emoji to SF Symbols.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { firestore } = require('../src/config/firebase');
const db = firestore;
const { BUILTIN_BLOCK_TYPES } = require('../src/config/builtinBlockTypes');

const iconByTypeId = new Map(BUILTIN_BLOCK_TYPES.map(type => [type.id, type.icon]));

async function migrateBuiltInBlockTypeIcons() {
  const snapshot = await db.collection('blockTypes')
    .where('category', '==', 'built-in')
    .get();

  if (snapshot.empty) {
    console.log('No built-in block types found.');
    return;
  }

  let migrated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const builtInTypeId = data.id;
    const currentIcon = data.icon;
    const nextIcon = iconByTypeId.get(builtInTypeId);

    if (!builtInTypeId || !nextIcon) {
      skipped += 1;
      continue;
    }

    if (currentIcon === nextIcon) {
      skipped += 1;
      continue;
    }

    console.log(`Migrating ${builtInTypeId} (${doc.id}): ${currentIcon || 'unset'} -> ${nextIcon}`);
    await doc.ref.update({
      icon: nextIcon,
      updatedAt: Math.floor(Date.now() / 1000)
    });
    migrated += 1;
  }

  console.log(`Migration complete. Updated: ${migrated}. Skipped: ${skipped}.`);
}

migrateBuiltInBlockTypeIcons()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Built-in block icon migration failed:', error);
    process.exit(1);
  });

