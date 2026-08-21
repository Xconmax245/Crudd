-- =====================================================================
-- CRUDD Phase 2.5 — Global Leaderboard (Soft Accounts)
-- ADDITIVE, NON-DESTRUCTIVE migration.
--
-- This migration ONLY adds a new column, a new table and indexes.
-- It NEVER drops or alters existing columns, tables or data.
-- Safe to run against the live database with existing rows: the new
-- `player_id` column is nullable, so pre-existing participant rows and the
-- existing guest flow are completely unaffected.
--
-- Apply with (from packages/database):
--   pnpm --filter @crudd/database exec prisma db execute \
--     --file prisma/migrations-manual/0002_global_leaderboard/migration.sql \
--     --schema prisma/schema.prisma
--
-- (Or paste into the Supabase SQL editor.)
-- Re-runnable: every statement is guarded with IF NOT EXISTS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. match_participants: persistent (soft-account) player identity
-- ---------------------------------------------------------------------
ALTER TABLE "match_participants" ADD COLUMN IF NOT EXISTS "player_id" TEXT;

CREATE INDEX IF NOT EXISTS "match_participants_player_id_idx"
  ON "match_participants" ("player_id");

-- ---------------------------------------------------------------------
-- 2. player_profiles: lightweight persistent identity + denormalized total
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "player_profiles" (
  "player_id"   TEXT NOT NULL,
  "username"    TEXT NOT NULL,
  "first_seen"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "total_score" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("player_id")
);

CREATE INDEX IF NOT EXISTS "player_profiles_total_score_idx"
  ON "player_profiles" ("total_score");
