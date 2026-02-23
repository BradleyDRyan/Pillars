import type { ActionItem, LifeBarsViewModel, PillarGauge } from '../types/lifeBars';

const pillars: PillarGauge[] = [
  { id: 'marriage', name: 'Marriage', score: 72, color: 'green', icon: '💍' },
  { id: 'physical', name: 'Physical', score: 85, color: 'green', icon: '💪' },
  { id: 'career', name: 'Career', score: 58, color: 'yellow', icon: '🚀' },
  { id: 'finances', name: 'Finances', score: 44, color: 'yellow', icon: '💰' },
  { id: 'house', name: 'House', score: 61, color: 'yellow', icon: '🏠' },
  { id: 'spiritual', name: 'Spiritual', score: 35, color: 'red', icon: '🙏' },
  { id: 'mental', name: 'Mental', score: 70, color: 'green', icon: '🧠' },
  { id: 'fatherhood', name: 'Fatherhood', score: 78, color: 'green', icon: '👶' },
];

const completed: ActionItem[] = [
  {
    id: 'completed-1',
    text: 'Morning gym session',
    pillar: 'physical',
    pillarLabel: 'Physical',
    type: 'habit',
    bounty: 50,
    time: '6:30 AM',
  },
  {
    id: 'completed-2',
    text: 'Read scripture and journaled',
    pillar: 'spiritual',
    pillarLabel: 'Spiritual',
    type: 'habit',
    bounty: 15,
    time: '7:15 AM',
  },
  {
    id: 'completed-3',
    text: 'Deep work on design review',
    pillar: 'career',
    pillarLabel: 'Career',
    type: 'habit',
    bounty: 40,
    time: '9:00 AM',
  },
];

const upcoming: ActionItem[] = [
  {
    id: 'upcoming-1',
    text: 'Plan date night for Emily',
    pillar: 'marriage',
    pillarLabel: 'Marriage',
    type: 'todo',
    bounty: 50,
    bonus: 15,
    time: 'Afternoon',
  },
  {
    id: 'upcoming-2',
    text: 'Review monthly budget',
    pillar: 'finances',
    pillarLabel: 'Finances',
    type: 'todo',
    bounty: 35,
    time: 'Afternoon',
  },
  {
    id: 'upcoming-3',
    text: 'Fix dock railing',
    pillar: 'house',
    pillarLabel: 'House',
    type: 'todo',
    bounty: 20,
    time: 'Afternoon',
  },
  {
    id: 'upcoming-4',
    text: 'Evening walk',
    pillar: 'physical',
    pillarLabel: 'Physical',
    type: 'habit',
    bounty: 20,
    time: '6:00 PM',
  },
  {
    id: 'upcoming-5',
    text: 'Quality time with Emily',
    pillar: 'marriage',
    pillarLabel: 'Marriage',
    type: 'habit',
    bounty: 10,
    time: '8:00 PM',
  },
  {
    id: 'upcoming-6',
    text: 'Read before bed',
    pillar: 'mental',
    pillarLabel: 'Mental',
    type: 'habit',
    bounty: 20,
    time: '9:30 PM',
  },
  {
    id: 'upcoming-7',
    text: 'Prep nursery furniture',
    pillar: 'house',
    pillarLabel: 'House',
    type: 'todo',
    bounty: 50,
    time: 'This week',
  },
];

export const initialLifeBarsModel: LifeBarsViewModel = {
  points: 142,
  goal: 200,
  goalProgress: 71,
  completed,
  upcoming,
  pillars,
  drawerOpen: false,
};
