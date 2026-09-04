/**
 * Renders a LegalDocument (Terms of Service, Privacy Policy) as native text.
 *
 * Deliberately not a WebView: the documents live as structured blocks in
 * src/legal/content.ts, so they render with the app's own typography, work
 * offline, are searchable/selectable, and need no extra native dependency.
 * The same blocks are exported to the hosted pages under web/legal/.
 *
 * Reachable from both navigation stacks — a signed-out user must be able to
 * read the Terms from the sign-up screen before agreeing to them, and a
 * signed-in user from Profile — so this takes its document as a prop and uses
 * the untyped `useNavigation()` rather than binding to one param list.
 */

import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { IconButton, Text } from '@/components/ui';
import type { LegalBlock, LegalDocument } from '@/legal/content';

export interface LegalDocumentScreenProps {
  document: LegalDocument;
}

export function LegalDocumentScreen({ document }: LegalDocumentScreenProps) {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <IconButton icon="arrow-back" onPress={() => navigation.goBack()} />
        ) : (
          // Deep-linked straight to /terms with no history behind it.
          <View style={styles.headerSpacer} />
        )}
        <Text variant="headlineMd" numberOfLines={1} style={styles.headerTitle}>
          {document.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="caption" color="textSecondary" style={styles.updated}>
          Last updated {document.lastUpdated} · Version {document.version}
        </Text>

        {document.blocks.map((block, i) => (
          <Block key={`${block.type}-${i}`} block={block} />
        ))}

        {!!document.attribution && (
          <Text variant="caption" color="textSecondary" style={styles.attribution}>
            {document.attribution.text}
            <Text
              variant="caption"
              color="textLink"
              onPress={() => Linking.openURL(document.attribution!.url)}
            >
              {document.attribution.linkLabel}
            </Text>
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case 'h2':
      return (
        <Text variant="headlineMd" style={styles.h2}>
          {block.text}
        </Text>
      );
    case 'h3':
      return (
        <Text variant="labelMd" style={styles.h3}>
          {block.text}
        </Text>
      );
    case 'li':
      return (
        <View style={styles.liRow}>
          <Text variant="bodyMd" color="textSecondary" style={styles.bullet}>
            •
          </Text>
          <Text variant="bodyMd" color="textSecondary" style={styles.liText}>
            {block.text}
          </Text>
        </View>
      );
    case 'p':
    default:
      return (
        <Text variant="bodyMd" color="textSecondary" style={styles.p}>
          {block.text}
        </Text>
      );
  }
}

/** Thin wrappers so the navigator registers a component, not a bound prop. */
export function makeLegalScreen(document: LegalDocument) {
  return function LegalScreen() {
    return <LegalDocumentScreen document={document} />;
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.xl,
  },
  updated: { marginBottom: spacing.md },
  h2: { marginTop: spacing.lg, marginBottom: spacing.sm },
  h3: { marginTop: spacing.md, marginBottom: spacing.xs },
  p: { marginBottom: spacing.sm, lineHeight: 22 },
  liRow: { flexDirection: 'row', marginBottom: spacing.xs, paddingRight: spacing.sm },
  bullet: { width: 16, lineHeight: 22 },
  liText: { flex: 1, lineHeight: 22 },
  attribution: { marginTop: spacing.lg },
});
