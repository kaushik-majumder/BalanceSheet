import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../../constants/theme';

interface BarProps {
  /** 0..100 target percentage. */
  percent: number;
  color: string;
  durationMs?: number;
}

/**
 * Horizontal bar with an animated width. Width changes (e.g., the
 * user switches months and the underlying value updates) tween
 * smoothly instead of snapping. Width animations can't use the
 * native driver, so this runs on the JS thread — fine for the
 * handful of bars on the dashboard.
 */
export function HorizontalBar({ percent, color, durationMs = 450 }: BarProps) {
  const theme = useTheme();
  const value = useRef(new Animated.Value(percent)).current;
  useEffect(() => {
    Animated.timing(value, {
      toValue: percent,
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, [percent, durationMs, value]);
  const width = value.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });
  return (
    <View
      style={{
        height: 8,
        backgroundColor: theme.colors.border,
        borderRadius: theme.radius.full,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          width,
          minWidth: 4,
          backgroundColor: color,
          borderRadius: theme.radius.full,
        }}
      />
    </View>
  );
}

/**
 * Vertical bar with animated height. Used in the trend chart on
 * Reports. The track has a fixed pixel height; the fill grows from
 * the bottom to the target percentage of that track.
 */
export function VerticalBar({
  percent,
  color,
  trackHeight,
  durationMs = 450,
}: BarProps & { trackHeight: number }) {
  const theme = useTheme();
  const value = useRef(new Animated.Value(percent)).current;
  useEffect(() => {
    Animated.timing(value, {
      toValue: percent,
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, [percent, durationMs, value]);
  const height = value.interpolate({
    inputRange: [0, 100],
    outputRange: [0, trackHeight],
    extrapolate: 'clamp',
  });
  return (
    <View
      style={{
        width: '70%',
        height: trackHeight,
        backgroundColor: theme.colors.border,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
        justifyContent: 'flex-end',
      }}
    >
      <Animated.View
        style={{
          width: '100%',
          height,
          minHeight: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
