-- Phase 1 Foundation Migration
-- This SQL can be run manually in the Supabase SQL Editor if the automatic migration fails

-- First, ensure exec_sql helper exists:
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE query;
END;
$$;

-- Now run the migration from the file:
-- Copy the contents of Backend/supabase/migrations/20260102000000_phase1_foundation.sql
-- and paste it in the SQL Editor, then click Run.
