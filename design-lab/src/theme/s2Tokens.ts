import type { S2LikeTokens } from '../types/theme';

export const s2Tokens: S2LikeTokens = {
  colors: {
    pageBackground: '#f7f7f7',
    sectionBackground: '#ffffff',
    blockBackground: '#f2f2f2',
    titleText: '#111111',
    subtitleText: '#4a4a4a',
    placeholderText: '#7a7a7a',
    divider: 'rgba(0, 0, 0, 0.12)',
    positive: '#111111',
    warning: '#555555',
    danger: '#8a8a8a',
    accent: '#111111',
  },
  spacing: {
    pageHorizontal: 24,
    pageVertical: 18,
    sectionGap: 20,
    sectionHeader: 12,
    rowVertical: 12,
    rowHorizontal: 8,
  },
  radius: {
    section: 24,
    card: 16,
    row: 12,
  },
  motion: {
    baseDuration: 0.35,
    springDamping: 26,
    springStiffness: 260,
  },
};
