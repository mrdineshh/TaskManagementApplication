import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';

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
  const { colors, radius, spacing, typography } = useAppTheme();
  const isDisabled = disabled || loading;

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
    primary: { container: { backgroundColor: colors.primary }, label: { color: colors.white } },
    danger: { container: { backgroundColor: colors.danger }, label: { color: colors.white } },
    secondary: { container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, label: { color: colors.slate[700] } },
    ghost: { container: { backgroundColor: 'transparent' }, label: { color: colors.primary } },
  };

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
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.label, size === 'sm' && styles.labelSm, variantStyles[variant].label]}>{label}</Text>
      )}
    </Pressable>
  );
}
