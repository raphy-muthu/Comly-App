/**
 * About Comly — the mission, the four product pillars, and "Why Comly Matters".
 * Framing: a safe neighborhood marketplace and youth-opportunity platform —
 * never "cheap labor" or a generic gig app.
 */

import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';
import { BrandLogo, Button, Card, IconButton, Text } from '@/components/ui';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const PILLARS: { icon: string; title: string; body: string }[] = [
  {
    icon: 'rocket-outline',
    title: 'Youth Opportunity',
    body: 'Teens earn safely, build real skills, and grow a track record with badges, ratings, and an experience summary.',
  },
  {
    icon: 'home-outline',
    title: 'Affordable Community Help',
    body: 'Families and seniors get help with everyday tasks, with AI fair-pay suggestions so nobody is overcharged or underpaid.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Safety First',
    body: 'Parent approval for helpers under 18, safety labels on every job, unsafe tasks blocked for minors, and built-in reporting.',
  },
  {
    icon: 'stats-chart-outline',
    title: 'Measurable Local Impact',
    body: 'Completed jobs, neighbors helped, and community trust — tracked and visible on the Impact dashboard.',
  },
];

const AUDIENCES: { icon: string; title: string; points: string[] }[] = [
  {
    icon: 'people-outline',
    title: 'For residents',
    points: ['Affordable local help', 'Easy task posting', 'Trusted neighborhood support'],
  },
  {
    icon: 'school-outline',
    title: 'For teen helpers',
    points: ['Safe earning opportunities', 'Real-world skills', 'Ratings and experience history'],
  },
  {
    icon: 'heart-outline',
    title: 'For the community',
    points: ['Stronger local connections', 'Measurable neighborhood impact', 'Responsible AI safety tools'],
  },
];

export function AboutScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">About Comly</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <BrandLogo size={72} style={styles.logo} />
          <Text variant="headlineLgMobile" center>
            Local help. Trusted neighbors.
          </Text>
        </View>

        <Card padded style={styles.mission}>
          <Text variant="bodyLg" color="textPrimary">
            Comly is built to solve a local community problem: many residents
            need affordable help with everyday tasks, while many teens want
            safe ways to earn money and build experience. Comly connects these
            groups through a trusted neighborhood marketplace with AI-powered
            matching, fair-pay suggestions, parent approval, ratings,
            reporting, and safety labels.
          </Text>
        </Card>

        <Text variant="headlineMd" style={styles.sectionTitle}>
          What we stand for
        </Text>
        {PILLARS.map((p) => (
          <Card key={p.title} padded style={styles.pillar}>
            <View style={styles.pillarRow}>
              <View style={styles.pillarIcon}>
                <Ionicons name={p.icon as any} size={20} color={colors.primary} />
              </View>
              <View style={styles.pillarBody}>
                <Text variant="bodyLg" style={styles.pillarTitle}>
                  {p.title}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {p.body}
                </Text>
              </View>
            </View>
          </Card>
        ))}

        <Text variant="headlineMd" style={styles.sectionTitle}>
          Why Comly matters
        </Text>
        {AUDIENCES.map((a) => (
          <Card key={a.title} padded style={styles.pillar}>
            <View style={styles.pillarRow}>
              <View style={styles.pillarIcon}>
                <Ionicons name={a.icon as any} size={20} color={colors.primary} />
              </View>
              <View style={styles.pillarBody}>
                <Text variant="bodyLg" style={styles.pillarTitle}>
                  {a.title}
                </Text>
                {a.points.map((pt) => (
                  <View key={pt} style={styles.pointRow}>
                    <Ionicons name="checkmark" size={14} color={colors.tertiary} />
                    <Text variant="caption" color="textSecondary" style={styles.pointText}>
                      {pt}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        ))}

        <Button
          title="See Our Community Impact"
          icon="stats-chart"
          onPress={() => navigation.navigate('Impact')}
          style={styles.impactBtn}
        />
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
  brand: { alignItems: 'center', marginBottom: spacing.md },
  logo: { marginBottom: spacing.sm },
  mission: { marginBottom: spacing.md },
  sectionTitle: { marginTop: spacing.base, marginBottom: spacing.sm },
  pillar: { marginBottom: spacing.sm },
  pillarRow: { flexDirection: 'row', gap: spacing.sm },
  pillarIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarBody: { flex: 1 },
  pillarTitle: { fontWeight: '700', marginBottom: 2 },
  pointRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  pointText: { marginLeft: 6 },
  impactBtn: { marginTop: spacing.sm },
});
