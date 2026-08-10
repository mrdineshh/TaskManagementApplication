import { z } from 'zod';

export const customFieldTypes = [
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'multi_select',
  'user_reference',
] as const;
export type CustomFieldType = (typeof customFieldTypes)[number];

export interface CustomFieldDefinition {
  id: string;
  department_id: string | null;
  key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
}

export interface TaskCustomFieldValue {
  id: string;
  task_id: string;
  field_definition_id: string;
  value: string | number | boolean | string[] | null;
}

export const createCustomFieldSchema = z
  .object({
    department_id: z.string().uuid().nullable().default(null),
    key: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9_]+$/, 'key must be lowercase snake_case'),
    label: z.string().min(1).max(100),
    field_type: z.enum(customFieldTypes),
    options: z.array(z.string()).optional(),
    is_required: z.boolean().default(false),
    display_order: z.number().int().min(0).default(0),
  })
  .refine(
    (v) => !['select', 'multi_select'].includes(v.field_type) || (v.options && v.options.length > 0),
    { message: 'options is required for select/multi_select fields', path: ['options'] },
  );
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>;

export const updateCustomFieldSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;

/** Builds a Zod validator for a single custom field value based on its declared type — used
 * server-side (API layer, per 02-DATA-MODEL.md §4) and client-side (dynamic task forms). */
export function zodSchemaForCustomField(def: Pick<CustomFieldDefinition, 'field_type' | 'options' | 'is_required'>) {
  let schema: z.ZodTypeAny;
  switch (def.field_type) {
    case 'text':
      schema = z.string();
      break;
    case 'number':
      schema = z.number();
      break;
    case 'date':
      schema = z.string().datetime();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'select':
      schema = z.enum((def.options ?? []) as [string, ...string[]]);
      break;
    case 'multi_select':
      schema = z.array(z.enum((def.options ?? []) as [string, ...string[]]));
      break;
    case 'user_reference':
      schema = z.string().uuid();
      break;
  }
  return def.is_required ? schema : schema.nullable().optional();
}
