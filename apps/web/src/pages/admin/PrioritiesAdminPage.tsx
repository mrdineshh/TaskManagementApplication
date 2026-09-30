import { useState } from 'react';
import {
  useCreatePriority,
  useDeletePriority,
  usePrioritiesAdmin,
  useUpdatePriority,
  useCreateCustomField,
  useCustomFieldsAdmin,
  useDeleteCustomField,
  useDepartmentsAdmin,
  useUpdateCustomField,
} from '../../features/admin/hooks';
import { Badge } from '../../components/Badge';
import { NeuSelect } from '../../components/NeuSelect';
import { Target, Tags, Plus, ArrowUpDown } from 'lucide-react';

const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'multi_select', 'user_reference'] as const;

export function PrioritiesAdminPage() {
  // ── Priorities State & Mutations ──
  const { data: priorities } = usePrioritiesAdmin();
  const createPriority = useCreatePriority();
  const updatePriority = useUpdatePriority();
  const deletePriority = useDeletePriority();

  const [priorityKey, setPriorityKey] = useState('');
  const [priorityLabel, setPriorityLabel] = useState('');
  const [priorityColor, setPriorityColor] = useState('#3b82f6');

  const [editingPriorityId, setEditingPriorityId] = useState<string | undefined>(undefined);
  const [editPriorityLabel, setEditPriorityLabel] = useState('');
  const [editPriorityColor, setEditPriorityColor] = useState('#3b82f6');

  function startEditPriority(p: { id: string; label: string; color: string | null }) {
    setEditingPriorityId(p.id);
    setEditPriorityLabel(p.label);
    setEditPriorityColor(p.color ?? '#3b82f6');
  }

  async function saveEditPriority(id: string) {
    if (!editPriorityLabel.trim()) return;
    await updatePriority.mutateAsync({ id, data: { label: editPriorityLabel, color: editPriorityColor } });
    setEditingPriorityId(undefined);
  }

  async function handleCreatePriority(e: React.FormEvent) {
    e.preventDefault();
    if (!priorityKey.trim() || !priorityLabel.trim()) return;
    await createPriority.mutateAsync({
      key: priorityKey,
      label: priorityLabel,
      color: priorityColor,
      display_order: priorities?.length ?? 0,
      department_id: null,
      is_default: false,
    });
    setPriorityKey('');
    setPriorityLabel('');
  }

  // ── Custom Fields State & Mutations ──
  const { data: departments } = useDepartmentsAdmin();
  const [departmentId, setDepartmentId] = useState('');
  const { data: fields } = useCustomFieldsAdmin(departmentId || 'org');
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();

  const [fieldKey, setFieldKey] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<(typeof FIELD_TYPES)[number]>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);

  const [editingFieldId, setEditingFieldId] = useState<string | undefined>(undefined);
  const [editFieldLabel, setEditFieldLabel] = useState('');
  const [editFieldOptions, setEditFieldOptions] = useState('');
  const [editFieldRequired, setEditFieldRequired] = useState(false);

  function startEditField(f: { id: string; label: string; options: string[] | null; is_required: boolean }) {
    setEditingFieldId(f.id);
    setEditFieldLabel(f.label);
    setEditFieldOptions((f.options ?? []).join(', '));
    setEditFieldRequired(f.is_required);
  }

  async function saveEditField(f: { id: string; field_type: string }) {
    if (!editFieldLabel.trim()) return;
    await updateField.mutateAsync({
      id: f.id,
      data: {
        label: editFieldLabel,
        options: ['select', 'multi_select'].includes(f.field_type) ? editFieldOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        is_required: editFieldRequired,
      },
    });
    setEditingFieldId(undefined);
  }

  async function handleCreateField(e: React.FormEvent) {
    e.preventDefault();
    if (!fieldKey.trim() || !fieldLabel.trim()) return;
    await createField.mutateAsync({
      department_id: departmentId || null,
      key: fieldKey,
      label: fieldLabel,
      field_type: fieldType,
      options: ['select', 'multi_select'].includes(fieldType) ? options.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      is_required: required,
      display_order: fields?.length ?? 0,
    });
    setFieldKey('');
    setFieldLabel('');
    setOptions('');
    setRequired(false);
  }

  async function handleMoveField(index: number, direction: 'up' | 'down') {
    if (!fields) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    const currentField = fields[index];
    const targetField = fields[targetIndex];

    const currentOrder = currentField.display_order ?? index;
    const targetOrder = targetField.display_order ?? targetIndex;

    await Promise.all([
      updateField.mutateAsync({ id: currentField.id, data: { display_order: targetOrder } }),
      updateField.mutateAsync({ id: targetField.id, data: { display_order: currentOrder } }),
    ]);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── 1. Priorities Box ── */}
      <div className="neu-card p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-slate-900 border-2 border-red-600 text-red-600 shadow-2xs">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Task Priorities</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure priority levels, badge colors, and default selection</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {priorities?.length ?? 0} Priorities
          </span>
        </div>

        {/* Add priority inline form */}
        <form onSubmit={handleCreatePriority} className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50">
          <input
            value={priorityKey}
            onChange={(e) => setPriorityKey(e.target.value)}
            placeholder="key (e.g. urgent)"
            className="w-36 neu-input py-1.5 text-xs"
          />
          <input
            value={priorityLabel}
            onChange={(e) => setPriorityLabel(e.target.value)}
            placeholder="Label (e.g. Urgent)"
            className="w-40 neu-input py-1.5 text-xs"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={priorityColor}
              onChange={(e) => setPriorityColor(e.target.value)}
              className="h-8 w-10 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 bg-transparent p-0.5"
            />
          </div>
          <button type="submit" disabled={createPriority.isPending || !priorityKey.trim() || !priorityLabel.trim()} className="btn-primary !py-1.5 !px-3.5 !text-xs flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            Add Priority
          </button>
        </form>

        {/* Priorities table */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Preview</th>
                <th className="px-4 py-2.5">Key</th>
                <th className="px-4 py-2.5">Default</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white/40 dark:bg-slate-900/20">
              {priorities?.map((p) => {
                const isEditing = editingPriorityId === p.id;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editPriorityColor}
                            onChange={(e) => setEditPriorityColor(e.target.value)}
                            className="h-7 w-9 rounded cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent p-0.5"
                          />
                          <input
                            value={editPriorityLabel}
                            onChange={(e) => setEditPriorityLabel(e.target.value)}
                            className="w-32 neu-input py-1 text-xs"
                          />
                        </div>
                      ) : (
                        <Badge label={p.label} color={p.color} />
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{p.key}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => updatePriority.mutate({ id: p.id, data: { is_default: !p.is_default } })}
                        className={`text-xs font-medium px-2 py-0.5 rounded-md transition-colors ${
                          p.is_default
                            ? 'bg-white dark:bg-slate-900 border-2 border-blue-600 text-slate-900 dark:text-slate-100 font-bold shadow-2xs'
                            : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {p.is_default ? 'Default' : 'Set default'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => saveEditPriority(p.id)}
                            disabled={updatePriority.isPending}
                            className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button onClick={() => setEditingPriorityId(undefined)} className="text-xs text-slate-400 hover:underline">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2.5">
                          <button onClick={() => startEditPriority(p)} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            Edit
                          </button>
                          <button onClick={() => deletePriority.mutate(p.id)} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!priorities || priorities.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No priorities configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Custom Fields Box ── */}
      <div className="neu-card p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-slate-900 border-2 border-blue-600 text-blue-600 shadow-2xs">
              <Tags className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Custom Fields</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Add department-specific or organization-wide metadata fields</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NeuSelect
              value={departmentId}
              onChange={setDepartmentId}
              options={[
                { value: '', label: 'Org-wide fields' },
                ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
              ]}
              compact
              style={{ minWidth: '180px' }}
            />
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {fields?.length ?? 0} Fields
            </span>
          </div>
        </div>

        {/* Add field inline form */}
        <form onSubmit={handleCreateField} className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50">
          <input
            value={fieldKey}
            onChange={(e) => setFieldKey(e.target.value)}
            placeholder="key (e.g. client_tier)"
            className="w-36 neu-input py-1.5 text-xs"
          />
          <input
            value={fieldLabel}
            onChange={(e) => setFieldLabel(e.target.value)}
            placeholder="Label (e.g. Client Tier)"
            className="w-40 neu-input py-1.5 text-xs"
          />
          <NeuSelect
            value={fieldType}
            onChange={(v) => setFieldType(v as typeof fieldType)}
            options={FIELD_TYPES.map((t) => ({ value: t, label: t }))}
            compact
            style={{ minWidth: '130px' }}
          />
          {['select', 'multi_select'].includes(fieldType) && (
            <input
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Options (comma-separated)"
              className="w-48 neu-input py-1.5 text-xs"
            />
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Required
          </label>
          <button type="submit" disabled={createField.isPending || !fieldKey.trim() || !fieldLabel.trim()} className="btn-primary !py-1.5 !px-3.5 !text-xs flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            Add Field
          </button>
        </form>

        {/* Custom fields table */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2.5 w-16 text-center">Order</th>
                <th className="px-4 py-2.5">Key</th>
                <th className="px-4 py-2.5">Label</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Required</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white/40 dark:bg-slate-900/20">
              {fields?.map((f, idx) => {
                const isEditing = editingFieldId === f.id;
                return (
                  <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2.5 text-center text-xs text-slate-400">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveField(idx, 'up')}
                          disabled={idx === 0 || updateField.isPending}
                          className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveField(idx, 'down')}
                          disabled={idx === fields.length - 1 || updateField.isPending}
                          className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">{f.key}</td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            value={editFieldLabel}
                            onChange={(e) => setEditFieldLabel(e.target.value)}
                            className="w-full neu-input py-1 text-xs"
                          />
                          {['select', 'multi_select'].includes(f.field_type) && (
                            <input
                              value={editFieldOptions}
                              onChange={(e) => setEditFieldOptions(e.target.value)}
                              placeholder="Options, comma-separated"
                              className="w-full neu-input py-1 text-xs"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="font-medium text-slate-900 dark:text-slate-100">{f.label}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono">
                        {f.field_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      {isEditing ? (
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={editFieldRequired} onChange={(e) => setEditFieldRequired(e.target.checked)} />
                          Required
                        </label>
                      ) : f.is_required ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold text-xs">Yes</span>
                      ) : (
                        <span className="text-xs text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => saveEditField(f)}
                            disabled={updateField.isPending}
                            className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button onClick={() => setEditingFieldId(undefined)} className="text-xs text-slate-400 hover:underline">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2.5">
                          <button onClick={() => startEditField(f)} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            Edit
                          </button>
                          <button onClick={() => deleteField.mutate(f.id)} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!fields || fields.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No custom fields configured for this scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
