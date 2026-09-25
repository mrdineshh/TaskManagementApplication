/**
 * Seeds baseline reference data (departments, permissions, system roles, default
 * workflow, priorities, org settings) plus mock users/tasks for local development —
 * per the user's request to build/test against mocked data before real GCP access.
 */
import { PrismaClient, WorkflowStatusCategory } from '@prisma/client';
import {
  SEED_DEPARTMENT_SLUGS,
  SEED_WORKFLOW_STATUSES,
  SEED_PRIORITIES,
  permissionKeys,
  SYSTEM_ROLE_NAMES,
} from '@taskapp/shared-types';

const prisma = new PrismaClient();

const DEPARTMENT_LABELS: Record<(typeof SEED_DEPARTMENT_SLUGS)[number], string> = {
  development: 'Development',
  'hr-admin': 'HR & Admin',
  sales: 'Sales',
  'pre-sales': 'Pre-sales',
  'customer-support': 'Customer Support',
  'finance-revenue': 'Finance & Revenue',
  management: 'Management',
  'field-sales-representatives': 'Field Sales Representatives',
  'inside-sales-representatives': 'Inside Sales Representatives',
  marketing: 'Marketing',
};

const MANAGER_PERMISSIONS = [
  'task.create',
  'task.view',
  'task.edit',
  'task.assign',
  'task.comment',
  'task.moderate',
  'department.view',
  'user.view',
  'custom_field.view',
  'workflow.view',
  'priority.view',
  'report.view',
  'report.create',
] as const;

// Permission bundles for the seeded system roles (docs/03-RBAC-AUTH.md §2.2,
// docs/10-OPEN-DECISIONS.md §G1/§G3). Head reuses Manager's bundle — the department-wide vs.
// direct-reports-only difference is scope, computed in application logic, not permission keys.
const ROLE_PERMISSIONS: Record<(typeof SYSTEM_ROLE_NAMES)[number], readonly string[]> = {
  Admin: permissionKeys,
  Management: [
    'task.view',
    'department.view',
    'user.view',
    'custom_field.view',
    'workflow.view',
    'priority.view',
    'sla.view',
    'report.view',
    'report.create',
    'report.export',
    'holiday_calendar.view',
    'on_hold_reason.view',
  ],
  Head: MANAGER_PERMISSIONS,
  Manager: MANAGER_PERMISSIONS,
  Employee: [
    'task.create',
    'task.view',
    'task.edit',
    'task.comment',
    'task.assign',
    'department.view',
    'user.view',
    'custom_field.view',
    'workflow.view',
    'priority.view',
    'on_hold_reason.view',
    'holiday_calendar.view',
  ],
};

async function main() {
  console.log('Seeding organization settings...');
  const orgCount = await prisma.organizationSettings.count();
  if (orgCount === 0) {
    await prisma.organizationSettings.create({
      data: { name: 'Econz', timezone: 'Asia/Kolkata' },
    });
  }

  console.log('Seeding departments...');
  const departments = new Map<string, string>();
  for (const slug of SEED_DEPARTMENT_SLUGS) {
    const dept = await prisma.department.upsert({
      where: { slug },
      update: {},
      create: { slug, name: DEPARTMENT_LABELS[slug] },
    });
    departments.set(slug, dept.id);
  }

  console.log('Seeding permissions...');
  for (const key of permissionKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  console.log('Seeding system roles...');
  // Only "Admin" is a protected system role per 03-RBAC-AUTH.md §2.2 — Manager/Employee are
  // seeded as convenient, ordinary (fully editable/deletable) starting-point roles.
  const roleIds = new Map<string, string>();
  for (const name of SYSTEM_ROLE_NAMES) {
    const isSystemRole = name === 'Admin';
    const role =
      (await prisma.role.findFirst({ where: { name } })) ??
      (await prisma.role.create({ data: { name, isSystemRole } }));
    roleIds.set(name, role.id);

    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...ROLE_PERMISSIONS[name]] } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log('Seeding default workflow + statuses + transitions...');
  let workflow = await prisma.workflowDefinition.findFirst({ where: { isDefault: true, departmentId: null } });
  if (!workflow) {
    workflow = await prisma.workflowDefinition.create({
      data: { name: 'Default Workflow', isDefault: true },
    });
  }
  const statusIds = new Map<string, string>();
  for (const s of SEED_WORKFLOW_STATUSES) {
    const status = await prisma.workflowStatus.upsert({
      where: { workflowId_key: { workflowId: workflow.id, key: s.key } },
      // Deliberately NOT `update: {}` like every other upsert in this file — label/color/
      // display_order stay admin-owned and untouched on re-seed, but requiresHoldReason and
      // requiresEstimateBeforeEntry are new Phase 2 system behavior, not something an Admin UI
      // has ever exposed for editing. Without backfilling these two here, re-running this
      // script against an already-seeded install (e.g. the deployed dev environment, seeded
      // before Phase 2 existed) would silently leave every existing status at false forever —
      // the mandatory-estimate/on-hold-reason gates would never actually activate there.
      update: {
        requiresHoldReason: s.requires_hold_reason,
        requiresEstimateBeforeEntry: s.requires_estimate_before_entry,
      },
      create: {
        workflowId: workflow.id,
        key: s.key,
        label: s.label,
        category: s.category as WorkflowStatusCategory,
        displayOrder: s.display_order,
        color: s.color,
        requiresHoldReason: s.requires_hold_reason,
        requiresEstimateBeforeEntry: s.requires_estimate_before_entry,
      },
    });
    statusIds.set(s.key, status.id);
  }
  // Allow forward progress through the happy path, plus escape hatches to Blocked/On
  // Hold/Cancelled from anywhere active. Resuming from On Hold is transition-free (no reason
  // required to leave it) per docs/10-OPEN-DECISIONS.md §H1.
  const happyPath: [string, string][] = [
    ['todo', 'in_progress'],
    ['todo', 'in_review'],
    ['todo', 'done'],
    ['todo', 'on_hold'],
    ['todo', 'cancelled'],
    ['in_progress', 'done'],
    ['in_progress', 'in_review'],
    ['in_progress', 'on_hold'],
    ['in_progress', 'blocked'],
    ['in_progress', 'cancelled'],
    ['in_progress', 'todo'],
    ['in_review', 'done'],
    ['in_review', 'in_progress'],
    ['in_review', 'on_hold'],
    ['in_review', 'cancelled'],
    ['on_hold', 'in_progress'],
    ['on_hold', 'done'],
    ['on_hold', 'cancelled'],
    ['on_hold', 'todo'],
    ['blocked', 'in_progress'],
    ['blocked', 'done'],
    ['blocked', 'cancelled'],
    ['done', 'in_progress'],
    ['done', 'todo'],
    ['cancelled', 'in_progress'],
    ['cancelled', 'todo'],
  ];
  for (const [from, to] of happyPath) {
    await prisma.workflowTransition.upsert({
      where: {
        workflowId_fromStatusId_toStatusId: {
          workflowId: workflow.id,
          fromStatusId: statusIds.get(from)!,
          toStatusId: statusIds.get(to)!,
        },
      },
      update: {},
      create: { workflowId: workflow.id, fromStatusId: statusIds.get(from)!, toStatusId: statusIds.get(to)! },
    });
  }

  console.log('Seeding priorities...');
  // Prisma compound-unique lookups can't take `null` for a nullable member, so org-wide
  // (department_id IS NULL) priorities use findFirst+create rather than upsert.
  const priorityIds = new Map<string, string>();
  for (const p of SEED_PRIORITIES) {
    const priority =
      (await prisma.priorityDefinition.findFirst({ where: { departmentId: null, key: p.key } })) ??
      (await prisma.priorityDefinition.create({
        data: {
          key: p.key,
          label: p.label,
          displayOrder: p.display_order,
          color: p.color,
          isDefault: p.is_default,
          departmentId: null,
        },
      }));
    priorityIds.set(p.key, priority.id);
  }

  console.log('Seeding on-hold reasons...');
  // Admin-configurable starter list (docs/10-OPEN-DECISIONS.md §H1) — Admins add/edit/remove
  // from here, this is just a sensible default so the On Hold transition isn't empty on day one.
  for (const label of ['Waiting for Customer', 'Waiting for Third-Party', 'Other']) {
    const existing = await prisma.onHoldReason.findFirst({ where: { label } });
    if (!existing) await prisma.onHoldReason.create({ data: { label } });
  }

  console.log('Seeding holiday calendar...');
  // Single demo region for now — matches OrganizationSettings' Asia/Kolkata timezone above.
  // Admin-configurable per docs/10-OPEN-DECISIONS.md §G2; this is just a starting calendar.
  const calendar = await prisma.holidayCalendar.upsert({
    where: { country_state: { country: 'India', state: 'Tamil Nadu' } },
    update: {},
    create: { country: 'India', state: 'Tamil Nadu' },
  });
  const demoHolidays = [
    { date: '2026-10-20', name: 'Diwali' },
    { date: '2026-01-14', name: 'Pongal' },
    { date: '2026-01-26', name: 'Republic Day' },
  ] as const;
  for (const h of demoHolidays) {
    await prisma.holiday.upsert({
      where: { calendarId_date: { calendarId: calendar.id, date: new Date(h.date) } },
      update: { name: h.name },
      create: { calendarId: calendar.id, date: new Date(h.date), name: h.name },
    });
  }

  console.log('Cleaning obsolete mock users & sample tasks if present...');
  const fakeEmails = [
    'admin@econz.net',
    'management@econz.net',
    'head.dev@econz.net',
    'manager.dev@econz.net',
    'employee.dev@econz.net',
    'employee.sales@econz.net',
  ];
  await prisma.task.deleteMany({});
  await prisma.savedReport.deleteMany({
    where: { createdBy: { email: { not: 'sujeeth.k@econz.net' } } },
  });
  await prisma.userRole.deleteMany({
    where: { user: { email: { not: 'sujeeth.k@econz.net' } } },
  });
  await prisma.userDepartment.deleteMany({
    where: { user: { email: { not: 'sujeeth.k@econz.net' } } },
  });
  await prisma.user.deleteMany({
    where: { email: { not: 'sujeeth.k@econz.net' } },
  });

  console.log('Seeding initial Admin user (sujeeth.k@econz.net)...');
  const REGION = { workCountry: 'India', workState: 'Tamil Nadu' };
  const adminUser = await prisma.user.upsert({
    where: { email: 'sujeeth.k@econz.net' },
    update: {
      fullName: 'Sujeeth K',
      primaryDepartmentId: departments.get('management')!,
      isActive: true,
      ...REGION,
    },
    create: {
      email: 'sujeeth.k@econz.net',
      fullName: 'Sujeeth K',
      primaryDepartmentId: departments.get('management')!,
      authProvider: 'google',
      isActive: true,
      ...REGION,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: roleIds.get('Admin')! } },
    update: { departmentOverride: null },
    create: { userId: adminUser.id, roleId: roleIds.get('Admin')!, departmentOverride: null },
  });

  console.log('Seeding starter report templates...');
  const starterTemplates = [
    {
      name: 'Department Overview',
      config: {
        metrics: ['task_counts_by_status', 'task_counts_by_priority'],
        dimensions: [],
        date_range: { preset: 'this_month' },
        chart_type: 'bar',
        filters: {},
      },
    },
    {
      name: 'Overdue Tasks',
      config: {
        metrics: ['overdue_count', 'overdue_rate'],
        dimensions: [],
        date_range: { preset: 'this_month' },
        chart_type: 'table',
        filters: {},
      },
    },
    {
      name: 'Team Workload',
      config: {
        metrics: ['workload_distribution'],
        dimensions: [],
        date_range: { preset: 'this_month' },
        chart_type: 'bar',
        filters: {},
      },
    },
    {
      name: 'SLA Compliance',
      config: {
        metrics: ['sla_compliance_rate'],
        dimensions: [],
        date_range: { preset: 'this_month' },
        chart_type: 'bar',
        filters: {},
      },
    },
  ] as const;

  for (const t of starterTemplates) {
    const existing = await prisma.savedReport.findFirst({ where: { name: t.name, isTemplate: true } });
    if (existing) continue;
    await prisma.savedReport.create({
      data: {
        name: t.name,
        createdById: adminUser.id,
        config: t.config,
        visibility: 'shared_org',
        isTemplate: true,
      },
    });
  }

  console.log('Seed complete.');
  console.log('Admin user initialized: sujeeth.k@econz.net (Role: Admin).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
