import { useEffect, useState } from 'react';
import { useIntegrationSetting, useTestIntegrationSetting, useUpsertIntegrationSetting } from '../../features/admin/hooks';

/**
 * SMTP configuration — DB-stored and KMS-encrypted, editable at runtime with no redeploy
 * (docs/01-ARCHITECTURE.md §2.9a). This is where an Admin updates outbound email settings.
 */
export function IntegrationsAdminPage() {
  const { data } = useIntegrationSetting('smtp');
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
    <div className="max-w-lg space-y-4">
      <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">SMTP (outbound email)</h2>
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp-relay.gmail.com" className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm" />
        <div className="flex gap-2">
          <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="Port" className="w-24 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm" />
          <input value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="from@econz.net" className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm" />
        </div>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={(data as any)?.has_secret ? '•••••••• (unchanged)' : 'Password'}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            Save
          </button>
          <button type="button" onClick={() => test.mutate()} className="rounded-md border border-slate-300 dark:border-slate-700 px-4 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-950">
            Send test email
          </button>
        </div>
        {test.data && <p className="text-sm text-slate-500 dark:text-slate-400">{(test.data as any).message}</p>}
      </form>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Until real Google Workspace SMTP credentials are provided, saved config is exercised end-to-end but
        emails are logged server-side rather than actually sent.
      </p>
    </div>
  );
}
