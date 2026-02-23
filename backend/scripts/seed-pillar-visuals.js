/**
 * Seed pillar visual tokens used by iOS/web/Android local renderers.
 *
 * Usage:
 *   node scripts/seed-pillar-visuals.js
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { db } = require('../src/config/firebase');
const { Pillar } = require('../src/models');

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

const COLOR_SEED = [
  { id: 'coral', label: 'Coral', order: 10, isActive: true },
  { id: 'rose', label: 'Rose', order: 20, isActive: true },
  { id: 'violet', label: 'Violet', order: 30, isActive: true },
  { id: 'indigo', label: 'Indigo', order: 40, isActive: true },
  { id: 'blue', label: 'Blue', order: 50, isActive: true },
  { id: 'sky', label: 'Sky', order: 60, isActive: true },
  { id: 'mint', label: 'Mint', order: 70, isActive: true },
  { id: 'green', label: 'Green', order: 80, isActive: true },
  { id: 'lime', label: 'Lime', order: 90, isActive: true },
  { id: 'amber', label: 'Amber', order: 100, isActive: true },
  { id: 'orange', label: 'Orange', order: 110, isActive: true },
  { id: 'slate', label: 'Slate', order: 120, isActive: true }
];

const ICON_DEFAULT_COLOR = Object.freeze({
  heart: 'rose',
  house: 'blue',
  briefcase: 'slate',
  figure2: 'amber',
  dollarsign: 'green',
  brain: 'violet',
  figure: 'mint',
  leaf: 'indigo'
});

function buildIcons() {
  const iconTokens = Array.isArray(Pillar.VALID_ICON_VALUES) ? Pillar.VALID_ICON_VALUES : [];
  return iconTokens.map((token, index) => ({
    id: token,
    label: token,
    defaultColorToken: ICON_DEFAULT_COLOR[token] || null,
    order: index * 10,
    isActive: true
  }));
}

async function run() {
  const ref = db.collection('appConfig').doc('pillarVisuals');
  const updatedAt = nowSeconds();
  const payload = {
    colors: COLOR_SEED,
    icons: buildIcons(),
    updatedAt,
    updatedBy: 'seed-script'
  };

  await ref.set(payload, { merge: false });

  console.log('[seed-pillar-visuals] Complete');
  console.log(`- colors: ${payload.colors.length}`);
  console.log(`- icons: ${payload.icons.length}`);
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[seed-pillar-visuals] Failed:', error);
    process.exit(1);
  });
