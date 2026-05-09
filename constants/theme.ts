import { Category } from '../types';

export const theme = {
  colors: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceHigh: '#263447',
    border: '#334155',
    borderLight: '#475569',

    primary: '#10B981',
    primaryDark: '#059669',
    primaryLight: '#34D399',
    primaryFaint: 'rgba(16, 185, 129, 0.12)',

    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',

    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    category: {
      Groceries: '#10B981',
      Electronics: '#3B82F6',
      Dining: '#F59E0B',
      Pharmacy: '#EC4899',
      Gas: '#8B5CF6',
      Clothing: '#F97316',
      Entertainment: '#06B6D4',
      Travel: '#84CC16',
      Healthcare: '#EF4444',
      Other: '#94A3B8',
    } as Record<Category, string>,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },
  font: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};
