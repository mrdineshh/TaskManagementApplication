import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../../lib/api-client/client';
import { useSessionStore } from '../../lib/auth/session-store';
import { Button } from '../../components/Button';
import { useAppTheme } from '../../theme';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google Sign-In (docs/03-RBAC-AUTH.md §1.1) is enabled once app.json's extra.googleOAuthClientId
 * (web) and extra.googleAndroidClientId (native) are set (docs/10-OPEN-DECISIONS.md §M4); the dev
 * auth provider stays available underneath for local development and exercises the exact same
 * login → JWT → session flow.
 *
 * expo-auth-session's proxy (auth.expo.io) is deprecated and no longer wired into this SDK's
 * makeRedirectUri() — Android/iOS need their own native OAuth client (registered against this
 * app's package name + signing certificate, docs/10-OPEN-DECISIONS.md §M4) and a real
 * development build (Expo Go can't hold a stable native redirect scheme), not just a webClientId.
 */
export function LoginScreen() {
  const [email, setEmail] = useState('admin@econz.net');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setTokens, setCurrentUser } = useSessionStore();
  const { colors, radius, spacing, typography } = useAppTheme();

  const webClientId = Constants.expoConfig?.extra?.googleOAuthClientId as string | undefined;
  const androidClientId = Constants.expoConfig?.extra?.googleAndroidClientId as string | undefined;

  // The web id as a platform id is a harmless placeholder, never actually used for sign-in — it
  // only exists so useIdTokenAuthRequest's internal useMemo has *some* string to read on Android
  // before a real androidClientId is configured, since it throws synchronously at render time
  // otherwise (confirmed by reading expo-auth-session's source: ProviderUtils.invariantClientId).
  // Whether Google Sign-In actually works is gated by googleSignInReady below, not by this.
  const platformClientId = Platform.OS === 'android' ? androidClientId : webClientId;
  const googleSignInReady = Platform.OS === 'android' ? !!androidClientId : !!webClientId;

  // Android/iOS OAuth clients from Google use a redirect scheme derived from the client id itself
  // (reversed), not the app's own package id — see docs.expo.dev/guides/google-authentication.
  const nativeRedirectScheme = useMemo(() => {
    if (!androidClientId) return undefined;
    const prefix = androidClientId.split('.apps.googleusercontent.com')[0];
    return `com.googleusercontent.apps.${prefix}:/oauthredirect`;
  }, [androidClientId]);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId: webClientId || undefined,
      androidClientId: (platformClientId || webClientId) || undefined,
    },
    nativeRedirectScheme ? { native: nativeRedirectScheme } : {}
  );

  async function finishLogin(accessToken: string, refreshToken: string) {
    setTokens(accessToken, refreshToken);
    const me = await apiClient.me.get();
    setCurrentUser(me as never);
  }

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const { access_token, refresh_token } = await apiClient.auth.dev(email);
      await finishLogin(access_token, refresh_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      setLoading(true);
      setError(null);
      apiClient.auth
        .google(response.params.id_token)
        .then(({ access_token, refresh_token }) => finishLogin(access_token, refresh_token))
        .catch((err) => setError(err instanceof Error ? err.message : 'Google sign-in failed'))
        .finally(() => setLoading(false));
    } else if (response?.type === 'error') {
      setError('Google sign-in failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

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
    googleButtonDisabled: { opacity: 0.6 },
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
          <Pressable
            style={[styles.googleButton, (!googleSignInReady || !request || loading) && styles.googleButtonDisabled]}
            onPress={() => promptAsync()}
            disabled={!googleSignInReady || !request || loading}
          >
            <Ionicons name="logo-google" size={16} color={colors.slate[400]} style={{ marginRight: 8 }} />
            <Text style={styles.googleButtonText}>
              {googleSignInReady ? 'Sign in with Google' : 'Sign in with Google (pending GCP setup)'}
            </Text>
          </Pressable>

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
