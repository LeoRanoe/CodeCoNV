/**
 * The trades a project starts with, when nobody has configured its own. This is CODECO's
 * working vocabulary and it is Dutch on purpose; a project's disciplines are its own data
 * once it exists (Management → Project setup) and are never translated on screen.
 *
 * The same list is the default of `project_settings.disciplines` in the database
 * (migration 202610100002).
 */
export const constructionDisciplines = [
  "Bouwvakkers / algemeen",
  "Timmerlieden",
  "Metselaars",
  "Beton en wapening",
  "Betonwerkers",
  "Wapeningwerkers",
  "Elektriciens",
  "HVAC",
  "Loodgieters / sanitair",
  "Schilders",
  "Gevelwerk",
  "Tegelzetters",
  "Grondwerk",
  "Staalbouw",
  "Steigerbouwers",
  "Dakwerk",
  "Machine-operators",
  "HSE / veiligheidsmedewerkers",
  "Voormannen / supervisors",
] as const;
