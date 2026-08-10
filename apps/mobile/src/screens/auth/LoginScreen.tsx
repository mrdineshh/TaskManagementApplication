import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { apiClient } from '../../lib/api-client/client';
import { useSessionStore } from '../../lib/auth/session-store';

/**
 * Same dev-provider approach as apps/web's LoginPage — real Google Sign-In (Firebase)
 * lands once GCP/Firebase project access is provided (docs/03-RBAC-AUTH.md §1.1).
 */
export function LoginScreen() {
  const [email, setEmail] = useState('admin@econz.net');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setTokens, setCurrentUser } = useSessionStore();

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Task Management</Text>
      <Text style={styles.subtitle}>Sign in with your @econz.net account</Text>

      <View style={styles.googleButton}>
        <Text style={styles.googleButtonText}>Sign in with Google (pending GCP setup)</Text>
      </View>

      <Text style={styles.divider}>dev sign-in (mock)</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@econz.net"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign in (dev)'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  googleButton: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 16, opacity: 0.6 },
  googleButtonText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  divider: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 },
  error: { color: '#dc2626', marginBottom: 8, fontSize: 13 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 14 },
});
