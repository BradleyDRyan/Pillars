/**
 * Seed Trigger Templates
 * 
 * Run with: node scripts/seed-trigger-templates.js
 */

require('dotenv').config();
const { db, FieldValue } = require('../src/config/firebase');

const templates = [
  {
    id: 'morning-checkin',
    name: 'Morning Check-in',
    description: 'Daily morning motivation and planning prompt',
    type: 'schedule',
    defaultCron: '0 9 * * *',  // 9am daily
    defaultTimezone: 'user',
    messageTemplate: null,    // AI generated
    enabled: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  },
  {
    id: 'evening-reflection',
    name: 'Evening Reflection',
    description: 'End of day reflection and gratitude prompt',
    type: 'schedule',
    defaultCron: '0 20 * * *',  // 8pm daily
    defaultTimezone: 'user',
    messageTemplate: null,
    enabled: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Sunday weekly review and planning',
    type: 'schedule',
    defaultCron: '0 10 * * 0',  // 10am Sundays
    defaultTimezone: 'user',
    messageTemplate: null,
    enabled: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  },
  {
    id: 'midday-momentum',
    name: 'Midday Momentum',
    description: 'Quick midday check-in to maintain focus',
    type: 'schedule',
    defaultCron: '0 13 * * 1-5',  // 1pm weekdays
    defaultTimezone: 'user',
    messageTemplate: null,
    enabled: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }
];

async function seedTemplates() {
  console.log('Seeding trigger templates...');
  
  const batch = db.batch();
  
  for (const template of templates) {
    const { id, ...data } = template;
    const ref = db.collection('triggerTemplates').doc(id);
    
    // Use set with merge to update existing or create new
    batch.set(ref, data, { merge: true });
    console.log(`  - ${id}: ${template.name}`);
  }
  
  await batch.commit();
  console.log(`\nSuccessfully seeded ${templates.length} trigger templates.`);
}

seedTemplates()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error seeding templates:', error);
    process.exit(1);
  });
