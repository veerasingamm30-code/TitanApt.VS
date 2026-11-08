-- Allow multiple lessons (at the same difficulty level) inside one topic:
-- the legacy TopicId+Level unique index assumed a one-lesson-per-topic
-- curriculum and blocked the Boolean Algebra / Programming Logic lesson
-- sets. Replaced by a topic+order index that supports the lesson list
-- ordering used by the learner UI. Non-destructive: no rows are lost.

DROP INDEX "Lesson_topicId_level_key";

-- Prisma generated index names.
CREATE INDEX "Lesson_topicId_order_idx" ON "Lesson"("topicId", "order");
