-- F01 (client-spec audit), the part that needs no client decision: a portal round moves the record
-- it is about, so the NCR/issue, the contractor portal and Rapid Verify show the same state.
--
-- The rule is the one the account-free share link already applies (202610100005):
-- * a contractor response or resubmission in the portal moves an open or assigned finding to
--   in_progress; a contractor answering a reopened finding moves it back to in_progress;
-- * a contractor marking the work complete or submitting evidence moves the finding to
--   ready_for_verification (never to closed: closing stays CODECO's verification);
-- * files the contractor attaches are linked to the finding (evidence, or "after" for completed work);
-- * a CODECO return in the portal reopens a finding that waited for verification, when the
--   reviewer may verify findings (the same authority Rapid Verify needs);
-- * closing or cancelling the finding closes its open portal items, with an event in each round.
-- Every move is written to finding_updates with the portal step and actor, and every portal step
-- stays in portal_events. No other record type changes here: which form a contractor may move is
-- part of the open Word section 20 item 2 decision.

create or replace function app_private.portal_event_moves_record()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_share public.portal_shares;
  v_finding public.findings;
  v_to text;
begin
  select * into v_share from public.portal_shares where id = new.share_id;
  if v_share.id is null or v_share.record_type <> 'finding' or new.actor_side not in ('contractor', 'codeco') then
    return new;
  end if;
  select * into v_finding from public.findings where id = v_share.record_id and project_id = v_share.project_id for update;
  if not found then return new; end if;

  v_to := case
    when new.actor_side = 'contractor' and new.action in ('respond', 'resubmit') and v_finding.status in ('open', 'assigned', 'reopened')
      then 'in_progress'
    when new.actor_side = 'contractor' and new.action in ('mark_complete', 'submit_evidence') and v_finding.status in ('open', 'assigned', 'in_progress', 'reopened')
      then 'ready_for_verification'
    when new.actor_side = 'codeco' and new.action = 'return' and v_finding.status = 'ready_for_verification'
      and app_private.has_project_permission(v_finding.project_id, 'findings.verify')
      then 'reopened'
  end;
  if v_to is not null then
    update public.findings set status = v_to where id = v_finding.id;
    insert into public.finding_updates (organization_id, project_id, finding_id, update_type, message, from_status, to_status, created_by)
    values (v_finding.organization_id, v_finding.project_id, v_finding.id, 'status',
      left('Portal ' || replace(new.action, '_', ' ') || coalesce(' by ' || nullif(new.actor_name, ''), '')
        || coalesce(': ' || nullif(btrim(new.comment), ''), ''), 4000),
      v_finding.status, v_to, coalesce(new.actor_user_id, v_share.assigned_by));
  end if;

  if new.actor_side = 'contractor' and cardinality(coalesce(new.file_ids, '{}')) > 0 then
    insert into public.file_links (organization_id, project_id, file_id, record_type, record_id, relationship, created_by)
    select v_finding.organization_id, v_finding.project_id, file_id, 'finding', v_finding.id,
      case when new.action = 'mark_complete' then 'after' else 'evidence' end, coalesce(new.actor_user_id, v_share.assigned_by)
    from unnest(new.file_ids) file_id
    where exists (select 1 from public.files file where file.id = file_id and file.project_id = v_finding.project_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists portal_events_move_record on public.portal_events;
create trigger portal_events_move_record after insert on public.portal_events
  for each row execute function app_private.portal_event_moves_record();

-- Closing or cancelling a finding closes what is still open about it in the portals.
create or replace function app_private.finding_closes_portal_items()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_share public.portal_shares;
  v_actor uuid := coalesce((select auth.uid()), new.verified_by);
begin
  if new.status is not distinct from old.status or new.status not in ('closed', 'cancelled') then
    return new;
  end if;
  for v_share in
    select * from public.portal_shares
    where record_type = 'finding' and record_id = new.id and project_id = new.project_id
      and status not in ('closed', 'withdrawn', 'superseded')
    for update
  loop
    update public.portal_shares set status = 'closed', closed_at = now(), updated_at = now() where id = v_share.id;
    insert into public.portal_events (organization_id, project_id, share_id, round, action, actor_user_id, actor_name, actor_side, comment, previous_status, resulting_status)
    values (v_share.organization_id, v_share.project_id, v_share.id, v_share.round, 'close', v_actor,
      (select display_name from public.profiles where id = v_actor), 'codeco',
      case new.status when 'closed' then 'The record was verified and closed.' else 'The record was cancelled.' end,
      v_share.status, 'closed');
  end loop;
  return new;
end;
$$;

drop trigger if exists findings_close_portal_items on public.findings;
create trigger findings_close_portal_items after update of status on public.findings
  for each row execute function app_private.finding_closes_portal_items();
