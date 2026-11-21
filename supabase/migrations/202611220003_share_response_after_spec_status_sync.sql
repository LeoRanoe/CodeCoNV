-- Fix: a contractor answering an issue / NCR through a share link was refused with
-- "Only a finding manager may change the original observation" (found by
-- tests/e2e/media-and-sharing.spec.ts on 21-11-2026).
--
-- Since 202611210001 guard_record_spec() derives the workbook status (issue_management.spec.
-- workflow_status, and corrective_action_reopened) from the record's own status. When the share
-- workflow moves a finding to in_progress or ready_for_verification, that derived value changes
-- inside issue_management, and validate_finding_transition() (which runs after it) took it for
-- an edit of the original observation by someone without findings.manage.
--
-- The comparison now leaves out the two derived keys. Nobody can type them: guard_record_spec()
-- resets a typed workflow_status before this check runs.
--
-- Rollback: restore validate_finding_transition() from 202610060002.

begin;

do $migration$
declare
  v_definition text;
  v_new_old text := $old$(coalesce(new.issue_management, '{}'::jsonb) - v_allowed_keys)$old$;
  v_old_old text := $old$(coalesce(old.issue_management, '{}'::jsonb) - v_allowed_keys)$old$;
begin
  select pg_get_functiondef('app_private.validate_finding_transition()'::regprocedure) into v_definition;
  if position('corrective_action_reopened' in v_definition) > 0 then
    return;
  end if;
  if position(v_new_old in v_definition) = 0 or position(v_old_old in v_definition) = 0 then
    raise exception 'validate_finding_transition no longer contains the expected comparison';
  end if;
  v_definition := replace(v_definition, v_new_old,
    $new$((coalesce(new.issue_management, '{}'::jsonb) - v_allowed_keys) #- '{spec,workflow_status}' #- '{spec,corrective_action_reopened}')$new$);
  v_definition := replace(v_definition, v_old_old,
    $new$((coalesce(old.issue_management, '{}'::jsonb) - v_allowed_keys) #- '{spec,workflow_status}' #- '{spec,corrective_action_reopened}')$new$);
  execute v_definition;
end;
$migration$;

commit;
