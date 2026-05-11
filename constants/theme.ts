import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { Category } from '../types';

/**
 * Theme system. Light + dark palettes that mirror each other by shape,
 * keyed off the system color scheme via `useColorScheme()`. Components
 * that should react to theme changes use the `useTheme()` hook + a
 * useMemo'd `StyleSheet.create` block:
 *
 *   const theme = useTheme();
 *   const styles = useMemo(() => makeStyles(theme), [theme]);
 *
 * For backward compatibility there's still a default `theme` export
 * (dark palette) — older components that import it keep working but
 * won't update on system theme changes until they're migrated.
 */

// Brand colors shared across both palettes — saturated enough to work
// on a dark background AND a light one without needing per-theme variants.
const BRAND = {
  primary: '#10B981',
  primaryDark: '#059669',
  primaryLight: '#34D399',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

const CATEGORY_COLORS = {
  Groceries: '#10B981',
  Electronics: '#3B82F6',
  Dining: '#F59E0B',
  Pharmacy: '#EC4899',
  Gas: '#8B5CF6',
  Clothing: '#F97316',
  Entertainment: '#06B6D4',
  Travel: '#84CC16',
  Healthcare: '#EF4444',
  Other: '#64748B', // slightly darker on light, still readable on dark
} as Record<Category, string>;

const SHAPE = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
  font: { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32 },
};

export const darkTheme = {
  isDark: true,
  colors: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceHigh: '#263447',
    border: '#334155',
    borderLight: '#475569',

    ...BRAND,
    primaryFaint: 'rgba(16, 185, 129, 0.12)',

    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',

    category: CATEGORY_COLORS,
  },
  ...SHAPE,
};

export const lightTheme = {
  isDark: false,
  colors: {
    background: '#F8FAFC', // very light gray-blue
    surface: '#FFFFFF',
    surfaceHigh: '#F1F5F9',
    border: '#E2E8F0',
    borderLight: '#CBD5E1',

    ...BRAND,
    primaryFaint: 'rgba(16, 185, 129, 0.10)',

    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',

    category: CATEGORY_COLORS,
  },
  ...SHAPE,
};

export type Theme = typeof darkTheme;

const ThemeContext = createContext<Theme>(darkTheme);

/**
 * Wrap the app's root in this provider. It listens to the system
 * color scheme via useColorScheme() and re-renders consumers when
 * the user toggles light/dark mode in their OS settings.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo(
    () => (scheme === 'light' ? lightTheme : darkTheme),
    [scheme],
  );
  return React.createElement(ThemeContext.Provider, { value }, children);
}

/** Returns the active theme (reactive — re-renders on system change). */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Build a theme-aware StyleSheet inside a component. Re-computes only
 * when the theme changes, so it's safe to call on every render.
 *
 *   const styles = useStyles((t) => ({
 *     card: { backgroundColor: t.colors.surface },
 *   }));
 */
export function useStyles<
  T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<unknown>,
>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
}

