import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        variantStyles[variant].container,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? colors.white : colors.brand[600]} />
      ) : (
        <Text style={[styles.label, size === 'sm' && styles.labelSm, variantStyles[variant].label]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sm: { paddingVertical: 8, paddingHorizontal: spacing.md },
  label: { ...typography.title, fontWeight: '600' },
  labelSm: { fontSize: 13 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});

const variantStyles: Record<Variant, { container: ViewStyle; label: { color: string } }> = {
  primary: { container: { backgroundColor: colors.brand[600] }, label: { color: colors.white } },
  danger: { container: { backgroundColor: colors.danger }, label: { color: colors.white } },
  secondary: { container: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate[300] }, label: { color: colors.slate[700] } },
  ghost: { container: { backgroundColor: 'transparent' }, label: { color: colors.brand[600] } },
};
