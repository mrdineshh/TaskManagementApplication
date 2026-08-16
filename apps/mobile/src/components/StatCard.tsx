import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

export function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color?: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const { colors, radius, spacing, typography, shadow } = useAppTheme();
  const tint = color ?? colors.primary;
  const styles = StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    iconWrap: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    value: { ...typography.h2, marginBottom: 2 },
    label: { ...typography.label },
  });

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${tint}1a` }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
