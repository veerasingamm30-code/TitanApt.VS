CREATE TABLE "LearningChapterProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "volumeSlug" TEXT NOT NULL,
    "chapterKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningChapterProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningChapterProgress_userId_volumeSlug_chapterKey_key"
ON "LearningChapterProgress"("userId", "volumeSlug", "chapterKey");

CREATE INDEX "LearningChapterProgress_userId_volumeSlug_idx"
ON "LearningChapterProgress"("userId", "volumeSlug");

ALTER TABLE "LearningChapterProgress"
ADD CONSTRAINT "LearningChapterProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
