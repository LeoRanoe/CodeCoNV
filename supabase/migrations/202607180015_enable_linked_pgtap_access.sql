begin;

do $$
declare
  v_schema text;
begin
  select namespace.nspname into v_schema
  from pg_catalog.pg_extension extension
  join pg_catalog.pg_namespace namespace on namespace.oid = extension.extnamespace
  where extension.extname = 'pgtap';

  if v_schema is null then
    raise exception 'pgTAP extension is not installed';
  end if;
  raise notice 'pgTAP extension schema: %', v_schema;

  execute pg_catalog.format('grant usage on schema %I to public', v_schema);
  execute pg_catalog.format('grant execute on all functions in schema %I to public', v_schema);
end;
$$;

commit;
