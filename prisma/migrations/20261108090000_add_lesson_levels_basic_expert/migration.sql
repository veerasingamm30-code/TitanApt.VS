-- Lesson levels expanded from 3 to 5: BEGINNER, BASIC, INTERMEDIATE, ADVANCED, EXPERT.
-- Supports the Beginner-to-Expert learning path for every aptitude topic.
-- Rebuilt as a new enum type because Postgres cannot DROP an existing enum value
-- nor reposition one, and bare identifiers are not accepted by ADD VALUE here.
CREATE TYPE "LessonLevelNew" AS ENUM ('BEGINNER', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

ALTER TABLE "Lesson" ALTER COLUMN "level" DROP DEFAULT;

ALTER TABLE "Lesson" ALTER COLUMN "level" TYPE "LessonLevelNew" USING "level"::text::"LessonLevelNew";

ALTER TABLE "Lesson" ALTER COLUMN "level" SET DEFAULT 'BEGINNER';

DROP TYPE "LessonLevel";

ALTER TYPE "LessonLevelNew" RENAME TO "LessonLevel";
