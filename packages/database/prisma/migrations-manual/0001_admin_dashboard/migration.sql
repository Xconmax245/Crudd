-- =====================================================================
-- CRUDD Phase 1.5 — Admin Dashboard
-- ADDITIVE, NON-DESTRUCTIVE migration.
--
-- This migration ONLY adds new enums, columns, tables and indexes.
-- It NEVER drops or alters existing Phase 0/1 columns, tables or data.
-- Safe to run against the live Supabase database with existing rows.
--
-- Apply with (from packages/database):
--   pnpm --filter @crudd/database exec prisma db execute \
--     --file prisma/migrations-manual/0001_admin_dashboard/migration.sql \
--     --schema prisma/schema.prisma
--
-- (Or paste into the Supabase SQL editor.)
-- Re-runnable: every statement is guarded with IF NOT EXISTS / conditional DO blocks.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContentStatus') THEN
    CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminRole') THEN
    CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'MODERATOR');
  END IF;
END$$;

-- ---------------------------------------------------------------------
-- 2. question_banks: publishing / content-management metadata
-- ---------------------------------------------------------------------
ALTER TABLE "question_banks" ADD COLUMN IF NOT EXISTS "description"  TEXT;
ALTER TABLE "question_banks" ADD COLUMN IF NOT EXISTS "category"     TEXT;
ALTER TABLE "question_banks" ADD COLUMN IF NOT EXISTS "tags"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "question_banks" ADD COLUMN IF NOT EXISTS "status"       "ContentStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "question_banks" ADD COLUMN IF NOT EXISTS "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "question_banks" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3);
ALTER TABLE "question_banks" ADD COLUMN IF NOT EXISTS "archived_at"  TIMESTAMP(3);

-- ---------------------------------------------------------------------
-- 3. questions: publishing / content-management metadata
-- ---------------------------------------------------------------------
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "status"       "ContentStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3);
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "archived_at"  TIMESTAMP(3);

-- ---------------------------------------------------------------------
-- 4. Indexes on existing tables
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "question_banks_status_idx"    ON "question_banks" ("status");
CREATE INDEX IF NOT EXISTS "question_banks_createdAt_idx" ON "question_banks" ("createdAt");
CREATE INDEX IF NOT EXISTS "questions_bank_id_idx"        ON "questions" ("bank_id");
CREATE INDEX IF NOT EXISTS "questions_status_idx"         ON "questions" ("status");

-- ---------------------------------------------------------------------
-- 5. admin_users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "admin_users" (
  "id"            TEXT NOT NULL,
  "auth_user_id"  TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "display_name"  TEXT,
  "role"          "AdminRole" NOT NULL DEFAULT 'ADMIN',
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" TIMESTAMP(3),
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_auth_user_id_key" ON "admin_users" ("auth_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_key"        ON "admin_users" ("email");
CREATE INDEX        IF NOT EXISTS "admin_users_auth_user_id_idx" ON "admin_users" ("auth_user_id");

-- ---------------------------------------------------------------------
-- 6. audit_logs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"            TEXT NOT NULL,
  "admin_user_id" TEXT,
  "action"        TEXT NOT NULL,
  "entity_type"   TEXT,
  "entity_id"     TEXT,
  "metadata"      JSONB,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_admin_user_id_idx"        ON "audit_logs" ("admin_user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"           ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs" ("entity_type", "entity_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_admin_user_id_fkey'
  ) THEN
    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_admin_user_id_fkey"
      FOREIGN KEY ("admin_user_id") REFERENCES "admin_users" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ---------------------------------------------------------------------
-- 7. platform_settings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key"        TEXT NOT NULL,
  "value"      JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);
