import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTeamDashboard } from '../../features/tasks/hooks';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { useAppTheme } from '../../theme';

interface StatusCount {
  status_id: string;
  label: string;
  color: string | null;
  count: number;
}
interface TeamStats {
  counts_by_status: StatusCount[];
  overdue_count: number;
  over_budget_count: number;
  open_count: number;
}

/**
 * Role-adaptive team view (docs/10-OPEN-DECISIONS.md §K/§N) — same endpoint web's Team page
 * uses, rendering per-scope: Manager sees direct reports only, Head/Management see a
 * department or org-wide summary. Replaces the old fixed department-picker + generic task
 * list, which showed the same content to every role regardless of what they actually manage.
 */
export function TeamDashboardScreen() {
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const { data, isLoading } = useTeamDashboard(departmentId);
  const { colors, radius, spacing, typography, shadow } = useAppTheme();
  const d = data as any;

  const styles = StyleSheet.create({
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: spacing.sm, marginBottom: spacing.sm },
    heading: { ...typography.h1 },
    listContent: { paddingHorizontal: 16, paddingBottom: spacing.xl },
    statsRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
    stat: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
    statValueDanger: { fontSize: 18, fontWeight: '700', color: colors.danger },
    statValueWarn: { fontSize: 18, fontWeight: '700', color: colors.warning },
    statLabel: { ...typography.caption },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
      ...shadow.card,
    },
    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowTitle: { fontSize: 14, fontWeight: '600', color: colors.slate[800], marginBottom: 4 },
    rowMeta: { fontSize: 12, color: colors.slate[400] },
    sectionLabel: { ...typography.label, marginBottom: spacing.sm },
    backLink: { fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: spacing.md, paddingHorizontal: 16 },
  });

  function StatRow({ stats }: { stats: TeamStats }) {
    return (
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.open_count}</Text>
          <Text style={styles.statLabel}>open</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValueDanger}>{stats.overdue_count}</Text>
          <Text style={styles.statLabel}>overdue</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValueWarn}>{stats.over_budget_count}</Text>
          <Text style={styles.statLabel}>over budget</Text>
        </View>
      </View>
    );
  }

  if (isLoading) return <LoadingView />;

  if (!d || d.scope === 'none') {
    return (
      <Screen padded={false}>
        <View style={styles.topRow}>
          <Text style={styles.heading}>Team</Text>
          <ThemeToggleButton />
        </View>
        <EmptyState icon="people-outline" title="No team view" subtitle="Your current role doesn't manage a team." />
      </Screen>
    );
  }

  if (d.scope === 'manager') {
    return (
      <Screen padded={false}>
        <FlatList
          data={d.members}
          keyExtractor={(m: any) => m.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <>
              <View style={styles.topRow}>
                <Text style={styles.heading}>My Team</Text>
                <ThemeToggleButton />
              </View>
              <View style={styles.summaryCard}>
                <StatRow stats={d} />
              </View>
              <Text style={styles.sectionLabel}>Direct reports ({d.members.length})</Text>
            </>
          }
          ListEmptyComponent={<EmptyState icon="person-outline" title="No direct reports yet" />}
          renderItem={({ item }: { item: any }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{item.full_name}</Text>
            </View>
          )}
        />
      </Screen>
    );
  }

  if (d.scope === 'department') {
    return (
      <Screen padded={false}>
        <FlatList
          data={d.by_manager}
          keyExtractor={(m: any) => m.manager_id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <>
              <View style={styles.topRow}>
                <Text style={styles.heading}>{d.department_name}</Text>
                <ThemeToggleButton />
              </View>
              {departmentId && (
                <Text style={styles.backLink} onPress={() => setDepartmentId(undefined)}>
                  ← All departments
                </Text>
              )}
              <View style={styles.summaryCard}>
                <StatRow stats={d} />
              </View>
              <Text style={styles.sectionLabel}>By manager</Text>
            </>
          }
          ListEmptyComponent={<EmptyState icon="people-outline" title="No managers assigned yet" />}
          renderItem={({ item }: { item: any }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>
                {item.manager_name} · {item.member_count} reports
              </Text>
              <StatRow stats={item} />
            </View>
          )}
        />
      </Screen>
    );
  }

  // scope === 'org'
  return (
    <Screen padded={false}>
      <FlatList
        data={d.departments}
        keyExtractor={(dept: any) => dept.department_id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={styles.topRow}>
            <Text style={styles.heading}>Organization</Text>
            <ThemeToggleButton />
          </View>
        }
        renderItem={({ item }: { item: any }) => (
          <Pressable style={styles.row} onPress={() => setDepartmentId(item.department_id)}>
            <Text style={styles.rowTitle}>
              {item.department_name} · {item.member_count} members
            </Text>
            <StatRow stats={item} />
          </Pressable>
        )}
      />
    </Screen>
  );
}
