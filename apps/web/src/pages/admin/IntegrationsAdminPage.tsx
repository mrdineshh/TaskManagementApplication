import { useEffect, useState } from 'react';
import { useIntegrationSetting, useTestIntegrationSetting, useUpsertIntegrationSetting } from '../../features/admin/hooks';
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

/**
 * SMTP configuration — DB-stored and KMS-encrypted, editable at runtime with no redeploy
 * (docs/01-ARCHITECTURE.md §2.9a). This is where an Admin updates outbound email settings.
 */
export function IntegrationsAdminPage() {
  const { data, isLoading } = useIntegrationSetting('smtp');
  const upsert = useUpsertIntegrationSetting('smtp');
  const test = useTestIntegrationSetting('smtp');

  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [fromAddress, setFromAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const config = (data as any)?.config;
    if (config) {
      setHost(config.host ?? '');
      setPort(String(config.port ?? '587'));
      setFromAddress(config.from_address ?? '');
      setUsername(config.username ?? '');
    }
  }, [data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await upsert.mutateAsync({
      config: { host, port: Number(port), from_address: fromAddress, username, use_tls: true },
      secret: password || undefined,
    });
    setPassword('');
  }

  return (
    <div className="max-w-xl space-y-4">
      <form onSubmit={handleSave} className="space-y-5 neu-card">
        <div className="flex items-center gap-3 pb-4" style={{ borderBottom: "1px solid var(--neu-dark)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #2563EB22, #1d4ed822)", color: "#2563EB" }}>
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>SMTP — Outbound Email</h2>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>Encrypted in DB. Used for task assignments &amp; SLA breaches.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading configuration...</div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Host</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp-relay.gmail.com" className="neu-input" />
            </div>

            <div className="flex gap-3">
              <div className="w-28">
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Port</label>
                <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" className="neu-input" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>From Address</label>
                <input value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="notifications@econz.net" className="neu-input" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username or SMTP Key ID" className="neu-input" />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Password / Secret</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={(data as any)?.has_secret ? '•••••••• (unchanged)' : 'Enter SMTP password'}
                className="neu-input"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={upsert.isPending} className="btn-primary gap-2">
                {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Settings
              </button>
              <button type="button" onClick={() => test.mutate()} disabled={test.isPending} className="btn-neu gap-2">
                {test.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Test Email
              </button>
            </div>

            {test.data && (
              <div className="flex items-center gap-2 rounded-xl p-3 text-xs" style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{(test.data as any).message || 'Test email triggered successfully.'}</span>
              </div>
            )}

            {test.isError && (
              <div className="flex items-center gap-2 rounded-xl p-3 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Failed to send test email. Check server configuration.</span>
              </div>
            )}
          </>
        )}
      </form>
    </div>
  );
}
