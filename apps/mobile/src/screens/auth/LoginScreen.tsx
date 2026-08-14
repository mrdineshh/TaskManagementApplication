import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../../lib/api-client/client';
import { useSessionStore } from '../../lib/auth/session-store';
import { Button } from '../../components/Button';
import { useAppTheme } from '../../theme';

/**
 * Same dev-provider approach as apps/web's LoginPage — real Google Sign-In (Firebase)
 * lands once GCP/Firebase project access is provided (docs/03-RBAC-AUTH.md §1.1).
 */
export function LoginScreen() {
  const [email, setEmail] = useState('admin@econz.net');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setTokens, setCurrentUser } = useSessionStore();
  const { colors, radius, spacing, typography } = useAppTheme();

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const { access_token, refresh_token } = await apiClient.auth.dev(email);
      setTokens(access_token, refresh_token);
      const me = await apiClient.me.get();
      setCurrentUser(me as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
    logo: {
      alignSelf: 'center',
      width: 64,
      height: 64,
      borderRadius: radius.xl,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: { ...typography.h1, textAlign: 'center', marginBottom: 4 },
    subtitle: { ...typography.body, color: colors.slate[500], textAlign: 'center', marginBottom: spacing.xl },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
    googleButton: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    googleButtonText: { color: colors.slate[400], fontSize: 14, fontWeight: '600' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    divider: { ...typography.caption, marginHorizontal: spacing.sm },
    inputLabel: { ...typography.label, marginBottom: spacing.xs },
    input: {
      borderWidth: 1,
      borderColor: colors.slate[300],
      borderRadius: radius.md,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs, marginBottom: spacing.xs },
    error: { color: colors.danger, fontSize: 13 },
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Ionicons name="checkmark-done" size={30} color={colors.white} />
        </View>
        <Text style={styles.title}>Task Management</Text>
        <Text style={styles.subtitle}>Sign in with your @econz.net account</Text>

        <View style={styles.card}>
          <View style={styles.googleButton}>
            <Ionicons name="logo-google" size={16} color={colors.slate[400]} style={{ marginRight: 8 }} />
            <Text style={styles.googleButtonText}>Sign in with Google (pending GCP setup)</Text>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.divider}>dev sign-in (mock)</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@econz.net"
            placeholderTextColor={colors.slate[400]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          {error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}
          <Button label={loading ? 'Signing in…' : 'Sign in (dev)'} onPress={handleLogin} loading={loading} style={{ marginTop: spacing.sm }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
