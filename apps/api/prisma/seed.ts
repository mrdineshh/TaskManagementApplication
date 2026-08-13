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
// Management gets every viewing permission but no *.manage key (those stay Admin-only).
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
  ],
  Head: MANAGER_PERMISSIONS,
  Manager: MANAGER_PERMISSIONS,
  Employee: ['task.view', 'task.edit', 'task.comment', 'department.view'],
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
      update: {},
      create: {
        workflowId: workflow.id,
        key: s.key,
        label: s.label,
        category: s.category as WorkflowStatusCategory,
        displayOrder: s.display_order,
        color: s.color,
      },
    });
    statusIds.set(s.key, status.id);
  }
  // Allow forward progress through the happy path, plus escape hatches to Blocked/Cancelled from anywhere active.
  const happyPath: [string, string][] = [
    ['todo', 'in_progress'],
    ['in_progress', 'in_review'],
    ['in_review', 'done'],
    ['in_review', 'in_progress'],
    ['todo', 'cancelled'],
    ['in_progress', 'blocked'],
    ['blocked', 'in_progress'],
    ['in_progress', 'cancelled'],
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

  console.log('Seeding mock users...');
  const REGION = { workCountry: 'India', workState: 'Tamil Nadu' };
  const mockUsers = [
    { email: 'admin@econz.net', fullName: 'Ada Admin', dept: 'management', role: 'Admin' },
    { email: 'management@econz.net', fullName: 'Mike Management', dept: 'management', role: 'Management' },
    { email: 'head.dev@econz.net', fullName: 'Hana Head', dept: 'development', role: 'Head' },
    {
      email: 'manager.dev@econz.net',
      fullName: 'Mona Manager',
      dept: 'development',
      role: 'Manager',
      managerEmail: 'head.dev@econz.net',
    },
    {
      email: 'employee.dev@econz.net',
      fullName: 'Ravi Employee',
      dept: 'development',
      role: 'Employee',
      managerEmail: 'manager.dev@econz.net',
    },
    { email: 'employee.sales@econz.net', fullName: 'Sara Sales', dept: 'sales', role: 'Employee' },
  ] as const;

  const userIds = new Map<string, string>();
  for (const u of mockUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        fullName: u.fullName,
        primaryDepartmentId: departments.get(u.dept)!,
        authProvider: 'google',
        ...REGION,
      },
    });
    userIds.set(u.email, user.id);
    // Manager/Employee/Head are generic, department_id-NULL role templates (reused across every
    // department) — departmentOverride is what actually narrows this specific assignment to
    // the user's department, per 02-DATA-MODEL.md §2.4. Admin/Management stay unscoped (no
    // override) — Management's cross-department visibility relies on this exact mechanism.
    const departmentOverride = u.role === 'Admin' || u.role === 'Management' ? null : departments.get(u.dept)!;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleIds.get(u.role)! } },
      update: { departmentOverride },
      create: { userId: user.id, roleId: roleIds.get(u.role)!, departmentOverride },
    });
  }

  // "reports to" links (docs/10-OPEN-DECISIONS.md §G1) — set after every user above exists,
  // since a manager's own id has to already be known.
  for (const u of mockUsers) {
    if (!('managerEmail' in u)) continue;
    await prisma.user.update({
      where: { id: userIds.get(u.email)! },
      data: { managerId: userIds.get(u.managerEmail)! },
    });
  }

  console.log('Seeding department head...');
  await prisma.department.update({
    where: { id: departments.get('development')! },
    data: { headUserId: userIds.get('head.dev@econz.net')! },
  });

  console.log('Seeding mock tasks...');
  const admin = userIds.get('admin@econz.net')!;
  const devEmployee = userIds.get('employee.dev@econz.net')!;
  const salesEmployee = userIds.get('employee.sales@econz.net')!;

  const sampleTasks = [
    {
      title: 'Set up CI pipeline',
      departmentSlug: 'development',
      assigneeId: devEmployee,
      statusKey: 'in_progress',
      priorityKey: 'high',
    },
    {
      title: 'Fix login redirect bug',
      departmentSlug: 'development',
      assigneeId: devEmployee,
      statusKey: 'todo',
      priorityKey: 'urgent',
    },
    {
      title: 'Prepare Q3 sales deck',
      departmentSlug: 'sales',
      assigneeId: salesEmployee,
      statusKey: 'in_review',
      priorityKey: 'medium',
    },
    {
      title: 'Close out onboarding checklist',
      departmentSlug: 'sales',
      assigneeId: salesEmployee,
      statusKey: 'done',
      priorityKey: 'low',
    },
  ] as const;

  for (const t of sampleTasks) {
    const existing = await prisma.task.findFirst({ where: { title: t.title } });
    if (existing) continue;
    await prisma.task.create({
      data: {
        title: t.title,
        departmentId: departments.get(t.departmentSlug)!,
        workflowId: workflow.id,
        statusId: statusIds.get(t.statusKey)!,
        priorityId: priorityIds.get(t.priorityKey)!,
        assigneeId: t.assigneeId,
        createdById: admin,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        completedAt: t.statusKey === 'done' ? new Date() : null,
      },
    });
  }

  console.log('Seeding starter report templates...');
  const starterTemplates = [
    {
      name: 'Department Overview',
      config: {
        metrics: ['task_counts_by_status', 'task_counts_by_priority'],
        dimensions: [],
        date_range: { preset: 'last_30_days' },
        chart_type: 'bar',
        filters: {},
      },
    },
    {
      name: 'Overdue Tasks',
      config: {
        metrics: ['overdue_count', 'overdue_rate'],
        dimensions: [],
        date_range: { preset: 'last_30_days' },
        chart_type: 'table',
        filters: {},
      },
    },
    {
      name: 'Team Workload',
      config: {
        metrics: ['workload_distribution'],
        dimensions: [],
        date_range: { preset: 'last_30_days' },
        chart_type: 'bar',
        filters: {},
      },
    },
    {
      name: 'SLA Compliance',
      config: {
        metrics: ['sla_compliance_rate'],
        dimensions: [],
        date_range: { preset: 'last_30_days' },
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
        createdById: admin,
        config: t.config,
        visibility: 'shared_org',
        isTemplate: true,
      },
    });
  }

  console.log('Seed complete.');
  console.log('Dev sign-in: POST /api/v1/auth/dev with { "token": "admin@econz.net" } (or any seeded email).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
