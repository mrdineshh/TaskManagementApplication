import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePersonalDashboard } from '../../features/tasks/hooks';
import { useSessionStore } from '../../lib/auth/session-store';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { colors, spacing, typography } from '../../theme';
import type { TasksStackParamList } from '../../app/Navigation';

type Props = NativeStackScreenProps<TasksStackParamList, 'MyTasks'>;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "My Tasks" — default landing screen for individual contributors (docs/05-FEATURES.md §1.2). */
export function MyTasksScreen({ navigation }: Props) {
  const { data, isLoading, refetch, isRefetching } = usePersonalDashboard();
  const currentUser = useSessionStore((s) => s.currentUser);
  const d = data as any;

  if (isLoading) return <LoadingView />;

  return (
    <Screen edges={['top', 'left', 'right']} padded={false}>
      <FlatList
        data={d?.open_tasks ?? []}
        keyExtractor={(t: any) => t.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand[600]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{currentUser?.full_name?.split(' ')[0] ?? 'there'}</Text>

            {d && (
              <View style={styles.statsRow}>
                <StatCard label="Overdue" value={d.overdue_count} color={colors.danger} icon="alert-circle" />
                <StatCard label="Due this week" value={d.due_this_week_count} color={colors.warning} icon="calendar" />
                <StatCard label="Open" value={d.open_tasks.length} color={colors.brand[600]} icon="albums" />
              </View>
            )}

            <Text style={styles.sectionLabel}>Open tasks</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="checkmark-done-circle-outline" title="Nothing open" subtitle="Nice work — you're all caught up." />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }: { item: any }) => (
          <Card onPress={() => navigation.navigate('TaskDetail', { id: item.id })}>
            <View style={styles.row}>
              {item.priority?.color && <View style={[styles.priorityBar, { backgroundColor: item.priority.color }]} />}
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.rowMeta}>
                  {item.status && <Badge label={item.status.label} color={item.status.color} />}
                  {item.due_date && (
                    <View style={styles.dueRow}>
                      <Ionicons name="time-outline" size={12} color={colors.slate[400]} />
                      <Text style={styles.dueText}>{new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                    </View>
                  )}
                </View>
              </View>
              {currentUser && <Avatar name={currentUser.full_name} size={26} />}
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingBottom: spacing.xl },
  header: { paddingTop: spacing.sm },
  greeting: { ...typography.body, color: colors.slate[500] },
  name: { ...typography.h1, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  priorityBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: spacing.sm },
  rowContent: { flex: 1, marginRight: spacing.sm },
  rowTitle: { ...typography.title, marginBottom: 6 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dueText: { ...typography.caption },
});
