import { View, Text, FlatList, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTasks } from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import type { TasksStackParamList } from '../../app/Navigation';

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskList'>;

export function TaskListScreen({ navigation }: Props) {
  const { data, isLoading } = useTasks();

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(t: any) => t.id}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>No tasks found.</Text> : null}
        renderItem={({ item }: { item: any }) => (
          <View style={styles.row} onTouchEnd={() => navigation.navigate('TaskDetail', { id: item.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSub}>{item.department?.name}</Text>
            </View>
            {item.status && <Badge label={item.status.label} color={item.status.color} />}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 12 },
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
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  rowSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
});
