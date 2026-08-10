import { useState } from 'react';
import { useCreateCustomField, useCustomFieldsAdmin, useDeleteCustomField, useDepartmentsAdmin } from '../../features/admin/hooks';

const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'multi_select', 'user_reference'] as const;

export function CustomFieldsAdminPage() {
  const { data: departments } = useDepartmentsAdmin();
  const [departmentId, setDepartmentId] = useState('');
  const { data: fields } = useCustomFieldsAdmin(departmentId || undefined);
  const createField = useCreateCustomField();
  const deleteField = useDeleteCustomField();

  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<(typeof FIELD_TYPES)[number]>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);

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

  return (
    <div className="space-y-4">
      <select
        value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      >
        <option value="">Org-wide fields</option>
        {departments?.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        <select value={fieldType} onChange={(e) => setFieldType(e.target.value as typeof fieldType)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {['select', 'multi_select'].includes(fieldType) && (
          <input
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="Options, comma-separated"
            className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        )}
        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Add field
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Key</th>
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Required</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields?.map((f) => (
              <tr key={f.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{f.key}</td>
                <td className="px-4 py-2">{f.label}</td>
                <td className="px-4 py-2 text-slate-500">{f.field_type}</td>
                <td className="px-4 py-2 text-slate-500">{f.is_required ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => deleteField.mutate(f.id)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {fields?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
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
