import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { prisma } from '../prisma.js';

const email = `flame.${randomUUID()}@example.com`;
const password = 'FlameTest#2026';
let learner: ReturnType<typeof request.agent>;
let csrf: string;

function withCsrf(test: request.Test, token = csrf) {
  return test.set('x-csrf-token', token);
}

type PracticeSession = {
  id: string;
  questions: Array<{ id: string; options: Array<{ id: string }> }>;
};

async function startSession(count: number): Promise<PracticeSession> {
  const started = await withCsrf(
    learner.post('/api/practice/sessions').send({ count }),
  ).expect(201);
  return started.body.data;
}

async function correctOptionIdOf(questionId: string): Promise<string> {
  const question = await prisma.question.findUniqueOrThrow({
    where: { id: questionId },
    select: { correctOptionId: true },
  });
  if (!question.correctOptionId) throw new Error('Seeded question has no verified correct option');
  return question.correctOptionId;
}

function answer(session: PracticeSession, questionId: string, optionId: string, key: string) {
  return withCsrf(
    learner
      .post(`/api/practice/sessions/${session.id}/questions/${questionId}/answer`)
      .send({ optionId, idempotencyKey: key }),
  );
}

async function answerCorrectly(session: PracticeSession, questionId: string, key: string) {
  return answer(session, questionId, await correctOptionIdOf(questionId), key);
}

async function dashboardStreak() {
  const response = await learner.get('/api/dashboard').expect(200);
  return response.body.data.streak as {
    todayCorrectCount: number;
    flameActivationCount: number;
    todayActivityCount: number;
    todayQualified: boolean;
    current: number;
  };
}

describe('Daily streak flame activation data', () => {
  beforeAll(async () => {
    learner = request.agent(app);
    const bootstrap = await learner.get('/api/auth/csrf').expect(200);
    csrf = bootstrap.body.data.csrfToken;
    await withCsrf(
      learner
        .post('/api/auth/signup')
        .send({ displayName: 'Flame Learner', email, password }),
    ).expect(201);
  });

  it('starts with an unlit flame: zero correct answers and a threshold of four', async () => {
    const streak = await dashboardStreak();
    expect(streak.todayCorrectCount).toBe(0);
    expect(streak.flameActivationCount).toBe(4);
  });

  it('lights the flame only after four verified correct practice answers and never counts wrong ones', async () => {
    const session = await startSession(6);
    const [q1, q2, q3, q4, q5] = session.questions;

    // three correct answers: the flame must stay below the threshold
    for (const [index, question] of [q1, q2, q3].entries()) {
      const answer = await answerCorrectly(session, question.id, `flame_ok_${index}_${randomUUID()}`);
      expect(answer.body.data.isCorrect).toBe(true);
    }
    let streak = await dashboardStreak();
    expect(streak.todayCorrectCount).toBe(3);

    // one incorrect answer must not move the counter
    const correctQ4 = await correctOptionIdOf(q4.id);
    const wrongOption = q4.options.find((option: { id: string }) => option.id !== correctQ4);
    if (!wrongOption) throw new Error('Question has no wrong option to submit');
    const wrong = await answer(session, q4.id, wrongOption.id, `flame_bad_${randomUUID()}`).expect(201);
    expect(wrong.body.data.isCorrect).toBe(false);
    streak = await dashboardStreak();
    expect(streak.todayCorrectCount).toBe(3);

    // the fourth correct answer reaches the activation threshold
    await answerCorrectly(session, q5.id, `flame_ok_4_${randomUUID()}`);
    streak = await dashboardStreak();
    expect(streak.todayCorrectCount).toBe(4);
    expect(streak.flameActivationCount).toBe(4);
    // the streak-day rule is unchanged: one activity already qualifies the day
    expect(streak.todayActivityCount).toBe(5);
    expect(streak.todayQualified).toBe(true);
    expect(streak.current).toBeGreaterThanOrEqual(1);
  });

  it('rejects duplicate submissions without inflating the counter', async () => {
    const before = await dashboardStreak();
    const session = await startSession(1);
    const [question] = session.questions;
    const key = `flame_dup_${randomUUID()}`;

    const first = await answerCorrectly(session, question.id, key);
    expect(first.status).toBe(201);
    expect(first.body.data.isCorrect).toBe(true);

    // replaying the same idempotency key returns the stored verdict
    const replay = await answerCorrectly(session, question.id, key);
    expect(replay.body.data.isCorrect).toBe(true);
    expect(replay.body.data.idempotent).toBe(true);

    // a different key on an already-answered session question is rejected
    await answer(
      session,
      question.id,
      await correctOptionIdOf(question.id),
      `flame_dup_${randomUUID()}`,
    ).expect(409);

    const me = await learner.get('/api/auth/me').expect(200);
    const attempts = await prisma.questionAttempt.count({
      where: { userId: me.body.data.user.id, questionId: question.id },
    });
    expect(attempts).toBe(1);

    const streak = await dashboardStreak();
    // exactly one new correct question was added by this block
    expect(streak.todayCorrectCount).toBe(before.todayCorrectCount + 1);
  });
});
