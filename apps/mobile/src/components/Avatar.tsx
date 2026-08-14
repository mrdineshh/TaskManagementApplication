import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

const PALETTE = ['#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#d97706', '#db2777', '#65a30d', '#dc2626'];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Initials-based avatar — no photo upload in scope, this keeps assignee/author identity visible without one. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const { radius, colors } = useAppTheme();
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: radius.pill, backgroundColor: colorForName(name) }]}>
      <Text style={[styles.text, { fontSize: size * 0.4, color: colors.white }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
});
