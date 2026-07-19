# CODECO Supervisie — productiechecklist

Laatst bijgewerkt: 18-07-2026  
Eigenaar checklist: CODECO N.V.

Gebruik deze lijst vóór formele ingebruikname. Dezelfde items staan centraal in **Meer → Beheer → Productiegereedheid**. Sla hier en in de app nooit wachtwoorden, herstelcodes, client secrets, refresh tokens of service keys op. Noteer alleen wie iets heeft gecontroleerd, wanneer en waar het bewijs intern wordt bewaard.

## 1. Accounts die CODECO nog moet aanmaken of overnemen

- [ ] **Twee persoonlijke CODECO-appbeheerders**
  - één primaire organisatiebeheerder;
  - één back-upbeheerder;
  - geen gedeeld e-mailadres of gedeeld wachtwoord;
  - beide activeren TOTP/MFA en bewaren herstelcodes afzonderlijk.
- [ ] **CODECO-eigenaar en back-upbeheerder in Supabase**
  - gebruik zakelijke CODECO-mailadressen;
  - activeer MFA;
  - leg herstelcontact en verantwoordelijk eigenaar vast;
  - bevestig dat self-signup uitgeschakeld blijft.
- [ ] **CODECO Vercel-team voor de webapp**
  - importeer de Git-repository in een CODECO-beheerd team;
  - wijs een primaire en back-upbeheerder aan;
  - activeer MFA en leg facturatie- en herstelcontact vast;
  - laat productie niet afhankelijk zijn van een persoonlijk ontwikkelaarsaccount;
  - maak een private Blob-store en koppel die aan het productieproject.
- [ ] **Productie-SMTP/afzenderaccount**
  - CODECO-afzenderadres voor uitnodigingen en wachtwoordherstel;
  - SPF, DKIM en DMARC gecontroleerd;
  - primaire en back-upbeheerder aangewezen.
- [ ] **Interne gebruikersaccounts**
  - projectleider;
  - lead supervisor;
  - supervisors;
  - Kwaliteit/HSE-manager;
  - contract-/back-upbeheerder;
  - opdrachtgever/aannemer pas nadat CODECO hun zichtbaarheid formeel heeft vastgesteld.

## 2. Secrets en koppelingen — door ontwikkelaar en CODECO IT

- [ ] Vercel gebruikt `apps/web` als Root Directory en Node.js 22.x (minimaal 22.13.0).
- [ ] Alle waarden uit `apps/web/.env.example` staan per Vercel Environment ingesteld; `SUPABASE_SECRET_KEY` is alleen server-side beschikbaar.
- [ ] Het definitieve Vercel-domein staat in Supabase als Site URL en toegestane redirect-URL.
- [ ] Supabase URL, publishable key en serversecret staan alleen in de juiste serveromgeving.
- [ ] De Blob-store staat op **Private** en is alleen aan de noodzakelijke Vercel-omgevingen gekoppeld.
- [ ] `BLOB_STORE_ID` en de roterende `VERCEL_OIDC_TOKEN` worden door Vercel aan de productieomgeving geleverd.
- [ ] Testupload, voortgang, geautoriseerde download en geweigerde download zijn gecontroleerd.
- [ ] Blob-opslag, dataverkeer en kostenwaarschuwingen hebben een verantwoordelijke.
- [ ] Productie-SMTP is in Supabase ingesteld; uitnodiging en wachtwoordherstel zijn getest.

## 3. Beleid en klantbesluiten

- [ ] Definitieve dagrapportvragen goedgekeurd.
- [ ] Definitieve inspectie-, HSE- en NCR-formulieren goedgekeurd.
- [ ] Zichtbaarheid voor opdrachtgever, aannemer en onderaannemer vastgelegd.
- [ ] Bewaartermijnen per record- en bestandstype vastgesteld.
- [ ] Juridisch niveau en verplichte rollen voor ondertekening vastgesteld.
- [ ] Definitieve KPI-formules vastgesteld.
- [ ] Officiële productnaam, logo, kleuren en rapportvoettekst aangeleverd.
- [ ] Proces voor kosten, budgetten en aannemersdeclaraties vastgesteld.
- [ ] Week-/tweeweekrapportage wel of niet onderdeel van de eerste formele livegang verklaard.

## 4. Back-up en herstel

- [ ] Dagelijkse JSON-back-up naar een afzonderlijke herstelbestemming is actief.
- [ ] SHA-256 van een back-up is geverifieerd.
- [ ] Eén back-up is buiten de primaire Vercel-omgeving opgeslagen.
- [ ] Restore-dry-run is succesvol en vastgelegd.
- [ ] Maandelijkse hersteltest heeft een eigenaar en agendataak.
- [ ] Incidentprocedure voor verloren Vercel- of Supabase-toegang is vastgesteld.

## 5. Gebruikersacceptatie en go-live

- [ ] Volledige testwerkdag uitgevoerd door minimaal één projectleider en twee supervisors.
- [ ] Op telefoon en tablet getest op de echte bouwlocatieverbinding.
- [ ] Projectstart, aanwezigheid, inspectie, automatische bevinding, herstel en verificatie getest.
- [ ] HSE-incident en kritieke melding getest met niet-gevoelige testdata.
- [ ] Dagrapportreview, frozen PDF, ondertekening, distributie en revisie getest.
- [ ] Account uitnodigen, opschorten, heractiveren en intrekken getest met een testaccount.
- [ ] CODECO heeft de open punten in de productplan-compliance expliciet geaccepteerd of gesloten.
- [ ] Go-live eigenaar, vervanger en support-/incidentcontact zijn bekendgemaakt.

## Go-livebesluit

Formele productie mag pas worden afgetekend wanneer alle blokkerende items in de applicatie op **Gereed** staan met controlebewijs. Niet-blokkerende huisstijl- of roadmapitems mogen alleen openblijven wanneer CODECO dit schriftelijk accepteert.
