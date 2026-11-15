-- Store avatar image bytes alongside the profile so uploaded avatars
-- survive environments with ephemeral local disks (e.g. Render free tier).
-- Additive only: no existing data is modified or removed.

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "avatarData" BYTEA,
ADD COLUMN "avatarMime" TEXT;
