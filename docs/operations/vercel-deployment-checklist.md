# CODECO Supervisie — Vercel deployment

Laatst bijgewerkt: 18-07-2026

Deze applicatie wordt als native Next.js-app vanuit `apps/web` op Vercel gebouwd. De aparte Cloudflare Worker blijft uitsluitend de private Google Drive-gateway.

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
- [ ] `NEXT_PUBLIC_STORAGE_GATEWAY_URL` — pas nadat de private Drive-gateway is gepubliceerd

## Origins en redirects

- [ ] Stel het definitieve Vercel-productiedomein in als Supabase Auth Site URL.
- [ ] Voeg alleen noodzakelijke Vercel-productie- en previewredirects toe aan Supabase Auth.
- [ ] Zet `APP_ORIGIN` van de Drive-gateway op het definitieve Vercel-productie-origin.
- [ ] Test uitnodiging, eerste wachtwoord, aanmelden, afmelden en verlopen sessie op het productiedomein.
- [ ] Test upload en download vanaf het productiedomein; een ander origin moet door de gateway worden geweigerd.

## Release gate

- [ ] `npm ci`, lint, typecheck, Next.js-productiebouw en tests zijn groen.
- [ ] Supabase-migraties en pgTAP-tests zijn groen voordat productie wordt gemigreerd.
- [ ] Een gewone foto kan worden geüpload, exact geannoteerd en als formele bevinding teruggevonden.
- [ ] Een equirectangulair 360°-beeld kan optioneel worden geopend, geannoteerd en in een tour worden doorlopen.
- [ ] Engels opent standaard; de taalkeuze Nederlands blijft na herladen behouden.
- [ ] Voer een visuele UAT uit in een ondersteunde desktop- en mobiele browser; controleer daarbij beide talen, gewone foto, 360°-navigatie en markers.
- [ ] Alle blokkerende items onder **More → Production readiness** zijn met bewijs afgerond.
