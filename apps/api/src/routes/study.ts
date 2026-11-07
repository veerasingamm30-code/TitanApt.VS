// Crack Time — genuine study-time tracking with a long-lived, pause-aware timer.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler, parseBody } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { dayKey, shiftDayKey } from '../lib/metrics.js';
import { studyIdleCapSeconds } from '@titanapt/shared';

export const studyRouter = Router();
studyRouter.use(requireAuth);

const ACTIVE = 'ACTIVE';
const PAUSED = 'PAUSED';
const ENDED = 'ENDED';

function tz(req: { user?: { profile?: { timezone?: string } | null } | undefined }): string {
  return req.user?.profile?.timezone || 'Asia/Kolkata';
}

type SessionRequest = Parameters<typeof requireAuth>[0];

function serializeSession(row: {
  id: string;
  dayKey: string;
  status: string;
  startedAt: Date;
  lastActiveAt: Date;
  accumulatedSeconds: number;
  endedAt: Date | null;
}) {
  return {
    id: row.id,
    dayKey: row.dayKey,
    status: row.status as 'ACTIVE' | 'PAUSED' | 'ENDED',
    startedAt: row.startedAt.toISOString(),
    lastActiveAt: row.lastActiveAt.toISOString(),
    accumulatedSeconds: row.accumulatedSeconds,
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}

/** Clamp an ACTIVE session that stopped sending heartbeats: credit only the
 *  seconds up to the last active checkpoint plus the idle cap. */
async function reconcileActiveSession(userId: string): Promise<void> {
  const active = await prisma.studySession.findFirst({
    where: { userId, status: ACTIVE },
    orderBy: { startedAt: 'desc' },
  });
  if (!active) return;
  const idleSeconds = Math.floor((Date.now() - active.lastActiveAt.getTime()) / 1000);
  if (idleSeconds <= studyIdleCapSeconds) return;
  // treat the remainder as idle: pause accumulation and pause the session
  const credited = Math.min(idleSeconds, studyIdleCapSeconds);
  await prisma.$transaction([
    prisma.studySession.update({
      where: { id: active.id },
      data: {
        accumulatedSeconds: { increment: credited },
        status: PAUSED,
        lastActiveAt: new Date(),
      },
    }),
    prisma.studyDay.upsert({
      where: { userId_dayKey: { userId, dayKey: active.dayKey } },
      create: { userId, dayKey: active.dayKey, secondsTotal: credited },
      update: { secondsTotal: { increment: credited } },
    }),
  ]);
}

async function currentToday(req: SessionRequest) {
  const tzName = tz(req);
  const todayKey = dayKey(new Date(), tzName);
  await reconcileActiveSession(req.user!.id);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { profile: true } });
  const targetMinutes = user.profile?.studyTargetMinutes ?? 25;
  const sessions = await prisma.studySession.findMany({
    where: { userId: req.user!.id, dayKey: todayKey },
    orderBy: { startedAt: 'asc' },
  });
  const secondsToday = sessions.reduce((sum, s) => sum + s.accumulatedSeconds, 0);
  return {
    dayKey: todayKey,
    targetMinutes,
    secondsToday,
    inProgress: sessions.find((s) => s.status === ACTIVE || s.status === PAUSED) ?? null,
    sessions: sessions.map(serializeSession),
  };
}

studyRouter.get(
  '/today',
  asyncHandler(async (req, res) => {
    res.json({ data: await currentToday(req) });
  }),
);

studyRouter.patch(
  '/target',
  asyncHandler(async (req, res) => {
    const schema = z.object({ minutes: z.coerce.number().int().min(5).max(480) });
    const input = parseBody(schema, req);
    await prisma.userProfile.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, displayName: req.user!.profile?.displayName ?? 'Learner', studyTargetMinutes: input.minutes },
      update: { studyTargetMinutes: input.minutes },
    });
    res.json({ data: await currentToday(req) });
  }),
);

studyRouter.post(
  '/start',
  asyncHandler(async (req, res) => {
    await reconcileActiveSession(req.user!.id);
    const tzName = tz(req);
    const todayKey = dayKey(new Date(), tzName);
    const existing = await prisma.studySession.findFirst({
      where: { userId: req.user!.id, status: ACTIVE },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) {
      // prevent double timers
      return res.json({ data: { ...(await currentToday(req)), resumed: true } });
    }
    await prisma.studySession.create({
      data: { userId: req.user!.id, dayKey: todayKey, status: ACTIVE, startedAt: new Date(), lastActiveAt: new Date() },
    });
    res.status(201).json({ data: { ...(await currentToday(req)), resumed: false } });
  }),
);

studyRouter.post(
  '/pause',
  asyncHandler(async (req, res) => {
    const active = await prisma.studySession.findFirst({
      where: { userId: req.user!.id, status: ACTIVE },
      orderBy: { startedAt: 'desc' },
    });
    if (!active) {
      res.json({ data: { ...(await currentToday(req)), noop: true } });
      return;
    }
    const seconds = Math.max(0, Math.floor((Date.now() - active.lastActiveAt.getTime()) / 1000));
    const credited = Math.min(seconds, studyIdleCapSeconds * 60);
    await prisma.$transaction([
      prisma.studySession.update({
        where: { id: active.id },
        data: {
          status: PAUSED,
          accumulatedSeconds: { increment: credited },
          lastActiveAt: new Date(),
        },
      }),
      prisma.studyDay.upsert({
        where: { userId_dayKey: { userId: req.user!.id, dayKey: active.dayKey } },
        create: { userId: req.user!.id, dayKey: active.dayKey, secondsTotal: credited },
        update: { secondsTotal: { increment: credited } },
      }),
    ]);
    res.json({ data: await currentToday(req) });
  }),
);

studyRouter.post(
  '/resume',
  asyncHandler(async (req, res) => {
    const paused = await prisma.studySession.findFirst({
      where: { userId: req.user!.id, status: PAUSED },
      orderBy: { startedAt: 'desc' },
    });
    if (!paused) {
      return res.json({ data: await currentToday(req) });
    }
    // seam: if the paused session belongs to a previous day, close it and open a fresh one
    const todayKey = dayKey(new Date(), tz(req));
    if (paused.dayKey !== todayKey) {
      await prisma.studySession.update({
        where: { id: paused.id },
        data: { status: ENDED, endedAt: new Date(), lastActiveAt: new Date() },
      });
      await prisma.studySession.create({
        data: { userId: req.user!.id, dayKey: todayKey, status: ACTIVE, startedAt: new Date(), lastActiveAt: new Date() },
      });
    } else {
      await prisma.studySession.update({
        where: { id: paused.id },
        data: { status: ACTIVE, lastActiveAt: new Date() },
      });
    }
    res.json({ data: await currentToday(req) });
  }),
);

studyRouter.post(
  '/stop',
  asyncHandler(async (req, res) => {
    const open = await prisma.studySession.findFirst({
      where: { userId: req.user!.id, status: { in: [ACTIVE, PAUSED] } },
      orderBy: { startedAt: 'desc' },
    });
    if (!open) {
      return res.json({ data: await currentToday(req) });
    }
    const credited =
      open.status === ACTIVE
        ? Math.min(Math.max(0, Math.floor((Date.now() - open.lastActiveAt.getTime()) / 1000)), studyIdleCapSeconds)
        : 0;
    await prisma.$transaction([
      prisma.studySession.update({
        where: { id: open.id },
        data: {
          status: ENDED,
          endedAt: new Date(),
          lastActiveAt: new Date(),
          ...(credited > 0 ? { accumulatedSeconds: { increment: credited } } : {}),
        },
      }),
      ...(credited > 0
        ? [
            prisma.studyDay.upsert({
              where: { userId_dayKey: { userId: req.user!.id, dayKey: open.dayKey } },
              create: { userId: req.user!.id, dayKey: open.dayKey, secondsTotal: credited },
              update: { secondsTotal: { increment: credited } },
            }),
          ]
        : []),
    ]);
    res.json({ data: await currentToday(req) });
  }),
);

/** Heartbeat: server-authoritative checkpoint every ~30s from the client.
 *  Credits ACTIVE time since the previous checkpoint (capped). */
studyRouter.post(
  '/heartbeat',
  asyncHandler(async (req, res) => {
    const active = await prisma.studySession.findFirst({
      where: { userId: req.user!.id, status: ACTIVE },
      orderBy: { startedAt: 'desc' },
    });
    if (active) {
      const seconds = Math.max(0, Math.floor((Date.now() - active.lastActiveAt.getTime()) / 1000));
      if (seconds > 0) {
        const credited = Math.min(seconds, studyIdleCapSeconds * 6);
        await prisma.$transaction([
          prisma.studySession.update({
            where: { id: active.id },
            data: { accumulatedSeconds: { increment: credited }, lastActiveAt: new Date() },
          }),
          prisma.studyDay.upsert({
            where: { userId_dayKey: { userId: req.user!.id, dayKey: active.dayKey } },
            create: { userId: req.user!.id, dayKey: active.dayKey, secondsTotal: credited },
            update: { secondsTotal: { increment: credited } },
          }),
        ]);
      }
    }
    res.json({ data: await currentToday(req) });
  }),
);

studyRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const tzName = tz(req);
    const daysBack = Math.min(Math.max(Number(req.query.days ?? 120), 14), 366);
    const todayKey = dayKey(new Date(), tzName);
    const fromKey = shiftDayKey(todayKey, -(daysBack - 1));
    await reconcileActiveSession(req.user!.id);
    const days = await prisma.studyDay.findMany({
      where: { userId: req.user!.id, dayKey: { gte: fromKey, lte: todayKey } },
      orderBy: { dayKey: 'asc' },
    });
    const sessionCounts = await prisma.studySession.groupBy({
      by: ['dayKey'],
      where: { userId: req.user!.id, dayKey: { gte: fromKey, lte: todayKey } },
      _count: { _all: true },
    });
    const countsByDay = new Map(sessionCounts.map((row) => [row.dayKey, row._count._all]));
    const secondsByMonth = new Map<string, number>();
    const secondsByWeek = new Map<string, number>();
    const weekly = new Map<string, { weekStart: string; targetMinutes: number }>();
    for (const row of days) {
      const monthKey = row.dayKey.slice(0, 7);
      secondsByMonth.set(monthKey, (secondsByMonth.get(monthKey) ?? 0) + row.secondsTotal);
      const [y, m, d] = row.dayKey.split('-').map(Number);
      const weekStart = isoWeekStart(new Date(Date.UTC(y, m - 1, d)));
      const weekKey = `${weekStart}`;
      secondsByWeek.set(weekKey, (secondsByWeek.get(weekKey) ?? 0) + row.secondsTotal);
      const existing = weekly.get(weekKey);
      weekly.set(weekKey, { weekStart, targetMinutes: Math.max(existing?.targetMinutes ?? row.targetMinutes, row.targetMinutes) });
    }
    const totalTimeMinutes = Math.round(days.reduce((a, b) => a + b.secondsTotal, 0) / 60);
    res.json({
      data: {
        days: days.map((row) => ({ dayKey: row.dayKey, targetMinutes: row.targetMinutes, secondsTotal: row.secondsTotal, sessions: countsByDay.get(row.dayKey) ?? 0 })),
        weekly: [...secondsByWeek.entries()].map(([weekKey, secondsTotal]) => ({ weekKey, weekStart: weekly.get(weekKey)?.weekStart ?? weekKey, secondsTotal, targetMinutes: weekly.get(weekKey)?.targetMinutes ?? 25 })),
        monthly: [...secondsByMonth.entries()].map(([monthKey, secondsTotal]) => ({ monthKey, secondsTotal })),
        totalTimeMinutes,
      },
    });
  }),
);

function isoWeekStart(date: Date): string {
  // Monday-based week start (UTC-safe: date is constructed with UTC parts)
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - diff);
  return start.toISOString().slice(0, 10);
}
