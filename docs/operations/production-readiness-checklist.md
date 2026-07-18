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
- [ ] **CODECO Cloudflare-account voor de opslaggateway**
  - primaire en back-upbeheerder;
  - MFA actief;
  - Worker- en domeintoegang niet afhankelijk maken van een persoonlijk ontwikkelaarsaccount.
- [ ] **Dedicated CODECO Google-opslagaccount**
  - uitsluitend voor applicatiebestanden en back-ups;
  - niet het persoonlijke account van een medewerker;
  - MFA, herstelmail en hersteltelefoon ingesteld;
  - minimaal twee aangewezen herstelbeheerders.
- [ ] **CODECO Google Cloud-project**
  - Drive API actief;
  - OAuth-client voor de Worker-gateway;
  - beperkte `drive.file`-scope;
  - consent screen en redirect-URL gecontroleerd.
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

- [ ] Supabase URL, publishable key en serversecret staan alleen in de juiste serveromgeving.
- [ ] Google client-ID, clientsecret en refresh token staan uitsluitend als Worker secrets.
- [ ] Een willekeurig uploadsessie-secret van minimaal 32 bytes staat uitsluitend in de Worker.
- [ ] De private Google-rootmap is door de applicatie aangemaakt of expliciet voor de applicatie bestemd.
- [ ] De Drive-gateway is gepubliceerd en de webapp gebruikt de definitieve gateway-URL.
- [ ] Testupload, hervatten, geautoriseerde download en geweigerde download zijn gecontroleerd.
- [ ] Drive-quota wordt getoond en bij 80% is een verantwoordelijke aangewezen.
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

- [ ] Dagelijkse JSON-back-up naar de private Drive-map is actief.
- [ ] SHA-256 van een back-up is geverifieerd.
- [ ] Eén back-up is buiten het dedicated Google-account gedownload.
- [ ] Restore-dry-run is succesvol en vastgelegd.
- [ ] Maandelijkse hersteltest heeft een eigenaar en agendataak.
- [ ] Incidentprocedure voor verloren Google-, Supabase- of Cloudflare-toegang is vastgesteld.

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
