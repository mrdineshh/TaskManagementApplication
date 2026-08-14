import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

/** Same light/dark toggle as apps/web's ThemeToggle.tsx — a tap always sets an explicit
 * preference; 'system' only applies before the user has touched it. */
export function ThemeToggleButton() {
  const { scheme, colors, setPreference } = useAppTheme();
  const isDark = scheme === 'dark';

  return (
    <Pressable
      onPress={() => setPreference(isDark ? 'light' : 'dark')}
      hitSlop={10}
      style={[styles.button, { backgroundColor: colors.surfaceAlt }]}
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      accessibilityRole="button"
    >
      <Ionicons name={isDark ? 'sunny' : 'moon'} size={16} color={colors.textSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
