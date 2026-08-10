import { View, Text, StyleSheet } from 'react-native';

export function Badge({ label, color }: { label: string; color?: string | null }) {
  const c = color ?? '#94a3b8';
  return (
    <View style={[styles.badge, { backgroundColor: `${c}33` }]}>
      <Text style={[styles.text, { color: c }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
