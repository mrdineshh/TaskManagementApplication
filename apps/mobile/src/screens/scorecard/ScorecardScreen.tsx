import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDepartments, useLeaderboard, useMyScorecard, useUserScorecard } from '../../features/tasks/hooks';
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

// Same reasoning as web's ScorecardPage: no task-list link from a tile, since the scorecard's
// overdue/over_budget are a date-range-scoped historical count, genuinely different from the
// live definition the tasks endpoint's overdue/over_budget filters use elsewhere in this drill.
function subScoreDetail(key: string, raw: Record<string, number | null>): { label: string; value: string | number }[] {
  switch (key) {
    case 'on_time_rate':
      return [
        { label: 'Completed on time', value: raw.on_time_count ?? 0 },
        { label: 'Completed (with a due date)', value: raw.completed_count ?? 0 },
      ];
    case 'estimate_accuracy':
      return [{ label: 'Avg. estimate error', value: raw.avg_estimate_error_pct === null ? 'n/a' : `${raw.avg_estimate_error_pct}%` }];
    case 'volume':
      return [{ label: 'Tasks completed', value: raw.completed_count ?? 0 }];
    case 'overdue':
      return [{ label: 'Overdue at completion (or now)', value: raw.overdue_count ?? 0 }];
    case 'over_budget':
      return [{ label: 'Went over estimate', value: raw.over_budget_count ?? 0 }];
    case 'rework':
      return [{ label: 'Reopened after completion', value: raw.reworked_count ?? 0 }];
    default:
      return [];
  }
}

/**
 * Employee scorecard + department leaderboard (docs/10-OPEN-DECISIONS.md §J/§N) — closes the
 * mobile-parity gap flagged in §L8; brings the web Phase 4 feature to mobile with a fixed
 * "last 30 days" range (mobile skips the free-form date pickers web has, to keep this a
 * single glanceable screen rather than a form). Drill-down (§M5): leaderboard rows open that
 * person's own scorecard (GET /scorecards/users/:id — same endpoint web now uses); sub-score
 * tiles expand in place to show the raw counts each score is computed from.
 */
export function ScorecardScreen() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState(currentUser?.primary_department_id ?? '');
  const [viewing, setViewing] = useState<{ id: string; name: string } | undefined>(undefined);
  const [expandedKey, setExpandedKey] = useState<string | undefined>(undefined);
  const { colors, radius, spacing, typography, shadow } = useAppTheme();

  const start = isoDaysAgo(30);
  const end = isoDaysAgo(0);
  const mine = useMyScorecard(start, end);
  const forUser = useUserScorecard(viewing?.id, start, end);
  const { data: scorecard, isLoading } = viewing ? forUser : mine;
  const { data: leaderboard } = useLeaderboard(departmentId || undefined, start, end);

  function selectViewing(userId: string, name: string) {
    setExpandedKey(undefined);
    setViewing(userId === currentUser?.id ? undefined : { id: userId, name });
  }

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
    backLink: { fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: spacing.xs },
    scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: 4 },
    scoreValue: { fontSize: 40, fontWeight: '800', color: colors.primary },
    scoreLabel: { ...typography.caption },
    hint: { ...typography.caption, marginBottom: spacing.md },
    subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    subChip: {
      flexBasis: '31%',
      backgroundColor: colors.bg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.sm,
    },
    subChipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}0d` },
    subLabel: { ...typography.label, marginBottom: 2 },
    subValue: { fontSize: 16, fontWeight: '700', color: colors.slate[800] },
    detailBox: {
      marginTop: spacing.sm,
      backgroundColor: `${colors.primary}0d`,
      borderWidth: 1,
      borderColor: `${colors.primary}40`,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
    detailLabel: { fontSize: 12, color: colors.slate[500] },
    detailValue: { fontSize: 12, fontWeight: '700', color: colors.slate[800] },
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
    lbName: { fontSize: 14, fontWeight: '600', color: colors.primary, flexShrink: 1 },
    lbScore: { fontSize: 15, fontWeight: '700', color: colors.primary },
  });

  return (
    <Screen padded={false}>
      <View style={styles.topRow}>
        <Text style={styles.heading}>Scorecard</Text>
        <ThemeToggleButton />
      </View>

      <FlatList
        data={leaderboard ?? []}
        keyExtractor={(entry: any) => entry.user_id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        ListHeaderComponent={
          <>
            <View style={styles.card}>
              {viewing && (
                <Text style={styles.backLink} onPress={() => { setViewing(undefined); setExpandedKey(undefined); }}>
                  ← My scorecard
                </Text>
              )}
              {isLoading ? (
                <LoadingView />
              ) : !scorecard ? (
                <Text style={styles.hint}>No scorecard data for this range.</Text>
              ) : (
                <>
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreValue}>{scorecard.overall_score}</Text>
                    <Text style={styles.scoreLabel}>
                      {viewing ? `${viewing.name} · ` : ''}overall (0-100) · last 30 days
                    </Text>
                  </View>
                  <Text style={styles.hint}>Tap a tile to see what it's made of.</Text>
                  <View style={styles.subGrid}>
                    {Object.entries(scorecard.sub_scores).map(([key, value]) => {
                      const expanded = expandedKey === key;
                      return (
                        <Pressable key={key} style={[styles.subChip, expanded && styles.subChipActive]} onPress={() => setExpandedKey(expanded ? undefined : key)}>
                          <Text style={styles.subLabel}>{SUB_SCORE_LABELS[key] ?? key}</Text>
                          <Text style={styles.subValue}>{value as number}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {expandedKey && (
                    <View style={styles.detailBox}>
                      {subScoreDetail(expandedKey, scorecard.raw as unknown as Record<string, number | null>).map((row) => (
                        <View key={row.label} style={styles.detailRow}>
                          <Text style={styles.detailLabel}>{row.label}</Text>
                          <Text style={styles.detailValue}>{row.value}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>

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
          <Pressable
            style={[styles.lbRow, (viewing ? item.user_id === viewing.id : item.user_id === currentUser?.id) && styles.lbRowMe]}
            onPress={() => selectViewing(item.user_id, item.full_name)}
          >
            <View style={styles.lbLeft}>
              <Text style={styles.lbRank}>#{item.rank}</Text>
              <Text style={styles.lbName} numberOfLines={1}>
                {item.full_name}
              </Text>
            </View>
            <Text style={styles.lbScore}>{item.overall_score}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}
