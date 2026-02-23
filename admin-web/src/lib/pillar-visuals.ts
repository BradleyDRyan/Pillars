export type PillarVisualColor = {
  id: string;
  label: string;
  order: number;
  isActive: boolean;
};

export type PillarVisualIcon = {
  id: string;
  label: string;
  defaultColorToken?: string | null;
  order: number;
  isActive: boolean;
};

export type PillarVisualsRecord = {
  endpoint: string;
  source: string;
  updatedAt: number;
  colors: PillarVisualColor[];
  icons: PillarVisualIcon[];
};
