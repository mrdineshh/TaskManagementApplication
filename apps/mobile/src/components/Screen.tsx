import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../theme';

/** Consistent background + safe-area handling for every screen, so nothing sits under the notch/status bar. */
export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  style,
  padded = true,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
  padded?: boolean;
}) {
  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, style]}>
      <View style={[styles.container, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.slate[50] },
  container: { flex: 1 },
  padded: { paddingHorizontal: 16 },
});
