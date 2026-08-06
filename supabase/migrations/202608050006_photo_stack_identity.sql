-- One situation can be photographed in several frames. The capture remains the existing
-- source for descriptions and locations; this nullable key only groups those captures.
alter table public.visual_captures
  add column if not exists stack_id uuid;

create index if not exists visual_captures_stack_idx
  on public.visual_captures (project_id, stack_id, captured_at)
  where stack_id is not null and status = 'active';

notify pgrst, 'reload schema';
