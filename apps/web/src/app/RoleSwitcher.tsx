import { useSessionStore } from '../lib/auth/session-store';
import { useSetActiveRole } from '../features/settings/hooks';
import { resolveActiveRoleName } from '../lib/auth/roles';
import { NeuSelect } from '../components/NeuSelect';

/**
 * Role toggle (docs/10-OPEN-DECISIONS.md §G3) — only rendered when the user actually holds
 * more than one role; switching reframes nav/dashboard content only, never permissions.
 */
export function RoleSwitcher({ collapsed }: { collapsed: boolean }) {
  const currentUser = useSessionStore((s) => s.currentUser);
  const setActiveRole = useSetActiveRole();
  if (!currentUser || !Array.isArray(currentUser.roles) || currentUser.roles.length <= 1) return null;

  const activeName = resolveActiveRoleName(currentUser);
  const activeId = currentUser.roles.find((r) => r.name === activeName)?.id ?? '';

  if (collapsed) {
    return (
      <div className="px-1 pb-2 flex justify-center" title={`Viewing as ${activeName}`}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold"
          style={{ background: 'rgba(37,99,235,0.12)', color: '#2563EB' }}
        >
          {activeName?.[0] ?? '?'}
        </div>
      </div>
    );
  }

  return (
    <div className="px-1 pb-2">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
        Viewing as
      </label>
      <NeuSelect
        value={activeId}
        onChange={(v) => setActiveRole.mutate(v)}
        disabled={setActiveRole.isPending}
        options={currentUser.roles.map((role) => ({
          value: role.id,
          label: role.name,
        }))}
        compact
        style={{ width: '100%' }}
      />
    </div>
  );
}
