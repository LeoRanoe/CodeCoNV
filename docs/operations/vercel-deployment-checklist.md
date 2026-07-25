# CODECO Supervisie — Vercel deployment

Laatst bijgewerkt: 18-07-2026

Deze applicatie wordt als native Next.js-app vanuit `apps/web` op Vercel gebouwd. Bestandsbytes staan in een private Vercel Blob-store die aan hetzelfde project is gekoppeld.

## Eenmalig door CODECO

- [ ] Maak een CODECO-beheerd Vercel-team met een primaire en back-upbeheerder.
- [ ] Importeer de Git-repository en stel **Root Directory** in op `apps/web`.
- [ ] Kies **Node.js 22.x** (minimaal 22.13.0); buildcommand `npm run build` en installcommand `npm ci` worden uit `vercel.json` gelezen.
- [ ] Koppel het definitieve CODECO-domein en leg vast wie DNS en Vercel Deployment Protection beheert.

## Environment Variables

Stel deze waarden afzonderlijk in voor Production en, waar nodig, Preview. Kopieer nooit secrets naar een `NEXT_PUBLIC_`-variabele.

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [ ] `SUPABASE_SECRET_KEY` — uitsluitend server-side, voor beheerdersuitnodigingen
- [ ] `BLOB_STORE_ID` en `VERCEL_OIDC_TOKEN` — automatisch door Vercel na koppeling van de private Blob-store
- [ ] `BLOB_READ_WRITE_TOKEN` — alleen als lokale fallback; nooit publiek of met `NEXT_PUBLIC_`
- [ ] `BACKUP_BLOB_READ_WRITE_TOKEN` — afzonderlijke private back-upstore
- [ ] `CRON_SECRET` — willekeurige serversecret van minimaal 32 bytes
- [ ] `RESEND_API_KEY` — uitsluitend server-side voor projectmeldingen per e-mail
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — publieke sleutel voor apparaatregistratie
- [ ] `VAPID_PRIVATE_KEY` — server-only privésleutel
- [ ] `VAPID_SUBJECT` — `mailto:`-contact voor de pushprovider
- [ ] `NOTIFICATION_FROM_EMAIL` — alleen nodig wanneer de optionele e-mailfallback later wordt geactiveerd
- [ ] `NEXT_PUBLIC_SITE_URL` — canonieke productie-URL die in meldingsmails wordt opgenomen

## Origins en redirects

- [ ] Stel het definitieve Vercel-productiedomein in als Supabase Auth Site URL.
- [ ] Voeg alleen noodzakelijke Vercel-productie- en previewredirects toe aan Supabase Auth.
- [ ] Test uitnodiging, eerste wachtwoord, aanmelden, afmelden en verlopen sessie op het productiedomein.
- [ ] Test upload en download met een bevoegd account; een account zonder projectrecht moet worden geweigerd.

## Release gate

- [ ] `npm ci`, lint, typecheck, Next.js-productiebouw en tests zijn groen.
- [ ] Supabase-migraties en pgTAP-tests zijn groen voordat productie wordt gemigreerd.
- [ ] Een private Blob-store is aan Production en alleen de noodzakelijke Preview-omgevingen gekoppeld.
- [ ] Een gewone foto kan worden geüpload, exact geannoteerd en als formele bevinding teruggevonden.
- [ ] Een echte Insta360- of gelijkwaardige camera-export kan worden geopend, geannoteerd en in een tour worden doorlopen; een telefoonpanorama wordt geweigerd.
- [ ] Een deadline- of kritieke melding wordt naar het zakelijke e-mailadres verstuurd en krijgt in de app status `E-mail verzonden`.
- [ ] Een PDF-tekening kan vrij worden gemarkeerd en aan projectrecords worden gekoppeld zonder dat het bronbestand wijzigt.
- [ ] Engels opent standaard; de taalkeuze Nederlands blijft na herladen behouden.
- [ ] Voer een visuele UAT uit in een ondersteunde desktop- en mobiele browser; controleer daarbij beide talen, gewone foto, 360°-navigatie en markers.
- [ ] Alle blokkerende items onder **More → Production readiness** zijn met bewijs afgerond.
