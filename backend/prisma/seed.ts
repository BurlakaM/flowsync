import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// The adapter is how Prisma 7 reaches the database; the URL is the same one the migrations use.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Development only: well-known demo accounts. Never used in production (see main()).
const DEMO_PASSWORD = 'password-123';

function upsertUser(email: string, name: string, role: Role) {
  return bcrypt.hash(DEMO_PASSWORD, 10).then((password) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role, password, emailVerifiedAt: new Date() },
    }),
  );
}

function upsertTag(projectId: number, name: string) {
  return prisma.tag.upsert({
    where: { projectId_name: { projectId, name } },
    update: {},
    create: { projectId, name },
  });
}

/** Idempotent: running it again changes nothing. */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed skipped: demo data is for development only');
    return;
  }

  const admin = await upsertUser('admin@flowsync.test', 'Admin', Role.ADMIN);
  const user = await upsertUser('user@flowsync.test', 'Demo User', Role.USER);

  const project =
    (await prisma.project.findFirst({
      where: { ownerId: user.id, name: 'Demo project' },
    })) ??
    (await prisma.project.create({
      data: {
        name: 'Demo project',
        description: 'Created by the seed script',
        ownerId: user.id,
        members: { create: { userId: admin.id } },
      },
    }));

  const bug = await upsertTag(project.id, 'bug');
  const feature = await upsertTag(project.id, 'feature');

  if ((await prisma.task.count({ where: { projectId: project.id } })) === 0) {
    await prisma.task.create({
      data: {
        name: 'Plan the first sprint',
        status: TaskStatus.DONE,
        projectId: project.id,
        createdById: user.id,
        assignees: { create: { userId: user.id } },
        tags: { connect: [{ id: feature.id }] },
      },
    });
    const login = await prisma.task.create({
      data: {
        name: 'Fix the login redirect',
        description: 'After logging in the user lands on the home page.',
        status: TaskStatus.IN_PROGRESS,
        projectId: project.id,
        createdById: user.id,
        assignees: { create: { userId: admin.id } },
        tags: { connect: [{ id: bug.id }] },
      },
    });
    await prisma.task.create({
      data: {
        name: 'Write the user guide',
        projectId: project.id,
        createdById: user.id,
      },
    });
    await prisma.comment.create({
      data: {
        text: 'I can reproduce it on Safari.',
        taskId: login.id,
        authorId: admin.id,
      },
    });
  }

  console.log(
    `Seed done: ${admin.email} and ${user.email} (password: ${DEMO_PASSWORD}), project "${project.name}"`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
