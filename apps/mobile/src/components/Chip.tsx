import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../theme';

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const { colors, radius, spacing } = useAppTheme();
  const styles = StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      marginRight: spacing.xs,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { fontSize: 13, fontWeight: '600', color: colors.slate[600] },
    labelActive: { color: colors.white },
    pressed: { opacity: 0.75 },
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}
