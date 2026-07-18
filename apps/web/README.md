# CODECO Constructiesupervisie

Interne, online-first webapp voor dagelijkse constructiesupervisie. Supabase is de centrale bron voor identiteit, rollen, projectdata, rapporten en audit; de private Sites-app bevat geen openbare accountregistratie.

## Functionele scope

- organisatiebeheerder nodigt interne gebruikers uit en wijst organisatie-/projectrollen toe;
- project → gebouw → projectstart met dagelijkse vragen over verloop, weer, planning, bezetting, kwaliteit, HSE en voortgang;
- aanwezigheid, werkzaamheden, acties en zestien projectspecifieke registers;
- configureerbare inspectie- en HSE-checklists met automatische bevinding bij afkeur;
- bevinding/NCR → herstel → gereed voor verificatie → onafhankelijke sluiting;
- formele HSE-registratie met vertrouwelijkheid en kritieke escalatie;
- in-appmeldingen voor naderende en vervallen acties/bevindingen;
- dagrapportreview, immutable snapshot+SHA-256, ondertekenverklaringen, distributiespoor en revisiehistorie;
- projectregels, locaties, partijen, checklists, TOTP en handmatige JSON-back-up/restore-dry-run in beheer.

De exacte dekking en open klantbesluiten staan in [`../../docs/product/product-plan-compliance.md`](../../docs/product/product-plan-compliance.md).

## Lokaal starten

Vereisten: Node.js 22+, Docker Desktop en de Supabase CLI.

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

## Google Drive-opslag

`../storage-gateway` bevat de aparte Cloudflare Worker voor JWT/RLS-geautoriseerde Google Drive-uploads en downloads. De webapp toont upload alleen wanneer `NEXT_PUBLIC_STORAGE_GATEWAY_URL` is ingesteld. Live gebruik vereist eerst een dedicated CODECO Google-account, OAuth met `drive.file` en Worker-secrets; tokens of Drive-sessie-URL's komen nooit in de browser.

## Productie

De webapp wordt privé via Sites gepubliceerd. Self-signup blijft uit; alleen een beheerder kan interne accounts uitnodigen. Voor volledige formele ingebruikname moeten de externe blokkades in de compliance-matrix worden gesloten, met name Drive/OAuth, automatische back-up, definitieve klantformulieren, bewaartermijnen en juridisch ondertekenniveau.
