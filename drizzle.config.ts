import type { Config } from 'drizzle-kit';

export default {
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria',
  },
  verbose: true,
  strict: true,
} satisfies Config;
