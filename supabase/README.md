# CODECO Supervisie database

De database is migration-first. Pas wijzigingen lokaal toe met de Supabase CLI en leg iedere wijziging vast in `supabase/migrations` voordat zij naar een gekoppeld project wordt gepusht.

## Veilige volgorde

1. Installeer de Supabase CLI en start de lokale stack.
2. Voer `supabase db reset` uit om alle migrations vanaf nul te testen.
3. Voer de database- en RLS-tests uit voor alle rollen.
4. Koppel pas daarna het afgescheiden CODECO pilotproject.
5. Gebruik `supabase db push`; wijzig het remote schema niet handmatig.

De React-app krijgt uitsluitend de publieke URL en publishable/anon key. Service-role keys, Supabase Vault-secrets en Google OAuth-tokens blijven server-side.
