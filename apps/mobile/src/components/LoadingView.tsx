import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export function LoadingView() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.brand[600]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate[50] },
});
