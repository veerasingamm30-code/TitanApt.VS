// QA probe: approved checkpoint-eligible question pool per topic.
// Usage: node scripts/with-db.mjs node scripts/qa/pool-check.cjs
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.topic
  .findMany({
    select: {
      slug: true,
      _count: { select: { questions: { where: { reviewStatus: 'APPROVED', correctOptionId: { not: null } } } } },
    },
    orderBy: { slug: 'asc' },
  })
  .then((ts) => {
    for (const t of ts) console.log(t.slug.padEnd(28), String(t._count.questions).padStart(3));
    return p.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
