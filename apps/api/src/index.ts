import { app } from './app.js';
import { env } from './env.js';
import { prisma } from './prisma.js';
import { warmLearningVolumes } from './routes/learning.js';

const server = app.listen(env.PORT, () => {
  console.log(`TitanApt API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  // Index the Learning Hub PDFs in the background so the first learner never
  // waits on a cold volume index (previously ~20s on first request after boot).
  warmLearningVolumes();
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down.`);
  const force = setTimeout(() => {
    console.error('Shutdown timed out.');
    process.exit(1);
  }, 10_000);
  force.unref();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
