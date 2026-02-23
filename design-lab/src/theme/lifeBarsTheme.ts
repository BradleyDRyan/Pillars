import { s2Tokens } from './s2Tokens';
import type { LifeBarsTheme } from '../types/theme';

export const lifeBarsTheme: LifeBarsTheme = {
  tokens: s2Tokens,
  pillars: {
    green: {
      solid: '#111111',
      glow: 'rgba(0, 0, 0, 0.2)',
    },
    yellow: {
      solid: '#555555',
      glow: 'rgba(0, 0, 0, 0.16)',
    },
    red: {
      solid: '#8a8a8a',
      glow: 'rgba(0, 0, 0, 0.12)',
    },
  },
  pillarTags: {
    marriage: { bg: 'rgba(0, 0, 0, 0.08)', text: '#111111' },
    physical: { bg: 'rgba(0, 0, 0, 0.12)', text: '#111111' },
    career: { bg: 'rgba(0, 0, 0, 0.1)', text: '#1a1a1a' },
    finances: { bg: 'rgba(0, 0, 0, 0.06)', text: '#2c2c2c' },
    house: { bg: 'rgba(0, 0, 0, 0.08)', text: '#222222' },
    spiritual: { bg: 'rgba(0, 0, 0, 0.05)', text: '#3a3a3a' },
    mental: { bg: 'rgba(0, 0, 0, 0.07)', text: '#262626' },
    fatherhood: { bg: 'rgba(0, 0, 0, 0.09)', text: '#171717' },
    default: { bg: 'rgba(0, 0, 0, 0.08)', text: '#1f1f1f' },
  },
};
