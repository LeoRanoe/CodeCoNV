# Productie fresh start

Deze procedure wordt pas uitgevoerd nadat CODECO de live deployment heeft geaccepteerd. Ze is bewust niet geautomatiseerd vanuit de webapp: het wissen van Supabase en Vercel Blob is onomkeerbaar.

## Huidige technische gate

Een fresh start mag alleen doorgaan wanneer al deze controles groen zijn:

- de productieomgeving gebruikt een geldige `SUPABASE_SECRET_KEY`;
- Vercel Cron heeft een unieke `CRON_SECRET`;
- uploads staan in de primaire private Blob-store;
- databaseback-ups staan in een **tweede** private Blob-store via `BACKUP_BLOB_READ_WRITE_TOKEN`;
- Management toont een geverifieerde dagelijkse back-up met SHA-256;
- Management toont een geslaagde restore-dry-run;
- een pre-wipe back-up is gedownload naar een locatie buiten het Vercel-account en de checksum is gecontroleerd.

Een lege Blob-store of alleen aanwezige configuratievariabelen geldt niet als bewijs van een werkende back-up.

## Beslismoment

Leg vóór uitvoering vast:

- productieproject-ID en Supabase-projectreferentie;
- uitvoerder en tweede controleur;
- datum/tijd in `America/Paramaribo`;
- SHA-256 van de externe pre-wipe back-up;
- expliciet akkoord dat alle testgebruikers, projectdata, auditdata en Blob-objecten mogen verdwijnen.

## Uitvoeringsvolgorde

1. Zet de applicatie tijdelijk in onderhoudsmodus.
2. Stop Vercel Cron zodat tijdens het wissen geen nieuwe run start.
3. Maak en download een laatste volledige testdata-back-up.
4. Verifieer de download en voer een restore-dry-run uit.
5. Wis testdata via een afzonderlijk, gereviewd Supabase-script met een expliciete productiebevestiging.
6. Wis alle objecten uit zowel de primaire als de test-back-upstore die als testdata zijn aangemerkt.
7. Maak de definitieve organisatie, beheerders en het eerste productieproject opnieuw aan.
8. Activeer Cron opnieuw en forceer één dagelijkse back-uprun.
9. Controleer in Management dat back-up, SHA-256-readback en restore-dry-run groen zijn.
10. Hef onderhoudsmodus pas daarna op.

## Belangrijke beperking

De huidige geplande export beveiligt de database-inhoud en het bestandsmanifest. Een afzonderlijke kopie van de daadwerkelijke geüploade bestandsbytes moet vóór een wipe extern worden veiliggesteld. Zonder die kopie mogen Blob-objecten niet worden gewist als ze behouden moeten blijven.
