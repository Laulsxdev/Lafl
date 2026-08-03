-- Lafl TMS · Migration 007 · platform-level super admin role
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.
-- (separate migration: new enum values can't be used in the same transaction)
alter type user_role add value 'super_admin';
