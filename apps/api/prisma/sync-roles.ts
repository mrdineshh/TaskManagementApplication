import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:TaskAppSecureDb2026!@104.154.250.83:5432/taskmanagement?sslmode=disable';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

const ROLE_PERMISSIONS = {
  Employee: [
    'task.create',
    'task.view',
    'task.edit',
    'task.assign',
    'task.comment',
    'department.view',
    'user.view',
    'custom_field.view',
    'workflow.view',
    'priority.view',
    'on_hold_reason.view',
    'holiday_calendar.view',
  ],
  Manager: [
    'task.create',
    'task.view',
    'task.edit',
    'task.delete',
    'task.assign',
    'task.comment',
    'task.moderate',
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
  Head: [
    'task.create',
    'task.view',
    'task.edit',
    'task.delete',
    'task.assign',
    'task.comment',
    'task.moderate',
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
};

async function main() {
  console.log('🔄 Syncing role permissions in production DB...');

  for (const [name, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findFirst({ where: { name } });
    if (!role) {
      console.log(`Role ${name} not found`);
      continue;
    }
    const perms = await prisma.permission.findMany({
      where: { key: { in: keys } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    console.log(`✅ Synced ${perms.length} permissions for ${name} role (including task.create)`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error syncing roles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
