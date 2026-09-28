import { useState } from 'react';
import { useCreateCustomField, useCustomFieldsAdmin, useDeleteCustomField, useDepartmentsAdmin, useUpdateCustomField } from '../../features/admin/hooks';
import { NeuSelect } from '../../components/NeuSelect';

const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'multi_select', 'user_reference'] as const;

export function CustomFieldsAdminPage() {
  const { data: departments } = useDepartmentsAdmin();
  const [departmentId, setDepartmentId] = useState('');
  const { data: fields } = useCustomFieldsAdmin(departmentId || 'org');
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();

  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<(typeof FIELD_TYPES)[number]>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [editLabel, setEditLabel] = useState('');
  const [editOptions, setEditOptions] = useState('');
  const [editRequired, setEditRequired] = useState(false);

  function startEdit(f: { id: string; label: string; options: string[] | null; is_required: boolean }) {
    setEditingId(f.id);
    setEditLabel(f.label);
    setEditOptions((f.options ?? []).join(', '));
    setEditRequired(f.is_required);
  }

  async function saveEdit(f: { id: string; field_type: string }) {
    if (!editLabel.trim()) return;
    await updateField.mutateAsync({
      id: f.id,
      data: {
        label: editLabel,
        options: ['select', 'multi_select'].includes(f.field_type) ? editOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        is_required: editRequired,
      },
    });
    setEditingId(undefined);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim() || !label.trim()) return;
    await createField.mutateAsync({
      department_id: departmentId || null,
      key,
      label,
      field_type: fieldType,
      options: ['select', 'multi_select'].includes(fieldType) ? options.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      is_required: required,
      display_order: fields?.length ?? 0,
    });
    setKey('');
    setLabel('');
    setOptions('');
    setRequired(false);
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    if (!fields) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    const currentField = fields[index];
    const targetField = fields[targetIndex];

    // Swap display_order
    const currentOrder = currentField.display_order ?? index;
    const targetOrder = targetField.display_order ?? targetIndex;

    await Promise.all([
      updateField.mutateAsync({ id: currentField.id, data: { display_order: targetOrder } }),
      updateField.mutateAsync({ id: targetField.id, data: { display_order: currentOrder } }),
    ]);
  }

  return (
    <div className="space-y-4">
      <NeuSelect
        value={departmentId}
        onChange={setDepartmentId}
        options={[
          { value: '', label: 'Org-wide fields' },
          ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
        ]}
        style={{ minWidth: '200px' }}
      />

      <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2 neu-card !p-4">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" className="w-32 neu-input" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="w-40 neu-input" />
        <NeuSelect
          value={fieldType}
          onChange={(v) => setFieldType(v as typeof fieldType)}
          options={FIELD_TYPES.map((t) => ({ value: t, label: t }))}
          style={{ minWidth: '140px' }}
        />
        {['select', 'multi_select'].includes(fieldType) && (
          <input
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="Options, comma-separated"
            className="w-56 neu-input"
          />
        )}
        <label className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        <button type="submit" className="btn-primary">
          Add field
        </button>
      </form>

      <div className="neu-card !p-0 overflow-hidden rounded-2xl shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 w-12 text-center">Order</th>
              <th className="px-4 py-2">Key</th>
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Required</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields?.map((f, idx) => {
              const isEditing = editingId === f.id;
              return (
                <tr key={f.id} className=" hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-3 py-2 text-center text-xs text-slate-400">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0 || updateField.isPending}
                        className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === fields.length - 1 || updateField.isPending}
                        className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">{f.key}</td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
                        />
                        {['select', 'multi_select'].includes(f.field_type) && (
                          <input
                            value={editOptions}
                            onChange={(e) => setEditOptions(e.target.value)}
                            placeholder="Options, comma-separated"
                            className="w-full neu-input text-xs"
                          />
                        )}
                      </div>
                    ) : (
                      <span className="break-words leading-snug">{f.label}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono">
                      {f.field_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {isEditing ? (
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={editRequired} onChange={(e) => setEditRequired(e.target.checked)} />
                        Required
                      </label>
                    ) : f.is_required ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Yes</span>
                    ) : (
                      'No'
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(f)}
                          disabled={updateField.isPending}
                          className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingId(undefined)} className="text-xs text-slate-400 hover:underline">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(f)} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
                          Edit
                        </button>
                        <button onClick={() => deleteField.mutate(f.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {fields?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  No custom fields yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
