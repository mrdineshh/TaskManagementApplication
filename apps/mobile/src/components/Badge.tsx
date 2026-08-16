import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme';

export function Badge({ label, color }: { label: string; color?: string | null }) {
  const { colors } = useAppTheme();
  const c = color ?? colors.slate[400];
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
