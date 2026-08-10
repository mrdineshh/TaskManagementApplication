import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../features/tasks/hooks';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, spacing, typography } from '../../theme';

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; message: (p: any) => string }> = {
  task_assigned: { icon: 'person-add', color: colors.brand[600], message: (p) => `Assigned to you: ${p.task_title}` },
  task_reassigned: { icon: 'swap-horizontal', color: colors.brand[600], message: (p) => `Reassigned: ${p.task_title}` },
  due_soon: { icon: 'time', color: colors.warning, message: (p) => `Due soon: ${p.task_title}` },
  task_overdue: { icon: 'alert-circle', color: colors.danger, message: (p) => `Overdue: ${p.task_title}` },
  comment_mention: { icon: 'at', color: colors.brand[600], message: (p) => `You were mentioned on: ${p.task_title}` },
  status_changed: { icon: 'refresh-circle', color: colors.success, message: (p) => `Status changed: ${p.task_title}` },
  sla_breach: { icon: 'warning', color: colors.danger, message: (p) => `SLA escalation: ${p.task_title}` },
  approval_requested: { icon: 'checkmark-circle', color: colors.brand[600], message: (p) => `Approval requested: ${p.task_title}` },
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function NotificationsScreen() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const hasUnread = (data ?? []).some((n: any) => !n.is_read);

  return (
    <Screen padded={false}>
      {hasUnread && (
        <Pressable onPress={() => markAllRead.mutate()} style={styles.markAllRow}>
          <Text style={styles.markAllText}>Mark all as read</Text>
        </Pressable>
      )}
      <FlatList
        data={data ?? []}
        keyExtractor={(n: any) => n.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No notifications" subtitle="You're all caught up." />}
        renderItem={({ item }: { item: any }) => {
          const meta = TYPE_META[item.type] ?? { icon: 'ellipse', color: colors.slate[400], message: () => item.type };
          return (
            <Pressable
              onPress={() => !item.is_read && markRead.mutate(item.id)}
              style={[styles.row, !item.is_read && styles.rowUnread]}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${meta.color}1a` }]}>
                <Ionicons name={meta.icon} size={16} color={meta.color} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.message} numberOfLines={2}>
                  {meta.message(item.payload ?? {})}
                </Text>
                <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAllRow: { alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: spacing.sm },
  markAllText: { fontSize: 12, fontWeight: '600', color: colors.brand[600] },
  listContent: { paddingHorizontal: 16, paddingTop: spacing.sm, paddingBottom: spacing.xl, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  rowUnread: { borderColor: colors.brand[200], backgroundColor: colors.brand[50] },
  iconWrap: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  rowContent: { flex: 1, marginRight: spacing.sm },
  message: { ...typography.body, color: colors.slate[800], marginBottom: 2 },
  time: { ...typography.caption },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[600] },
});
