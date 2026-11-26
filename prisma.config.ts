import { defineConfig, env } from 'prisma/config';

try {
  process.loadEnvFile('.env');
} catch {
  // .env is optional; env vars may come from the environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.mjs',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
