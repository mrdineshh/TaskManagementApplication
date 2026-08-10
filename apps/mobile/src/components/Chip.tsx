import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    marginRight: spacing.xs,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  label: { fontSize: 13, fontWeight: '600', color: colors.slate[600] },
  labelActive: { color: colors.white },
  pressed: { opacity: 0.75 },
});
