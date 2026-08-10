import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useNotifications } from '../../features/tasks/hooks';

export function NotificationsScreen() {
  const { data } = useNotifications();

  return (
    <View style={styles.container}>
      <FlatList
        data={data ?? []}
        keyExtractor={(n: any) => n.id}
        ListEmptyComponent={<Text style={styles.empty}>No notifications.</Text>}
        renderItem={({ item }: { item: any }) => (
          <View style={[styles.row, !item.is_read && styles.rowUnread]}>
            <Text style={styles.type}>{item.type}</Text>
            <Text style={styles.payload}>{JSON.stringify(item.payload)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 12 },
  row: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 8 },
  rowUnread: { borderWidth: 1, borderColor: '#93c5fd' },
  type: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  payload: { fontSize: 13, color: '#334155' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
});
