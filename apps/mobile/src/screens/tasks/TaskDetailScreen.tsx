import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useTask,
  useTaskComments,
  useAddComment,
  useTransitionTask,
  useWorkflowStatuses,
  useWorkflowTransitions,
} from '../../features/tasks/hooks';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { LoadingView } from '../../components/LoadingView';
import { EmptyState } from '../../components/EmptyState';
import { useAppTheme } from '../../theme';
import type { TasksStackParamList } from '../../app/Navigation';

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskDetail'>;

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

/**
 * View/update assigned tasks, change status (within allowed transitions), comment —
 * the day-to-day mobile flow (docs/07-FRONTEND-MOBILE.md §4). Camera-capture attachments
 * are a natural mobile-native follow-up, not yet wired here.
 */
export function TaskDetailScreen({ route }: Props) {
  const { id } = route.params;
  const { data: task, isLoading } = useTask(id);
  const { data: comments } = useTaskComments(id);
  const { data: statuses } = useWorkflowStatuses(task?.workflow_id);
  const { data: transitions } = useWorkflowTransitions(task?.workflow_id);
  const transitionTask = useTransitionTask(id);
  const addComment = useAddComment(id);
  const [commentBody, setCommentBody] = useState('');
  const { colors, radius, spacing, typography } = useAppTheme();

  const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, padding: 16 },
    title: { ...typography.h2, marginBottom: 6 },
    description: { ...typography.body, marginBottom: spacing.md },
    badgeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    metaRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { ...typography.caption },
    section: { marginBottom: spacing.lg },
    sectionLabel: { ...typography.label, marginBottom: spacing.sm },
    transitionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    commentBody: { ...typography.body, marginBottom: 4 },
    commentTime: { ...typography.caption },
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.slate[300],
      borderRadius: radius.md,
      padding: 10,
      fontSize: 13,
      color: colors.text,
      maxHeight: 100,
    },
  });

  if (isLoading || !task) return <LoadingView />;

  const available = (transitions ?? []).filter((t: any) => t.from_status_id === task.status_id);
  const statusLabel = (statusId: string) => statuses?.find((s: any) => s.id === statusId)?.label ?? statusId;

  async function handleTransition(toStatusId: string) {
    try {
      await transitionTask.mutateAsync(toStatusId);
    } catch (err) {
      Alert.alert('Transition failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function handlePost() {
    if (!commentBody.trim()) return;
    await addComment.mutateAsync(commentBody);
    setCommentBody('');
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.lg }}>
        <Text style={styles.title}>{task.title}</Text>
        {task.description ? <Text style={styles.description}>{task.description}</Text> : null}

        <View style={styles.badgeRow}>
          {(task as any).status && <Badge label={(task as any).status.label} color={(task as any).status.color} />}
          {(task as any).priority && <Badge label={(task as any).priority.label} color={(task as any).priority.color} />}
        </View>

        {(task.due_date || (task as any).assignee) && (
          <View style={styles.metaRow}>
            {task.due_date && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={colors.slate[400]} />
                <Text style={styles.metaText}>Due {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
              </View>
            )}
            {(task as any).assignee && (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={14} color={colors.slate[400]} />
                <Text style={styles.metaText}>{(task as any).assignee.full_name}</Text>
              </View>
            )}
          </View>
        )}

        {available.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Move to</Text>
            <View style={styles.transitionRow}>
              {available.map((t: any) => (
                <Button
                  key={t.id}
                  label={statusLabel(t.to_status_id)}
                  variant="secondary"
                  size="sm"
                  onPress={() => handleTransition(t.to_status_id)}
                  loading={transitionTask.isPending}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Comments</Text>
          <FlatList
            data={comments ?? []}
            keyExtractor={(c: any) => c.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
            ListEmptyComponent={<EmptyState icon="chatbubble-outline" title="No comments yet" />}
            renderItem={({ item }: { item: any }) => (
              <Card>
                <Text style={styles.commentBody}>{item.body}</Text>
                <Text style={styles.commentTime}>{relativeTime(item.created_at)}</Text>
              </Card>
            )}
          />
        </View>
      </ScrollView>

      <View style={styles.commentInputRow}>
        <TextInput
          value={commentBody}
          onChangeText={setCommentBody}
          placeholder="Add a comment…"
          placeholderTextColor={colors.slate[400]}
          style={styles.commentInput}
          multiline
        />
        <Button label="Post" onPress={handlePost} size="sm" disabled={!commentBody.trim()} loading={addComment.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
