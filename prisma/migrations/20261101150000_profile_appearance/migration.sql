-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'dark',
ADD COLUMN "accent" TEXT NOT NULL DEFAULT 'orange';
