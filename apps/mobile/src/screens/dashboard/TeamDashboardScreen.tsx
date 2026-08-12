import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useDepartmentDashboard, useDepartments } from '../../features/tasks/hooks';
import { useSessionStore } from '../../lib/auth/session-store';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/Badge';
import { colors, spacing, typography } from '../../theme';

/**
 * View-only depth on mobile per docs/07-FRONTEND-MOBILE.md §4 — full admin config stays
 * desk-oriented (web only). Manager task assignment/editing is a fast-follow once the
 * task detail screen grows an edit mode.
 */
export function TeamDashboardScreen() {
  const { data: departments } = useDepartments();
  const currentUser = useSessionStore((s) => s.currentUser);
  const [departmentId, setDepartmentId] = useState(currentUser?.primary_department_id ?? '');
  const { data } = useDepartmentDashboard(departmentId || undefined);
  const d = data as any;

  return (
    <Screen padded={false}>
      <FlatList
        horizontal
        data={departments ?? []}
        keyExtractor={(dept) => dept.id}
        style={styles.deptRow}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <Chip label={item.name} active={departmentId === item.id} onPress={() => setDepartmentId(item.id)} />}
      />

      <FlatList
        data={d?.recently_created ?? []}
        keyExtractor={(t: any) => t.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          d ? (
            <View style={styles.statsRow}>
              <StatCard label="Overdue" value={d.overdue_count} color={colors.danger} icon="alert-circle" />
              <StatCard label="Statuses tracked" value={d.counts_by_status?.length ?? 0} color={colors.brand[600]} icon="stats-chart" />
              <StatCard label="Assignees" value={d.workload_by_assignee?.length ?? 0} color={colors.success} icon="people" />
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="briefcase-outline" title="No recent activity" subtitle="Pick a department above to see its tasks." />}
        renderItem={({ item }: { item: any }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.status && <Badge label={item.status.label} color={item.status.color} />}
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deptRow: { flexGrow: 0, marginTop: spacing.sm, marginBottom: spacing.sm },
  listContent: { paddingHorizontal: 16, paddingBottom: spacing.xl, flexGrow: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { ...typography.title, flex: 1, marginRight: spacing.sm },
});
