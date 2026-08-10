import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useDepartmentDashboard, useDepartments } from '../../features/tasks/hooks';
import { useSessionStore } from '../../lib/auth/session-store';

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
    <View style={styles.container}>
      <FlatList
        horizontal
        data={departments ?? []}
        keyExtractor={(dept) => dept.id}
        style={styles.deptRow}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.deptChip, departmentId === item.id && styles.deptChipActive]}
            onPress={() => setDepartmentId(item.id)}
          >
            <Text style={[styles.deptChipText, departmentId === item.id && styles.deptChipTextActive]}>{item.name}</Text>
          </Pressable>
        )}
      />

      {d && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Overdue</Text>
              <Text style={[styles.statValue, { color: '#dc2626' }]}>{d.overdue_count}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Recently created</Text>
          <FlatList
            data={d.recently_created}
            keyExtractor={(t: any) => t.id}
            renderItem={({ item }: { item: any }) => (
              <View style={styles.row}>
                <Text style={styles.rowTitle}>{item.title}</Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 12 },
  deptRow: { marginBottom: 12, flexGrow: 0 },
  deptChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  deptChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  deptChipText: { fontSize: 12, color: '#334155' },
  deptChipTextActive: { color: 'white', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: { backgroundColor: 'white', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  row: { backgroundColor: 'white', borderRadius: 8, padding: 10, marginBottom: 6 },
  rowTitle: { fontSize: 13, color: '#334155' },
});
