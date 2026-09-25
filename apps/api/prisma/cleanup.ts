import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:TaskAppSecureDb2026!@104.154.250.83:5432/taskmanagement?sslmode=disable';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

const ADMIN_EMAIL = 'sujeeth.k@econz.net';

async function main() {
  console.log('🔍 Connecting to database at:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

  // Ensure admin user exists
  let admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    console.log(`⚠️ Admin user ${ADMIN_EMAIL} not found, searching for first admin role...`);
    const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
    const defaultDept = await prisma.department.findFirst();
    if (!defaultDept || !adminRole) {
      console.error('❌ Missing default department or Admin role in DB!');
      process.exit(1);
    }
    admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        fullName: 'Sujeeth K (Admin)',
        primaryDepartmentId: defaultDept.id,
        workCountry: 'IN',
        workState: 'KA',
        authProvider: 'google',
        isActive: true,
      },
    });
    await prisma.userRole.create({
      data: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    });
    console.log(`✅ Created admin user: ${admin.email}`);
  } else {
    console.log(`✅ Admin found: ${admin.id} (${admin.fullName})`);
  }

  // Find all non-admin users
  const nonAdminUsers = await prisma.user.findMany({
    where: { id: { not: admin.id } },
    select: { id: true, email: true, fullName: true },
  });
  console.log(`\n📋 Found ${nonAdminUsers.length} non-admin users to remove:`);
  nonAdminUsers.forEach((u) => console.log(`  - ${u.email} (${u.fullName ?? 'no name'})`));
  const nonAdminIds = nonAdminUsers.map((u) => u.id);

  console.log('\n🧹 Starting full database cleanup of all tasks and non-admin users...');

  // 1. Delete all task-related child entities (for ALL tasks)
  const timeLogsDel = await prisma.timeLog.deleteMany({});
  console.log(`  ✓ Deleted ${timeLogsDel.count} time logs`);

  const commentsDel = await prisma.taskComment.deleteMany({});
  console.log(`  ✓ Deleted ${commentsDel.count} task comments`);

  const attachmentsDel = await prisma.taskAttachment.deleteMany({});
  console.log(`  ✓ Deleted ${attachmentsDel.count} attachments`);

  const dependenciesDel = await prisma.taskDependency.deleteMany({});
  console.log(`  ✓ Deleted ${dependenciesDel.count} dependencies`);

  const approvalStepsDel = await prisma.approvalStep.deleteMany({});
  console.log(`  ✓ Deleted ${approvalStepsDel.count} approval steps`);

  const activityDel = await prisma.activityLogEntry.deleteMany({});
  console.log(`  ✓ Deleted ${activityDel.count} activity log entries`);

  const customFieldValsDel = await prisma.taskCustomFieldValue.deleteMany({});
  console.log(`  ✓ Deleted ${customFieldValsDel.count} custom field values`);

  // 2. Delete all subtasks first, then parent tasks
  const subtasksDel = await prisma.task.deleteMany({ where: { parentTaskId: { not: null } } });
  console.log(`  ✓ Deleted ${subtasksDel.count} subtasks`);

  const tasksDel = await prisma.task.deleteMany({});
  console.log(`  ✓ Deleted ${tasksDel.count} tasks`);

  // 3. Delete non-admin user data
  if (nonAdminIds.length > 0) {
    const notifDel = await prisma.notification.deleteMany({ where: { userId: { in: nonAdminIds } } });
    console.log(`  ✓ Deleted ${notifDel.count} notifications`);

    const prefDel = await prisma.notificationPreference.deleteMany({ where: { userId: { in: nonAdminIds } } });
    console.log(`  ✓ Deleted ${prefDel.count} notification preferences`);

    const roleDel = await prisma.userRole.deleteMany({ where: { userId: { in: nonAdminIds } } });
    console.log(`  ✓ Deleted ${roleDel.count} role assignments`);

    const deptMemberDel = await prisma.userDepartment.deleteMany({ where: { userId: { in: nonAdminIds } } });
    console.log(`  ✓ Deleted ${deptMemberDel.count} department memberships`);

    const reportScheduleDel = await prisma.reportSchedule.deleteMany({
      where: { savedReport: { createdById: { in: nonAdminIds } } },
    });
    console.log(`  ✓ Deleted ${reportScheduleDel.count} report schedules`);

    const reportDel = await prisma.savedReport.deleteMany({
      where: { createdById: { in: nonAdminIds } },
    });
    console.log(`  ✓ Deleted ${reportDel.count} saved reports`);

    const userDel = await prisma.user.deleteMany({
      where: { id: { in: nonAdminIds } },
    });
    console.log(`  ✓ Deleted ${userDel.count} non-admin user accounts`);
  }

  // Ensure Admin user has Admin role
  const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
  if (adminRole) {
    const existingAdminRole = await prisma.userRole.findFirst({
      where: { userId: admin.id, roleId: adminRole.id },
    });
    if (!existingAdminRole) {
      await prisma.userRole.create({
        data: { userId: admin.id, roleId: adminRole.id },
      });
      console.log(`  ✓ Assigned Admin role to ${admin.email}`);
    }
  }

  console.log('\n✅ Database reset complete!');
  console.log(`   Admin remaining: ${admin.email} (${admin.fullName ?? 'Admin'})`);

  const finalUserCount = await prisma.user.count();
  const finalTaskCount = await prisma.task.count();
  console.log(`\n📊 Final database summary:`);
  console.log(`   Active Users: ${finalUserCount}`);
  console.log(`   Total Tasks: ${finalTaskCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
