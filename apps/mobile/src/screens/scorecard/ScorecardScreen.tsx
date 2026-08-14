import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useDepartments, useLeaderboard, useMyScorecard } from '../../features/tasks/hooks';
import { useSessionStore } from '../../lib/auth/session-store';
import { Screen } from '../../components/Screen';
import { Chip } from '../../components/Chip';
import { LoadingView } from '../../components/LoadingView';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { useAppTheme } from '../../theme';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const SUB_SCORE_LABELS: Record<string, string> = {
  on_time_rate: 'On-time',
  estimate_accuracy: 'Est. accuracy',
  volume: 'Volume',
  overdue: 'Overdue⁻¹',
  over_budget: 'Budget⁻¹',
  rework: 'Rework⁻¹',
};

/**
 * Employee scorecard + department leaderboard (docs/10-OPEN-DECISIONS.md §J/§N) — closes the
 * mobile-parity gap flagged in §L8; brings the web Phase 4 feature to mobile with a fixed
 * "last 30 days" range (mobile skips the free-form date pickers web has, to keep this a
 * single glanceable screen rather than a form).
 */
export function ScorecardScreen() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState(currentUser?.primary_department_id ?? '');
  const { colors, radius, spacing, typography, shadow } = useAppTheme();

  const start = isoDaysAgo(30);
  const end = isoDaysAgo(0);
  const { data: mine, isLoading } = useMyScorecard(start, end);
  const { data: leaderboard } = useLeaderboard(departmentId || undefined, start, end);

  const styles = StyleSheet.create({
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: spacing.sm, marginBottom: spacing.sm },
    heading: { ...typography.h1 },
    listContent: { paddingHorizontal: 16, paddingBottom: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
      ...shadow.card,
    },
    scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.md },
    scoreValue: { fontSize: 40, fontWeight: '800', color: colors.primary },
    scoreLabel: { ...typography.caption },
    subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    subChip: {
      flexBasis: '31%',
      backgroundColor: colors.bg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.sm,
    },
    subLabel: { ...typography.label, marginBottom: 2 },
    subValue: { fontSize: 16, fontWeight: '700', color: colors.slate[800] },
    sectionLabel: { ...typography.label, marginBottom: spacing.sm },
    chipRow: { flexGrow: 0, marginBottom: spacing.md },
    lbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    lbRowMe: { borderColor: colors.primary, backgroundColor: `${colors.primary}0d` },
    lbLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    lbRank: { fontSize: 13, fontWeight: '700', color: colors.slate[400], width: 22 },
    lbName: { fontSize: 14, fontWeight: '600', color: colors.slate[800], flexShrink: 1 },
    lbScore: { fontSize: 15, fontWeight: '700', color: colors.primary },
  });

  return (
    <Screen padded={false}>
      <View style={styles.topRow}>
        <Text style={styles.heading}>Scorecard</Text>
        <ThemeToggleButton />
      </View>

      {isLoading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={leaderboard ?? []}
          keyExtractor={(entry: any) => entry.user_id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ListHeaderComponent={
            <>
              {mine && (
                <View style={styles.card}>
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreValue}>{mine.overall_score}</Text>
                    <Text style={styles.scoreLabel}>overall (0-100) · last 30 days</Text>
                  </View>
                  <View style={styles.subGrid}>
                    {Object.entries(mine.sub_scores).map(([key, value]) => (
                      <View key={key} style={styles.subChip}>
                        <Text style={styles.subLabel}>{SUB_SCORE_LABELS[key] ?? key}</Text>
                        <Text style={styles.subValue}>{value as number}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.sectionLabel}>Department leaderboard</Text>
              <FlatList
                horizontal
                data={departments ?? []}
                keyExtractor={(dept) => dept.id}
                style={styles.chipRow}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => <Chip label={item.name} active={departmentId === item.id} onPress={() => setDepartmentId(item.id)} />}
              />
            </>
          }
          renderItem={({ item }: { item: any }) => (
            <View style={[styles.lbRow, item.user_id === currentUser?.id && styles.lbRowMe]}>
              <View style={styles.lbLeft}>
                <Text style={styles.lbRank}>#{item.rank}</Text>
                <Text style={styles.lbName} numberOfLines={1}>
                  {item.full_name}
                </Text>
              </View>
              <Text style={styles.lbScore}>{item.overall_score}</Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}
