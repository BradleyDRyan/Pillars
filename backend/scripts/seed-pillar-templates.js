/**
 * Seed pillar templates used by pillar creation.
 *
 * Usage:
 *   node scripts/seed-pillar-templates.js
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { db } = require('../src/config/firebase');
const { normalizeRubricItemCreate } = require('../src/utils/rubrics');

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

const TEMPLATE_SEED = [
  {
    pillarType: 'marriage',
    name: 'Marriage',
    icon: 'heart',
    colorToken: 'rose',
    order: 10,
    rubric: [
      { activityType: 'Quality Time', tier: 'Light', label: 'Quality Time - Light', points: 10, examples: 'Morning coffee, casual chat' },
      { activityType: 'Quality Time', tier: 'Significant', label: 'Quality Time - Significant', points: 50, examples: 'Date night, day trip together' },
      { activityType: 'Acts of Service', tier: 'Small', label: 'Acts of Service - Small', points: 15, examples: 'Cooked dinner, handled an errand' },
      { activityType: 'Acts of Service', tier: 'Major', label: 'Acts of Service - Major', points: 45, examples: 'Big gesture or project for them' },
      { activityType: 'Gifts', tier: 'Small', label: 'Gifts - Small', points: 30, examples: 'Flowers, favorite snack, small surprise' },
      { activityType: 'Gifts', tier: 'Significant', label: 'Gifts - Significant', points: 50, examples: 'Planned surprise, meaningful gift' },
      { activityType: 'Words of Affirmation', tier: 'Standard', label: 'Words of Affirmation', points: 20, examples: 'Handwritten note, meaningful text, verbal appreciation' },
      { activityType: 'Shared Experience', tier: 'Standard', label: 'Shared Experience', points: 40, examples: 'Tried something new together, traveled' }
    ]
  },
  {
    pillarType: 'physical',
    name: 'Physical',
    icon: 'figure',
    colorToken: 'green',
    order: 20,
    rubric: [
      { activityType: 'Cardio', tier: 'Light', label: 'Cardio - Light', points: 20, examples: 'Walk, easy bike ride' },
      { activityType: 'Cardio', tier: 'Moderate', label: 'Cardio - Moderate', points: 40, examples: 'Jog, swim, moderate cycling' },
      { activityType: 'Cardio', tier: 'Intense', label: 'Cardio - Intense', points: 60, examples: 'HIIT, race training, intense session' },
      { activityType: 'Strength', tier: 'Light', label: 'Strength - Light', points: 25, examples: 'Bodyweight session, quick workout' },
      { activityType: 'Strength', tier: 'Heavy', label: 'Strength - Heavy', points: 50, examples: 'Full gym session, heavy lifting' },
      { activityType: 'Active Recovery', tier: 'Standard', label: 'Active Recovery', points: 15, examples: 'Stretching, yoga, foam rolling' },
      { activityType: 'Nutrition Win', tier: 'Standard', label: 'Nutrition Win', points: 10, examples: 'Meal prepped, hit macro goals, chose healthy option' }
    ]
  },
  {
    pillarType: 'career',
    name: 'Career',
    icon: 'briefcase',
    colorToken: 'slate',
    order: 30,
    rubric: [
      { activityType: 'Deep Work', tier: 'Short', label: 'Deep Work - Short', points: 20, examples: 'Focused session under 1 hour' },
      { activityType: 'Deep Work', tier: 'Long', label: 'Deep Work - Long', points: 40, examples: 'Focused session 1+ hours' },
      { activityType: 'Skill Building', tier: 'Standard', label: 'Skill Building', points: 30, examples: 'Learning, course, reading industry material' },
      { activityType: 'Networking', tier: 'Standard', label: 'Networking', points: 25, examples: 'Meaningful professional conversation, coffee chat' },
      { activityType: 'Milestone', tier: 'Standard', label: 'Milestone', points: 60, examples: 'Shipped something, completed a project, hit a goal' },
      { activityType: 'Admin & Planning', tier: 'Standard', label: 'Admin & Planning', points: 15, examples: 'Organized tasks, updated roadmap, cleared backlog' }
    ]
  },
  {
    pillarType: 'finances',
    name: 'Finances',
    icon: 'dollarsign',
    colorToken: 'blue',
    order: 40,
    rubric: [
      { activityType: 'Budget Check-in', tier: 'Standard', label: 'Budget Check-in', points: 15, examples: 'Reviewed spending, checked accounts' },
      { activityType: 'Financial Planning', tier: 'Standard', label: 'Financial Planning', points: 35, examples: 'Updated budget, set goals, reviewed investments' },
      { activityType: 'Bill / Tax Task', tier: 'Standard', label: 'Bill / Tax Task', points: 20, examples: 'Paid bills, filed paperwork, handled insurance' },
      { activityType: 'Savings Action', tier: 'Standard', label: 'Savings Action', points: 30, examples: 'Transferred to savings, increased contribution' },
      { activityType: 'Financial Deep Dive', tier: 'Standard', label: 'Financial Deep Dive', points: 50, examples: 'Quarterly review, tax planning, major decision' }
    ]
  },
  {
    pillarType: 'house',
    name: 'House',
    icon: 'house',
    colorToken: 'orange',
    order: 50,
    rubric: [
      { activityType: 'Quick Tidy', tier: 'Standard', label: 'Quick Tidy', points: 10, examples: 'Cleaned up, did dishes, basic maintenance' },
      { activityType: 'Cleaning Session', tier: 'Standard', label: 'Cleaning Session', points: 25, examples: 'Deep clean, organized a room' },
      { activityType: 'Home Project', tier: 'Small', label: 'Home Project - Small', points: 20, examples: 'Minor fix, hung something, small improvement' },
      { activityType: 'Home Project', tier: 'Major', label: 'Home Project - Major', points: 50, examples: 'Renovation work, large repair, big upgrade' },
      { activityType: 'Yard / Outdoor', tier: 'Standard', label: 'Yard / Outdoor', points: 20, examples: 'Lawn care, garden, exterior maintenance' }
    ]
  },
  {
    pillarType: 'mental_health',
    name: 'Mental Health',
    icon: 'brain',
    colorToken: 'violet',
    order: 60,
    rubric: [
      { activityType: 'Mindfulness', tier: 'Standard', label: 'Mindfulness', points: 20, examples: 'Meditation, journaling, breathing exercises' },
      { activityType: 'Therapy / Counseling', tier: 'Standard', label: 'Therapy / Counseling', points: 50, examples: 'Attended a session' },
      { activityType: 'Rest & Recovery', tier: 'Standard', label: 'Rest & Recovery', points: 25, examples: 'Intentional downtime, nap, mental health day' },
      { activityType: 'Creative Outlet', tier: 'Standard', label: 'Creative Outlet', points: 30, examples: 'Hobby time, art, music, writing' },
      { activityType: 'Social Connection', tier: 'Standard', label: 'Social Connection', points: 20, examples: 'Meaningful conversation with a friend' }
    ]
  },
  {
    pillarType: 'spiritual',
    name: 'Spiritual',
    icon: 'leaf',
    colorToken: 'indigo',
    order: 70,
    rubric: [
      { activityType: 'Daily Practice', tier: 'Standard', label: 'Daily Practice', points: 15, examples: 'Prayer, devotional, scripture reading' },
      { activityType: 'Extended Practice', tier: 'Standard', label: 'Extended Practice', points: 40, examples: 'Longer study, retreat, deep reflection' },
      { activityType: 'Community', tier: 'Standard', label: 'Community', points: 30, examples: 'Attended service, small group, spiritual conversation' },
      { activityType: 'Service / Generosity', tier: 'Standard', label: 'Service / Generosity', points: 35, examples: 'Volunteered, helped someone, donated' }
    ]
  },
  {
    pillarType: 'fatherhood',
    name: 'Fatherhood',
    icon: 'figure2',
    colorToken: 'amber',
    order: 80,
    rubric: [
      { activityType: 'Quality Time', tier: 'Light', label: 'Quality Time - Light', points: 15, examples: 'Played together, bedtime routine, quick activity' },
      { activityType: 'Quality Time', tier: 'Significant', label: 'Quality Time - Significant', points: 50, examples: 'Planned outing, special day together' },
      { activityType: 'Teaching Moment', tier: 'Standard', label: 'Teaching Moment', points: 25, examples: 'Helped with homework, taught a skill, life lesson' },
      { activityType: 'Caretaking', tier: 'Standard', label: 'Caretaking', points: 20, examples: 'Doctor appointment, school event, handled logistics' },
      { activityType: 'Family Experience', tier: 'Standard', label: 'Family Experience', points: 45, examples: 'Family trip, holiday activity, tradition' }
    ]
  }
];

function buildRubricItems(rawRubric, now) {
  return rawRubric.map(item => {
    const normalized = normalizeRubricItemCreate(item, {
      createdAt: now,
      updatedAt: now
    });
    if (normalized.error) {
      throw new Error(`Invalid rubric item "${item.label || item.activityType}": ${normalized.error}`);
    }
    return normalized.value;
  });
}

async function seedTemplate(template) {
  const ref = db.collection('pillarTemplates').doc(template.pillarType);
  const existing = await ref.get();
  const now = nowSeconds();
  const existingData = existing.exists ? (existing.data() || {}) : {};
  const createdAt = Number.isInteger(existingData.createdAt) ? existingData.createdAt : now;

  const payload = {
    pillarType: template.pillarType,
    name: template.name,
    description: null,
    icon: template.icon,
    colorToken: template.colorToken,
    order: template.order,
    isActive: existingData.isActive !== false,
    rubricItems: buildRubricItems(template.rubric, now),
    createdAt,
    updatedAt: now,
    updatedBy: 'seed-script'
  };

  await ref.set(payload);
  return {
    pillarType: template.pillarType,
    rubricCount: payload.rubricItems.length,
    existed: existing.exists
  };
}

async function run() {
  const results = [];
  for (const template of TEMPLATE_SEED) {
    results.push(await seedTemplate(template));
  }

  console.log('[seed-pillar-templates] Complete');
  for (const result of results) {
    console.log(`- ${result.pillarType} (${result.rubricCount} rubric items) ${result.existed ? 'updated' : 'created'}`);
  }
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[seed-pillar-templates] Failed:', error);
    process.exit(1);
  });
