-- Supabase records function migrations transactionally, but PostgREST can keep
-- the previous function signature cache until it receives an explicit reload.
notify pgrst, 'reload schema';
