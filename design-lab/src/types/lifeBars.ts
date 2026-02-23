export type PillarColor = 'green' | 'yellow' | 'red';

export type ActionType = 'habit' | 'todo';

export interface PillarGauge {
  id: string;
  name: string;
  score: number;
  color: PillarColor;
  icon: string;
}

export interface ActionItem {
  id: string;
  text: string;
  pillar: string;
  pillarLabel: string;
  type: ActionType;
  bounty: number;
  bonus?: number;
  time: string;
}

export interface LifeBarsViewModel {
  points: number;
  goal: number;
  goalProgress: number;
  completed: ActionItem[];
  upcoming: ActionItem[];
  pillars: PillarGauge[];
  drawerOpen: boolean;
}
