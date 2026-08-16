import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTeamDashboard } from '../../features/tasks/hooks';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { useAppTheme } from '../../theme';
import type { MainTabsParamList } from '../../navigation/Navigation';

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
interface Member {
  id: string;
  full_name?: string;
  fullName?: string;
  manager_id?: string;
  managerId?: string;
}

function memberName(m: Member) {
  return m.full_name ?? m.fullName ?? 'Unknown';
}

/**
 * Role-adaptive team view (docs/10-OPEN-DECISIONS.md §K/§N) — same endpoint web's Team page
 * uses, rendering per-scope: Manager sees direct reports only, Head/Management see a
 * department or org-wide summary. Drill-down (§M5): every member row and Overdue/Over budget
 * number navigates cross-tab into AllTasksTab's TaskList pre-filtered to that slice, mirroring
 * web's /tasks?... links — same tasks endpoint, same assignee_id/overdue/over_budget filters.
 */
export function TeamDashboardScreen() {
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [expandedManagerId, setExpandedManagerId] = useState<string | undefined>(undefined);
  const { data, isLoading } = useTeamDashboard(departmentId);
  const { colors, radius, spacing, typography, shadow } = useAppTheme();
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();
  const d = data as any;

  function goToTasks(params: { departmentId?: string; assigneeIds?: string; overdue?: boolean; overBudget?: boolean }) {
    navigation.navigate('AllTasksTab', { screen: 'TaskList', params });
  }

  const styles = StyleSheet.create({
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: spacing.sm, marginBottom: spacing.sm },
    heading: { ...typography.h1 },
    breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, marginBottom: spacing.xs },
    breadcrumbText: { fontSize: 12, color: colors.slate[400] },
    breadcrumbLink: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    breadcrumbCurrent: { fontSize: 12, color: colors.slate[600], fontWeight: '600' },
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
    rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    rowTitle: { fontSize: 14, fontWeight: '600', color: colors.slate[800] },
    rowMeta: { fontSize: 12, color: colors.slate[400] },
    sectionLabel: { ...typography.label, marginBottom: spacing.sm },
    backLink: { fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: spacing.md, paddingHorizontal: 16 },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      marginTop: spacing.xs,
      backgroundColor: colors.bg,
      borderRadius: radius.md,
    },
    memberName: { fontSize: 13, fontWeight: '600', color: colors.primary },
  });

  function StatRow({ stats, filterParams }: { stats: TeamStats; filterParams: { departmentId?: string; assigneeIds?: string } | null }) {
    return (
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.open_count}</Text>
          <Text style={styles.statLabel}>open</Text>
        </View>
        <Pressable
          style={styles.stat}
          disabled={!filterParams}
          onPress={() => filterParams && goToTasks({ ...filterParams, overdue: true })}
        >
          <Text style={styles.statValueDanger}>{stats.overdue_count}</Text>
          <Text style={styles.statLabel}>overdue</Text>
        </Pressable>
        <Pressable
          style={styles.stat}
          disabled={!filterParams}
          onPress={() => filterParams && goToTasks({ ...filterParams, overBudget: true })}
        >
          <Text style={styles.statValueWarn}>{stats.over_budget_count}</Text>
          <Text style={styles.statLabel}>over budget</Text>
        </Pressable>
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
          keyExtractor={(m: Member) => m.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <>
              <View style={styles.topRow}>
                <Text style={styles.heading}>My Team</Text>
                <ThemeToggleButton />
              </View>
              <View style={styles.summaryCard}>
                <StatRow stats={d} filterParams={d.members.length ? { assigneeIds: d.members.map((m: Member) => m.id).join(',') } : null} />
              </View>
              <Text style={styles.sectionLabel}>Direct reports ({d.members.length})</Text>
            </>
          }
          ListEmptyComponent={<EmptyState icon="person-outline" title="No direct reports yet" />}
          renderItem={({ item }: { item: Member }) => (
            <Pressable style={styles.row} onPress={() => goToTasks({ assigneeIds: item.id })}>
              <Text style={styles.rowTitle}>{memberName(item)}</Text>
            </Pressable>
          )}
        />
      </Screen>
    );
  }

  if (d.scope === 'department') {
    const membersByManager = (managerId: string) => (d.members as Member[]).filter((m) => (m.manager_id ?? m.managerId) === managerId);
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
              <View style={styles.breadcrumb}>
                <Text style={departmentId ? styles.breadcrumbLink : styles.breadcrumbText} onPress={departmentId ? () => setDepartmentId(undefined) : undefined}>
                  Organization
                </Text>
                <Text style={styles.breadcrumbText}>/</Text>
                <Text style={styles.breadcrumbCurrent}>{d.department_name}</Text>
              </View>
              <View style={styles.summaryCard}>
                <StatRow stats={d} filterParams={{ departmentId: d.department_id }} />
              </View>
              <Text style={styles.sectionLabel}>By manager</Text>
            </>
          }
          ListEmptyComponent={<EmptyState icon="people-outline" title="No managers assigned yet" />}
          renderItem={({ item }: { item: any }) => {
            const expanded = expandedManagerId === item.manager_id;
            const reports = membersByManager(item.manager_id);
            return (
              <View style={styles.row}>
                <Pressable onPress={() => setExpandedManagerId(expanded ? undefined : item.manager_id)}>
                  <View style={styles.rowTitleRow}>
                    <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.slate[400]} />
                    <Text style={styles.rowTitle}>
                      {item.manager_name} · {item.member_count} reports
                    </Text>
                  </View>
                </Pressable>
                <StatRow stats={item} filterParams={reports.length ? { assigneeIds: reports.map((r) => r.id).join(',') } : null} />
                {expanded &&
                  reports.map((r) => (
                    <Pressable key={r.id} style={styles.memberRow} onPress={() => goToTasks({ assigneeIds: r.id })}>
                      <Text style={styles.memberName}>{memberName(r)}</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.slate[400]} />
                    </Pressable>
                  ))}
                {expanded && reports.length === 0 && <Text style={[styles.rowMeta, { marginTop: spacing.xs }]}>No direct reports.</Text>}
              </View>
            );
          }}
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
          <View style={styles.row}>
            <Pressable onPress={() => setDepartmentId(item.department_id)}>
              <Text style={styles.rowTitle}>
                {item.department_name} · {item.member_count} members
              </Text>
            </Pressable>
            <StatRow stats={item} filterParams={{ departmentId: item.department_id }} />
          </View>
        )}
      />
    </Screen>
  );
}
