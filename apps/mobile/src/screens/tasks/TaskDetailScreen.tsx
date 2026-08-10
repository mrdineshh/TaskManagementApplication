import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ScrollView, Alert } from 'react-native';
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
import type { TasksStackParamList } from '../../app/Navigation';

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskDetail'>;

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

  if (isLoading || !task) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Loading…</Text>
      </View>
    );
  }

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
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{task.title}</Text>
      {task.description && <Text style={styles.description}>{task.description}</Text>}

      <View style={styles.badgeRow}>
        {(task as any).status && <Badge label={(task as any).status.label} color={(task as any).status.color} />}
        {(task as any).priority && <Badge label={(task as any).priority.label} color={(task as any).priority.color} />}
      </View>

      {available.length > 0 && (
        <View style={styles.transitionsSection}>
          <Text style={styles.sectionLabel}>Move to</Text>
          <View style={styles.transitionRow}>
            {available.map((t: any) => (
              <Pressable key={t.id} style={styles.transitionButton} onPress={() => handleTransition(t.to_status_id)}>
                <Text style={styles.transitionButtonText}>{statusLabel(t.to_status_id)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>Comments</Text>
      <FlatList
        data={comments ?? []}
        keyExtractor={(c: any) => c.id}
        scrollEnabled={false}
        ListEmptyComponent={<Text style={styles.empty}>No comments yet.</Text>}
        renderItem={({ item }: { item: any }) => (
          <View style={styles.comment}>
            <Text style={styles.commentBody}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.commentInputRow}>
        <TextInput
          value={commentBody}
          onChangeText={setCommentBody}
          placeholder="Add a comment…"
          style={styles.commentInput}
        />
        <Pressable style={styles.postButton} onPress={handlePost}>
          <Text style={styles.postButtonText}>Post</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  description: { fontSize: 14, color: '#475569', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  transitionsSection: { marginBottom: 16 },
  transitionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  transitionButton: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  transitionButtonText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  comment: { backgroundColor: 'white', borderRadius: 8, padding: 10, marginBottom: 8 },
  commentBody: { fontSize: 13, color: '#334155' },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 24 },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13 },
  postButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  postButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  empty: { color: '#94a3b8', fontSize: 13 },
});
