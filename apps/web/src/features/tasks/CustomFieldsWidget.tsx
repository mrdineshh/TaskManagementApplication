import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FormInput, Save, Check } from 'lucide-react';
import { toast } from '../../lib/toast/toast-store';
import { apiClient } from '../../lib/api-client/client';
import { NeuSelect } from '../../components/NeuSelect';
import { NeuDatePicker } from '../../components/NeuDatePicker';
import type { CustomFieldDefinition } from '@taskapp/shared-types';

interface CustomFieldsWidgetProps {
  taskId: string;
  departmentId?: string;
  existingValues?: Array<{ fieldDefinitionId?: string; field_definition_id?: string; value: any }>;
  canEdit?: boolean;
}

export function CustomFieldsWidget({
  taskId,
  departmentId,
  existingValues,
  canEdit = true,
}: CustomFieldsWidgetProps) {
  const qc = useQueryClient();

  const { data: definitions, isLoading } = useQuery({
    queryKey: ['custom-fields', departmentId ?? 'org'],
    queryFn: () => apiClient.customFields.list(departmentId),
    enabled: true,
  });

  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!definitions) return;
    const initial: Record<string, any> = {};
    for (const def of definitions) {
      const existing = existingValues?.find(
        (v) => (v.fieldDefinitionId ?? v.field_definition_id) === def.id,
      );
      if (existing !== undefined) {
        initial[def.key] = existing.value;
      } else {
        initial[def.key] = def.field_type === 'boolean' ? false : '';
      }
    }
    setFormValues(initial);
    setDirty(false);
  }, [definitions, existingValues]);

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, any>) =>
      apiClient.tasks.update(taskId, { custom_field_values: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', taskId] });
      setDirty(false);
      toast.success('Custom fields saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !definitions || definitions.length === 0) {
    return null;
  }

  function handleChange(key: string, value: any) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate(formValues);
  }

  return (
    <div className="neu-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-amber-600 bg-white dark:bg-slate-900 text-amber-600 shadow-neu-sm">
            <FormInput className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Custom Fields</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Department &amp; workflow specific metadata</p>
          </div>
        </div>
        {canEdit && dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-amber-600 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 shadow-neu-sm transition-all shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            {saveMutation.isPending ? 'Saving…' : 'Save Fields'}
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {definitions.map((def: CustomFieldDefinition) => {
          const val = formValues[def.key];

          return (
            <div key={def.id} className="space-y-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {def.label}
                {def.is_required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {def.field_type === 'boolean' ? (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    disabled={!canEdit}
                    onChange={(e) => handleChange(def.key, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{Boolean(val) ? 'Yes' : 'No'}</span>
                </label>
              ) : def.field_type === 'select' ? (
                <NeuSelect
                  value={val ?? ''}
                  disabled={!canEdit}
                  onChange={(v) => handleChange(def.key, v)}
                  options={[
                    { value: '', label: 'Select an option…' },
                    ...(def.options ?? []).map((opt) => ({ value: opt, label: opt })),
                  ]}
                  placeholder="Select an option…"
                  compact
                  style={{ width: '100%' }}
                />
              ) : def.field_type === 'number' ? (
                <input
                  type="number"
                  value={val ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => handleChange(def.key, e.target.value === '' ? null : Number(e.target.value))}
                  placeholder={`Enter ${def.label.toLowerCase()}`}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none"
                />
              ) : def.field_type === 'date' ? (
                <NeuDatePicker
                  value={val ? String(val).slice(0, 10) : ''}
                  disabled={!canEdit}
                  onChange={(d) => handleChange(def.key, d)}
                  placeholder={`Select ${def.label.toLowerCase()}`}
                  compact
                  style={{ width: '100%' }}
                />
              ) : (
                <input
                  type="text"
                  value={val ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => handleChange(def.key, e.target.value)}
                  placeholder={`Enter ${def.label.toLowerCase()}`}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none"
                />
              )}
            </div>
          );
        })}
      </form>
    </div>
  );
}
