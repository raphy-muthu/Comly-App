/**
 * Community Impact — Comly's neighborhood value in numbers. Deliberately
 * non-monetary (payments live off-platform): jobs completed, neighbors helped,
 * trust, and teen-safe activity across Lower Merion communities.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Card, HeroCard, IconButton, StatTile, Text } from '@/components/ui';
import { useImpactStats } from '@/hooks';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function ImpactScreen() {
  const role = useRoleTheme();
  const navigation = useNavigation<Nav>();
  const { data: stats } = useImpactStats();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">Community Impact</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <HeroCard
          eyebrow="Our Neighborhood"
          title="Everyday tasks, local opportunity"
          subtitle="Every completed job is a neighbor helped and a young person building real skills."
          style={styles.hero}
        />

        {stats && (
          <>
            <View style={styles.rowTiles}>
              <StatTile
                icon="checkmark-done-outline"
                value={String(stats.completedJobs)}
                label="Local jobs completed"
                tone="primary"
              />
              <StatTile
                icon="shield-checkmark-outline"
                value={`${stats.averageTrustScore}%`}
                label="Average trust score"
                tone="secondary"
              />
            </View>
            <View style={styles.rowTiles}>
              <StatTile
                icon="happy-outline"
                value={String(stats.seniorsHelped)}
                label="Seniors helped"
                tone="tertiary"
              />
              <StatTile
                icon="people-outline"
                value={String(stats.familiesHelped)}
                label="Families helped"
                tone="primary"
              />
            </View>
            <View style={styles.rowTiles}>
              <StatTile
                icon="school-outline"
                value={String(stats.teenSafeJobsCompleted)}
                label="Teen-safe tasks done"
                tone="secondary"
              />
              <StatTile
                icon="repeat-outline"
                value={String(stats.repeatCustomers)}
                label="Repeat customers"
                tone="warning"
              />
            </View>

            <Card padded style={styles.teenCard}>
              <View style={styles.teenRow}>
                <View style={[styles.teenIcon, { backgroundColor: role.accentSoft }]}>
                  <Ionicons name="rocket" size={20} color={role.accent} />
                </View>
                <View style={styles.teenBody}>
                  <Text variant="bodyLg" style={styles.teenTitle}>
                    {stats.activeTeenHelpers} teens building skills
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    Young neighbors earning safely and gaining real work
                    experience across Bryn Mawr, Wynnewood, Ardmore, Gladwyne,
                    and Lower Merion.
                  </Text>
                </View>
              </View>
            </Card>

            {stats.topCategories.length > 0 && (
              <Card padded style={styles.categoriesCard}>
                <Text variant="labelMd" color="textSecondary" style={styles.categoriesLabel}>
                  MOST COMMON TASKS
                </Text>
                {stats.topCategories.map((c) => (
                  <View key={c.label} style={styles.categoryRow}>
                    <Text variant="bodyMd" style={styles.categoryName}>
                      {c.label}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            backgroundColor: role.accent,
                            width: `${Math.min(
                              100,
                              (c.count / stats.topCategories[0].count) * 100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text variant="labelMd" color="textSecondary">
                      {c.count}
                    </Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
  },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  hero: { marginBottom: spacing.md },
  rowTiles: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  teenCard: { marginTop: spacing.base, marginBottom: spacing.sm },
  teenRow: { flexDirection: 'row', gap: spacing.sm },
  teenIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teenBody: { flex: 1 },
  teenTitle: { fontWeight: '700', marginBottom: 2 },
  categoriesCard: { marginBottom: spacing.sm },
  categoriesLabel: { marginBottom: spacing.sm },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  categoryName: { width: 120 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: radius.full,
  },
});
