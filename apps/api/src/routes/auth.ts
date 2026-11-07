import express, { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loginSchema, signupSchema } from '@titanapt/shared';
import { prisma } from '../prisma.js';
import { normalizeEmail } from '../lib/email.js';
import { hashPassword, verifyDummyPassword, verifyPassword } from '../lib/password.js';
import { asyncHandler, badRequest, conflict, unauthorized } from '../lib/errors.js';
import { parseBody } from '../lib/errors.js';
import { serializeUser } from '../lib/serialize.js';
import { createSession, destroySession, hashToken, SESSION_COOKIE } from '../lib/session.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, loginLimiter, signupLimiter } from '../middleware/rateLimits.js';
import { env } from '../env.js';

export const authRouter = Router();

// ---------- avatar helpers ----------
const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function uploadsRoot(): string {
  const configured = env.UPLOAD_DIR;
  const root = path.resolve(configured ?? path.join(process.cwd(), '.uploads'));
  return root;
}

function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  return null;
}

authRouter.post(
  '/avatar',
  requireAuth,
  express.raw({ type: '*/*', limit: AVATAR_MAX_BYTES }),
  asyncHandler(async (req, res) => {
    const declared = String(req.headers['x-avatar-type'] ?? '');
    const bytes = req.body as Buffer | undefined;
    if (!bytes || !Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw badRequest('EMPTY_FILE', 'Select an image file to upload.');
    }
    const mime = detectImageMime(new Uint8Array(bytes));
    if (!mime) throw badRequest('INVALID_IMAGE', 'Only PNG, JPEG, WEBP or GIF images are supported.');
    if (declared && AVATAR_TYPES.has(declared) && declared !== mime) {
      throw badRequest('INVALID_IMAGE', 'The selected file does not match its declared type.');
    }
    const profile = await prisma.userProfile.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, displayName: req.user!.profile?.displayName ?? 'Learner' },
      update: {},
    });
    const root = uploadsRoot();
    const dir = path.join(root, 'avatars', req.user!.id);
    fs.mkdirSync(dir, { recursive: true });
    // remove previous avatar file(s)
    const ext = AVATAR_EXTENSIONS[mime];
    const filename = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
    const filePath = path.join(dir, filename);
    const relativePath = path.relative(root, filePath);
    fs.writeFileSync(filePath, bytes);
    const previous = profile.avatarPath ? path.join(root, profile.avatarPath) : null;
    if (previous && fs.existsSync(previous)) fs.rmSync(previous, { force: true });
    const updated = await prisma.userProfile.update({
      where: { userId: req.user!.id },
      data: { avatarPath: relativePath },
    });
    const fresh = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      include: { profile: true },
    });
    void updated;
    res.status(201).json({ data: { user: serializeUser(fresh) } });
  }),
);

authRouter.get(
  '/avatar',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.user!.id } });
    if (!profile?.avatarPath) throw unauthorized('No profile picture uploaded yet.');
    const root = uploadsRoot();
    const filePath = path.join(root, profile.avatarPath);
    if (!filePath.startsWith(root + path.sep) || !fs.existsSync(filePath)) {
      throw badRequest('AVATAR_MISSING', 'Profile picture is unavailable.');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/gif';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, must-revalidate');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.sendFile(filePath);
  }),
);

authRouter.delete(
  '/avatar',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.user!.id } });
    if (profile?.avatarPath) {
      const filePath = path.join(uploadsRoot(), profile.avatarPath);
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
      await prisma.userProfile.update({ where: { userId: req.user!.id }, data: { avatarPath: null } });
    }
    res.json({ data: { ok: true } });
  }),
);

authRouter.get('/csrf', (req, res) => {
  const token = issueCsrfToken(req, res);
  res.json({ data: { csrfToken: token } });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: { user: serializeUser(req.user!) } });
  }),
);

authRouter.post(
  '/signup',
  signupLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(signupSchema, req);
    const emailNormalized = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);

    let user: Prisma.UserGetPayload<{ include: { profile: true } }>;
    try {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            emailOriginal: input.email.trim(),
            emailNormalized,
            passwordHash,
            role: 'LEARNER',
            profile: {
              create: {
                displayName: input.displayName.trim(),
                timezone: 'Asia/Kolkata',
                dailyGoal: 10,
              },
            },
          },
          include: { profile: true },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('EMAIL_TAKEN', 'An account with this email already exists. Try signing in instead.');
      }
      throw error;
    }

    const oldToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (oldToken) {
      await prisma.session.deleteMany({ where: { tokenHash: hashToken(oldToken) } });
    }
    await createSession(user.id, res);
    issueCsrfToken(req, res);
    res.status(201).json({ data: { user: serializeUser(user) } });
  }),
);

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(loginSchema, req);
    const emailNormalized = normalizeEmail(input.email);
    const user = await prisma.user.findUnique({
      where: { emailNormalized },
      include: { profile: true },
    });

    if (!user) {
      await verifyDummyPassword(input.password);
      throw unauthorized('Email or password is incorrect.');
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw unauthorized('Email or password is incorrect.');
    }

    const oldToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (oldToken) {
      await prisma.session.deleteMany({ where: { tokenHash: hashToken(oldToken) } });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user.id, res);
    issueCsrfToken(req, res);
    res.json({ data: { user: serializeUser(user) } });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    await destroySession(req, res, req.user!.id);
    res.json({ data: { ok: true } });
  }),
);

authRouter.patch(
  '/profile',
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      displayName: z.string().trim().min(2).max(60).optional(),
      timezone: z.string().trim().min(1).max(80).optional(),
      dailyGoal: z.coerce.number().int().min(5).max(100).optional(),
      theme: z.enum(['dark', 'light']).optional(),
      accent: z.enum(['orange', 'green', 'purple', 'blue']).optional(),
      studyTargetMinutes: z.coerce.number().int().min(5).max(480).optional(),
    });
    const input = parseBody(schema, req);
    if (input.timezone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(new Date());
      } catch {
        throw badRequest('INVALID_TIMEZONE', 'Choose a valid timezone.');
      }
    }
    await prisma.userProfile.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        displayName: input.displayName ?? req.user!.profile?.displayName ?? 'Learner',
        timezone: input.timezone ?? 'Asia/Kolkata',
        dailyGoal: input.dailyGoal ?? 10,
        theme: input.theme ?? 'dark',
        accent: input.accent ?? 'orange',
        studyTargetMinutes: input.studyTargetMinutes ?? 25,
      },
      update: {
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.dailyGoal ? { dailyGoal: input.dailyGoal } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.accent ? { accent: input.accent } : {}),
        ...(input.studyTargetMinutes ? { studyTargetMinutes: input.studyTargetMinutes } : {}),
      },
    });
    const fresh = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      include: { profile: true },
    });
    res.json({ data: { user: serializeUser(fresh) } });
  }),
);

