import { useSessionStore } from '../lib/auth/session-store';
import { useSetActiveRole } from '../features/settings/hooks';
import { resolveActiveRoleName } from '../lib/auth/roles';

/**
 * Role toggle (docs/10-OPEN-DECISIONS.md §G3) — only rendered when the user actually holds
 * more than one role; switching reframes nav/dashboard content only, never permissions
 * (those stay the full union of every role held, enforced server-side regardless of this).
 */
export function RoleSwitcher({ collapsed }: { collapsed: boolean }) {
  const currentUser = useSessionStore((s) => s.currentUser);
  const setActiveRole = useSetActiveRole();
  if (!currentUser || currentUser.roles.length <= 1) return null;

  const activeName = resolveActiveRoleName(currentUser);
  const activeId = currentUser.roles.find((r) => r.name === activeName)?.id ?? '';

  if (collapsed) {
    return (
      <div className="px-2 pb-2" title={`Viewing as ${activeName}`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-100 text-xs font-semibold text-brand-700">
          {activeName?.[0] ?? '?'}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pb-2">
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Viewing as</label>
      <select
        value={activeId}
        onChange={(e) => setActiveRole.mutate(e.target.value)}
        disabled={setActiveRole.isPending}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
      >
        {currentUser.roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
    </div>
  );
}
