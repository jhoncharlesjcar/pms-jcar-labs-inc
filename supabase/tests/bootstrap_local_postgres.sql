-- Minimal Supabase-owned schemas for validating project migrations on plain PostgreSQL.
-- Test-only: never apply this file to a Supabase project.

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'CREATE SCHEMA auth';
    EXECUTE 'GRANT USAGE, CREATE ON SCHEMA auth TO PUBLIC';
    EXECUTE 'CREATE TABLE auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text,
      created_at timestamptz NOT NULL DEFAULT now()
    )';
    EXECUTE 'CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$ SELECT NULLIF(current_setting(''request.jwt.claim.sub'', true), '''')::uuid $fn$';
    EXECUTE 'CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $fn$ SELECT COALESCE(NULLIF(current_setting(''request.jwt.claim.role'', true), ''''), current_user) $fn$';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    EXECUTE 'CREATE SCHEMA storage';
    EXECUTE 'GRANT USAGE, CREATE ON SCHEMA storage TO PUBLIC';
    EXECUTE 'CREATE TABLE storage.buckets (
      id text PRIMARY KEY,
      name text NOT NULL UNIQUE,
      public boolean NOT NULL DEFAULT false
    )';
  END IF;
END $$;
