-- The workforce disciplines a project starts with are CODECO's own vocabulary, and the
-- application writes that vocabulary in Dutch when a project is created from the screen
-- (apps/web/lib/forms/disciplines.ts). Projects created straight through the database
-- (create_project_workspace) still got an English list from the column default, so one
-- screen mixed two languages.
--
-- Only the default changes, and only projects that still carry that exact, untouched English
-- default are brought in line. A discipline somebody typed, renamed or removed is the
-- project's own data and is never rewritten, and neither is any attendance already recorded.

begin;

alter table public.project_settings
  alter column disciplines set default
    '["Bouwvakkers / algemeen","Timmerlieden","Metselaars","Beton en wapening","Betonwerkers","Wapeningwerkers","Elektriciens","HVAC","Loodgieters / sanitair","Schilders","Gevelwerk","Tegelzetters","Grondwerk","Staalbouw","Steigerbouwers","Dakwerk","Machine-operators","HSE / veiligheidsmedewerkers","Voormannen / supervisors"]'::jsonb;

update public.project_settings
set disciplines =
    '["Bouwvakkers / algemeen","Timmerlieden","Metselaars","Beton en wapening","Betonwerkers","Wapeningwerkers","Elektriciens","HVAC","Loodgieters / sanitair","Schilders","Gevelwerk","Tegelzetters","Grondwerk","Staalbouw","Steigerbouwers","Dakwerk","Machine-operators","HSE / veiligheidsmedewerkers","Voormannen / supervisors"]'::jsonb
where disciplines =
    '["Carpenters","Electricians","HVAC","Painters","Facade","Rebar / concrete workers","Tiler","Sanitary","General"]'::jsonb;

commit;
