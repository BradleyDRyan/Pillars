import type { PillarColor } from './lifeBars';

export interface S2LikeTokens {
  colors: {
    pageBackground: string;
    sectionBackground: string;
    blockBackground: string;
    titleText: string;
    subtitleText: string;
    placeholderText: string;
    divider: string;
    positive: string;
    warning: string;
    danger: string;
    accent: string;
  };
  spacing: {
    pageHorizontal: number;
    pageVertical: number;
    sectionGap: number;
    sectionHeader: number;
    rowVertical: number;
    rowHorizontal: number;
  };
  radius: {
    section: number;
    card: number;
    row: number;
  };
  motion: {
    baseDuration: number;
    springDamping: number;
    springStiffness: number;
  };
}

export interface LifeBarsTheme {
  tokens: S2LikeTokens;
  pillars: Record<PillarColor, { solid: string; glow: string }>;
  pillarTags: Record<string, { bg: string; text: string }>;
}
