/**
 * My Listings — a standalone, pushable version of the customer's posted-jobs
 * list, reachable from Profile → settings.
 *
 * MyJobsScreen renders the same data inside the Jobs *tab* (no header, no back
 * button, because a tab has nowhere to go back to). This wrapper adds the
 * header a pushed screen needs and reuses the list itself rather than
 * duplicating it.
 */

import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { IconButton, Text } from '@/components/ui';
import { MyJobsScreen } from './MyJobsScreen';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function MyListingsScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">My Listings</Text>
        <View style={styles.headerSpacer} />
      </View>
      <MyJobsScreen embedded />
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
});
