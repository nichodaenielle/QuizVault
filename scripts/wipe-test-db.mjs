// Wipes all app data, keeping only the given admin email.
// Usage: node scripts/wipe-test-db.mjs <keep-email>
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const keepEmail = (process.argv[2] ?? '').toLowerCase();
if (!keepEmail) { console.error('Usage: node scripts/wipe-test-db.mjs <keep-email>'); process.exit(1); }

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const keep = await prisma.user.findUnique({ where: { email: keepEmail }, select: { id: true, email: true, role: true } });
if (!keep) { console.error(`No user found with email ${keepEmail}`); await prisma.$disconnect(); process.exit(1); }
console.log(`Keeping: ${keep.email} (${keep.role})`);

const tables = await prisma.$queryRawUnsafe(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('User', '_prisma_migrations')`
);
const names = tables.map((t) => `"${t.tablename}"`);
if (names.length) {
  await prisma.$executeRawUnsafe(`TRUNCATE ${names.join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`Truncated ${names.length} tables.`);
}

const del = await prisma.user.deleteMany({ where: { email: { not: keepEmail } } });
console.log(`Deleted ${del.count} other user(s).`);

await prisma.user.update({ where: { id: keep.id }, data: { role: 'ADMIN' } });
console.log('Done. Remaining users:', await prisma.user.count());
await prisma.$disconnect();
