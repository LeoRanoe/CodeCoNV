# CODECO Constructiesupervisie

Interne, online-first Next.js-webapp voor dagelijkse constructiesupervisie. Supabase is de centrale bron voor identiteit, rollen, projectdata, rapporten en audit; de Vercel-webapp bevat geen openbare accountregistratie.

## Functionele scope

- organisatiebeheerder nodigt interne gebruikers uit en wijst organisatie-/projectrollen toe;
- project → gebouw → projectstart met dagelijkse vragen over verloop, weer, planning, bezetting, kwaliteit, HSE en voortgang;
- Engels als standaardinterface met een persistente Nederlandse taalkeuze;
- gewone foto's als standaard visueel bewijs, optionele 360°-panorama's/tours en exacte probleemmarkers die traceerbaar aan formele bevindingen zijn gekoppeld;
- aanwezigheid, werkzaamheden, acties en zestien projectspecifieke registers;
- configureerbare inspectie- en HSE-checklists met automatische bevinding bij afkeur;
- bevinding/NCR → herstel → gereed voor verificatie → onafhankelijke sluiting;
- formele HSE-registratie met vertrouwelijkheid en kritieke escalatie;
- in-appmeldingen voor naderende en vervallen acties/bevindingen;
- dagrapportreview, immutable snapshot+SHA-256, ondertekenverklaringen, distributiespoor en revisiehistorie;
- auditbare productiegereedheidschecklist, projectregels, locaties, partijen, checklists, TOTP en handmatige JSON-back-up/restore-dry-run in beheer.

De exacte dekking en open klantbesluiten staan in [`../../docs/product/product-plan-compliance.md`](../../docs/product/product-plan-compliance.md).
De accounts, externe koppelingen en go-livecontroles die CODECO nog moet afronden staan in [`../../docs/operations/production-readiness-checklist.md`](../../docs/operations/production-readiness-checklist.md) en centraal in **Meer → Beheer → Productiegereedheid**.

## Lokaal starten

Vereisten: Node.js 22.13 of nieuwer, Docker Desktop en de Supabase CLI.

```bash
npm install
npx supabase start --workdir ../..
copy .env.example .env.local
npm run dev
```

Vul in `.env.local` uitsluitend de publieke Supabase URL en publishable key in. `SUPABASE_SECRET_KEY` is alleen voor de serverroute die interne uitnodigingen verstuurt en mag nooit met `NEXT_PUBLIC_` beginnen.

## Verificatie

```bash
npm run lint
npx tsc --noEmit
npm test
npx supabase db reset --local --workdir ../..
npx supabase test db --local --workdir ../..
```

De database bestaat uit versioned migrations onder `../../supabase/migrations`; wijzigingen worden niet handmatig in productie aangebracht.

## Private Vercel Blob-opslag

Maak in het Vercel-project een **private** Blob-store en koppel die aan Production en de gewenste Preview-omgevingen. De app gebruikt beveiligde, kort geldige upload-URL's voor rechtstreekse browseruploads en serveert downloads uitsluitend via Next.js-routes die de actuele Supabase-sessie en projectrechten controleren. Vercel beheert `BLOB_STORE_ID` en de roterende `VERCEL_OIDC_TOKEN`; voor lokale ontwikkeling kan `vercel env pull` de benodigde waarden ophalen.

## Productie

De webapp wordt als native Next.js-app via Vercel gepubliceerd met `apps/web` als Root Directory. Self-signup blijft uit; alleen een beheerder kan interne accounts uitnodigen. Volg [de Vercel deploymentchecklist](../../docs/operations/vercel-deployment-checklist.md). Voor formele ingebruikname moeten alle blokkerende items in de productiegereedheidschecklist met een veilige bewijsreferentie zijn gesloten, met name het CODECO Vercel-team/domein, private Blob-opslag, SMTP, automatische back-up, definitieve klantformulieren, bewaartermijnen, juridisch ondertekenniveau en gebruikersacceptatie.
