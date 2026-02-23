export type TemplateRubricItem = {
  id: string;
  activityType: string;
  tier: string;
  label: string;
  points: number;
  examples?: string | null;
  createdAt?: number;
  updatedAt?: number;
};

export type PillarTemplateRecord = {
  id: string;
  pillarType: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  colorToken?: string | null;
  order: number;
  isActive: boolean;
  rubricItems: TemplateRubricItem[];
  createdAt?: number;
  updatedAt?: number;
  updatedBy?: string | null;
};
