import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDepartments, useTasks } from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { useAppTheme } from '../../theme';
import type { TasksStackParamList } from '../../navigation/Navigation';

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskList'>;

/**
 * Filterable task list — also the drill-down landing screen (docs/10-OPEN-DECISIONS.md §M5):
 * Team/Scorecard navigate here (cross-tab) with route.params set, so a tap on a dashboard
 * number lands on exactly that slice, not a fresh unfiltered list.
 */
export function TaskListScreen({ navigation, route }: Props) {
  const drill = route.params;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentId, setDepartmentId] = useState(drill?.departmentId ?? '');
  const { data: departments } = useDepartments();
  const { colors, radius, spacing, typography } = useAppTheme();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const hasDrillFilters = Boolean(drill?.assigneeIds || drill?.overdue || drill?.overBudget);
  const { data, isLoading } = useTasks({
    q: debouncedSearch || undefined,
    department_id: departmentId || undefined,
    assignee_id: drill?.assigneeIds,
    overdue: drill?.overdue ? 'true' : undefined,
    over_budget: drill?.overBudget ? 'true' : undefined,
  });

  const styles = StyleSheet.create({
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
    },
    searchIcon: { marginRight: 6 },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
    chipRow: { flexGrow: 0, marginBottom: spacing.sm },
    listContent: { paddingHorizontal: 16, paddingBottom: spacing.xl, flexGrow: 1 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowContent: { flex: 1, marginRight: spacing.sm },
    rowTitle: { ...typography.title, marginBottom: 6 },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    deptPill: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
    deptText: { fontSize: 11, fontWeight: '600', color: colors.slate[500] },
    filterBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginHorizontal: 16,
      marginBottom: spacing.sm,
      backgroundColor: `${colors.primary}14`,
      borderWidth: 1,
      borderColor: `${colors.primary}40`,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    filterLabel: { fontSize: 12, color: colors.slate[500] },
    filterChip: { fontSize: 12, fontWeight: '700', color: colors.text },
    filterBadgeDanger: { fontSize: 11, fontWeight: '700', color: colors.danger, backgroundColor: colors.dangerBg, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
    filterBadgeWarn: { fontSize: 11, fontWeight: '700', color: colors.warning, backgroundColor: colors.warningBg, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
    filterClear: { marginLeft: 'auto', fontSize: 12, fontWeight: '600', color: colors.primary },
  });

  return (
    <Screen edges={['left', 'right']} padded={false}>
      {hasDrillFilters && (
        <View style={styles.filterBanner}>
          <Text style={styles.filterLabel}>Filtered:</Text>
          {drill?.assigneeIds && (
            <Text style={styles.filterChip}>{drill.assigneeIds.split(',').length === 1 ? '1 person' : `${drill.assigneeIds.split(',').length} people`}</Text>
          )}
          {drill?.overdue && <Text style={styles.filterBadgeDanger}>Overdue</Text>}
          {drill?.overBudget && <Text style={styles.filterBadgeWarn}>Over budget</Text>}
          <Pressable onPress={() => navigation.setParams({ departmentId: undefined, assigneeIds: undefined, overdue: undefined, overBudget: undefined })}>
            <Text style={styles.filterClear}>Clear</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.slate[400]} style={styles.searchIcon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks…"
          placeholderTextColor={colors.slate[400]}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        horizontal
        data={departments ?? []}
        keyExtractor={(dept) => dept.id}
        style={styles.chipRow}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <Chip label={item.name} active={departmentId === item.id} onPress={() => setDepartmentId(departmentId === item.id ? '' : item.id)} />}
      />

      {isLoading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(t: any) => t.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={<EmptyState icon="file-tray-outline" title="No tasks found" subtitle="Try a different search or department." />}
          renderItem={({ item }: { item: any }) => (
            <Card onPress={() => navigation.navigate('TaskDetail', { id: item.id })}>
              <View style={styles.row}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.rowMeta}>
                    <View style={styles.deptPill}>
                      <Text style={styles.deptText}>{item.department?.name}</Text>
                    </View>
                    {item.priority && <Badge label={item.priority.label} color={item.priority.color} />}
                  </View>
                </View>
                {item.status && <Badge label={item.status.label} color={item.status.color} />}
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
