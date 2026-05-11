import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '../components/ui/Button';
import { Theme, useStyles, useTheme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';

type AccentKey = 'primary' | 'info' | 'warning' | 'primaryLight';

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  accent: AccentKey;
};

const SLIDES: Slide[] = [
  {
    key: 'capture',
    icon: 'scan-outline',
    title: 'Snap any receipt in seconds.',
    body: "Point, shoot, done. We'll read every line so you don't have to type a thing.",
    accent: 'primary',
  },
  {
    key: 'organize',
    icon: 'pricetags-outline',
    title: 'Your spending, automatically sorted.',
    body: 'Groceries, fuel, dining, bills — every receipt lands in the right bucket the moment you scan it.',
    accent: 'info',
  },
  {
    key: 'understand',
    icon: 'stats-chart-outline',
    title: 'See where your money actually goes.',
    body: 'Clean charts and trends so you spot the leaks before payday.',
    accent: 'warning',
  },
  {
    key: 'secure',
    icon: 'finger-print-outline',
    title: 'Locked down with your fingerprint.',
    body: 'Sign in once. After that, just your face or thumb — your receipts stay yours.',
    accent: 'primaryLight',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { markOnboardingSeen } = useAuth();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const styles = useStyles(makeStyles);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setIndex(first.index);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const goToSlide = (i: number) => {
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (i !== index) setIndex(i);
  };

  const finish = async () => {
    await markOnboardingSeen();
    router.replace('/auth');
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>BalanceSheet</Text>
        {!isLast && (
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => <SlideView slide={item} />}
      />

      <View style={styles.dotsRow}>
        {SLIDES.map((s, i) => (
          <Pressable key={s.key} onPress={() => goToSlide(i)} hitSlop={8}>
            <View style={[styles.dot, i === index && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.cta}>
        {isLast ? (
          <Button label="Get started" size="lg" onPress={finish} />
        ) : (
          <Button label="Next" size="lg" onPress={() => goToSlide(index + 1)} />
        )}
      </View>
    </SafeAreaView>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const accent = theme.colors[slide.accent];
  return (
    <View style={styles.slide}>
      <LinearGradient
        colors={[accent + '33', 'transparent']}
        style={styles.iconWrap}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <View style={[styles.iconCircle, { backgroundColor: accent + '22' }]}>
          <Ionicons name={slide.icon} size={64} color={accent} />
        </View>
      </LinearGradient>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
    </View>
  );
}

const makeStyles = (t: Theme) => ({
  container: { flex: 1, backgroundColor: t.colors.background },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.md,
  },
  brand: {
    color: t.colors.textPrimary,
    fontSize: t.font.lg,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  skip: {
    color: t.colors.textSecondary,
    fontSize: t.font.md,
    fontWeight: '600' as const,
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: t.spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconWrap: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: t.spacing.xl,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    color: t.colors.textPrimary,
    fontSize: t.font.xxl,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: t.spacing.md,
  },
  body: {
    color: t.colors.textSecondary,
    fontSize: t.font.md,
    textAlign: 'center' as const,
    lineHeight: 22,
    paddingHorizontal: t.spacing.md,
  },
  dotsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: t.spacing.sm,
    paddingVertical: t.spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: t.colors.primary,
  },
  cta: {
    paddingHorizontal: t.spacing.xl,
    paddingBottom: t.spacing.lg,
  },
});
