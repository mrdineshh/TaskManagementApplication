import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePersonalDashboard } from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import type { TasksStackParamList } from '../../app/Navigation';

type Props = NativeStackScreenProps<TasksStackParamList, 'MyTasks'>;

/** "My Tasks" — default landing screen for individual contributors (docs/05-FEATURES.md §1.2). */
export function MyTasksScreen({ navigation }: Props) {
  const { data, isLoading, refetch, isRefetching } = usePersonalDashboard();
  const d = data as any;

  return (
    <View style={styles.container}>
      {d && (
        <View style={styles.statsRow}>
          <Stat label="Overdue" value={d.overdue_count} color="#dc2626" />
          <Stat label="Due this week" value={d.due_this_week_count} color="#d97706" />
          <Stat label="Open" value={d.open_tasks.length} color="#2563eb" />
        </View>
      )}
      <FlatList
        data={d?.open_tasks ?? []}
        keyExtractor={(t: any) => t.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Nothing open — nice work.</Text> : null}
        renderItem={({ item }: { item: any }) => (
          <View style={styles.row} onTouchEnd={() => navigation.navigate('TaskDetail', { id: item.id })}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            {item.status && <Badge label={item.status.label} color={item.status.color} />}
          </View>
        )}
      />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: 'white', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  row: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', flexShrink: 1, marginRight: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
});
