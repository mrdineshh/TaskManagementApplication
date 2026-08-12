import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDepartments, useTasks } from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, typography } from '../../theme';
import type { TasksStackParamList } from '../../app/Navigation';

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskList'>;

export function TaskListScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const { data: departments } = useDepartments();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useTasks({ q: debouncedSearch || undefined, department_id: departmentId || undefined });

  return (
    <Screen padded={false}>
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

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    paddingHorizontal: spacing.sm,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.slate[900] },
  chipRow: { flexGrow: 0, marginBottom: spacing.sm },
  listContent: { paddingHorizontal: 16, paddingBottom: spacing.xl, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowContent: { flex: 1, marginRight: spacing.sm },
  rowTitle: { ...typography.title, marginBottom: 6 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deptPill: { backgroundColor: colors.slate[100], borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  deptText: { fontSize: 11, fontWeight: '600', color: colors.slate[500] },
});
