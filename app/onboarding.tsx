import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '../components/ui/Button';
import { theme } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  accent: string;
};

const SLIDES: Slide[] = [
  {
    key: 'capture',
    icon: 'scan-outline',
    title: 'Snap any receipt in seconds.',
    body: "Point, shoot, done. We'll read every line so you don't have to type a thing.",
    accent: theme.colors.primary,
  },
  {
    key: 'organize',
    icon: 'pricetags-outline',
    title: 'Your spending, automatically sorted.',
    body: 'Groceries, fuel, dining, bills — every receipt lands in the right bucket the moment you scan it.',
    accent: theme.colors.info,
  },
  {
    key: 'understand',
    icon: 'stats-chart-outline',
    title: 'See where your money actually goes.',
    body: 'Clean charts and trends so you spot the leaks before payday.',
    accent: theme.colors.warning,
  },
  {
    key: 'secure',
    icon: 'finger-print-outline',
    title: 'Locked down with your fingerprint.',
    body: 'Sign in once. After that, just your face or thumb — your receipts stay yours.',
    accent: theme.colors.primaryLight,
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { markOnboardingSeen } = useAuth();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

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
  return (
    <View style={styles.slide}>
      <LinearGradient
        colors={[slide.accent + '33', 'transparent']}
        style={styles.iconWrap}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <View style={[styles.iconCircle, { backgroundColor: slide.accent + '22' }]}>
          <Ionicons name={slide.icon} size={64} color={slide.accent} />
        </View>
      </LinearGradient>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  brand: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.lg,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  skip: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
    fontWeight: '600',
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.xxl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  cta: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
});
