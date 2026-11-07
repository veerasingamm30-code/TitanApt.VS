import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';

// Workspace scripts run with cwd set to apps/api, so plain `dotenv/config`
// misses the root .env. Locate the repo root (contains prisma/schema.prisma)
// and load its .env explicitly; keep the normal fallback for other signatures.
function repoRoot(directory: string): string | null {
  let current = directory;
  for (let depth = 0; depth < 8; depth += 1) {
    if (fs.existsSync(path.join(current, 'prisma', 'schema.prisma'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const root = repoRoot(process.cwd());
if (root) dotenv.config({ path: path.join(root, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
  ADMIN_DISPLAY_NAME: z.string().default('TitanApt Admin'),
  AUTO_SEED_ADMIN: z.string().optional(),
  WEB_DIST_DIR: z.string().optional(),
  UPLOAD_DIR: z.string().optional(),
  NO_REPEAT_DAYS: z.coerce.number().int().min(0).max(365).default(14),
  WEAK_AREA_MIN_ATTEMPTS: z.coerce.number().int().min(3).max(100).default(10),
  WEAK_AREA_THRESHOLD: z.coerce.number().min(1).max(100).default(60),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`- ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const trustedOrigins = env.WEB_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
