import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:TaskAppSecureDb2026!@104.154.250.83:5432/taskmanagement?sslmode=disable';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🔍 Inspecting all users and their permissions...');
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    console.log(`\nUser: ${u.email} (${u.fullName}) - ID: ${u.id}`);
    console.log(`  Roles: ${u.roles.map(r => r.role.name).join(', ') || 'NONE'}`);
    for (const ur of u.roles) {
      console.log(`  Role ${ur.role.name} has ${ur.role.permissions.length} permissions:`);
      const keys = ur.role.permissions.map(p => p.permission.key);
      console.log(`    has task.create? ${keys.includes('task.create')}`);
      console.log(`    has task.view? ${keys.includes('task.view')}`);
      console.log(`    has task.assign? ${keys.includes('task.assign')}`);
      console.log(`    all keys: ${keys.join(', ')}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Inspection error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
