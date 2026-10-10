/**
 * Turns a failed save into a sentence a supervisor can act on, in the interface language.
 *
 * Database rules raise short English messages with a SQLSTATE code. Business-rule messages
 * (23514) say what is missing, so each one is translated; everything else is described by its
 * category. Raw Postgres/PostgREST/network wording never reaches the screen.
 */

type Translate = (english: string, dutch: string) => string;

const ruleMessages: Record<string, string> = {
  "A final corrective measure is required before verification": "Vul eerst de definitieve correctieve maatregel in; daarna kan worden geverifieerd.",
  "A report version must be frozen before approval": "Zet eerst een rapportversie vast; daarna kan het rapport worden goedgekeurd.",
  "Access already has the requested status": "Deze toegang heeft die status al.",
  "Administrators cannot change their own access status": "Een beheerder kan de eigen toegang niet wijzigen.",
  "An available JPEG, PNG or WebP project image is required": "Kies een beschikbare projectfoto (JPEG, PNG of WebP).",
  "An available PDF, JPEG, PNG or WebP drawing is required": "Kies een beschikbare tekening (PDF, JPEG, PNG of WebP).",
  "At least one building is required": "Kies minimaal één gebouw.",
  "Checklist item is not part of this inspection": "Dit checklistpunt hoort niet bij deze inspectie.",
  "A signed document keeps its signature": "Een ondertekend document behoudt zijn handtekening. De wijziging is niet opgeslagen.",
  "A signed record keeps its signature": "Een ondertekende registratie behoudt haar handtekening. De wijziging is niet opgeslagen.",
  "The recorded response can only change through a formal response": "Dit document is intussen beantwoord. Open het opnieuw en bewerk het vanaf de actuele versie.",
  "The issuer has to sign the document before the recipient": "Het document moet eerst door de uitgever zijn ondertekend.",
  "The recipient cannot be the issuer of the document": "De ontvanger kan niet de uitgever van het document zijn.",
  "This record was changed by someone else": "Dit document is intussen door iemand anders gewijzigd. Open het opnieuw en bewerk het vanaf de actuele versie.",
  "Closed controlled documents cannot be changed": "Een gesloten document kan niet meer worden gewijzigd.",
  "Daily closeout is required": "De dagafsluiting ontbreekt nog; vul eerst de dagvragen in.",
  "Drawing must belong to a building": "De tekening moet bij een gebouw horen.",
  "Final findings cannot receive progress updates": "Een afgeronde bevinding kan geen voortgang meer krijgen.",
  "Frozen report version is required": "Zet eerst een rapportversie vast.",
  "Only a signed report can be distributed": "Alleen een ondertekend rapport kan worden verzonden.",
  "Only an active drawing pin can be moved": "Alleen een actieve tekeningpin kan worden verplaatst.",
  "Only suspended access can be reactivated": "Alleen opgeschorte toegang kan opnieuw worden geactiveerd.",
  "Only the latest frozen report version can be signed": "Alleen de nieuwste vastgezette rapportversie kan worden ondertekend.",
  "Only the latest report version can be distributed": "Alleen de nieuwste rapportversie kan worden verzonden.",
  "Project start check is required": "De projectstart ontbreekt nog; start eerst de werkdag.",
  "Report is not available for signing": "Dit rapport kan nu niet worden ondertekend.",
  "Report must be in review before approval": "Zet het rapport eerst in review; daarna kan het worden goedgekeurd.",
  "Report snapshot checksum is invalid": "De rapportgegevens zijn onderweg gewijzigd. Vernieuw en probeer opnieuw.",
  "Report snapshot does not match the current central report data": "Het rapport is intussen gewijzigd. Vernieuw de pagina en zet de versie opnieuw vast.",
  "Review decision does not match the central report status": "De rapportstatus is intussen gewijzigd. Vernieuw de pagina.",
  "Review version does not belong to this report": "Deze versie hoort niet bij dit rapport.",
  "Revoked access cannot be reactivated": "Ingetrokken toegang kan niet opnieuw worden geactiveerd.",
  "The quality-control signature is required to close an NCR": "Een NCR sluiten vraagt de handtekening van kwaliteitscontrole.",
  "The selected media folder does not belong to this project/building": "De gekozen map hoort niet bij dit project of gebouw.",
};

function codeOf(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "";
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "";
}

export function userFacingError(error: unknown, text: Translate) {
  const message = messageOf(error).trim();
  const code = codeOf(error);

  const rule = Object.keys(ruleMessages).find((english) => message.startsWith(english));
  if (rule) return text(rule.endsWith(".") ? rule : `${rule}.`, ruleMessages[rule]);
  if (/^Invalid finding transition/i.test(message)) {
    return text("This status change is not allowed from the current status.", "Deze statuswijziging is vanuit de huidige status niet toegestaan.");
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return text("No connection. Your input is still in the form; try again once you are online.", "Geen verbinding. Je invoer staat nog in het formulier; probeer opnieuw zodra je online bent.");
  }
  if (/failed to fetch|network|load failed|timeout|ECONN/i.test(message)) {
    return text("The server cannot be reached. Nothing was marked as saved; try again.", "De server is niet bereikbaar. Er is niets als opgeslagen gemarkeerd; probeer opnieuw.");
  }
  if (code === "42501" || /permission|not allowed|may not|only a|only an/i.test(message)) {
    return text("You do not have permission for this action in this project.", "Je hebt in dit project geen recht voor deze handeling.");
  }
  if (code === "28000" || /JWT|session|authentication required/i.test(message)) {
    return text("Your session has expired. Sign in again; your input is still in the form.", "Je sessie is verlopen. Meld je opnieuw aan; je invoer staat nog in het formulier.");
  }
  if (code === "P0002" || code === "PGRST116") {
    // The database answers "not found" both for a removed row and for a row the role may see but not
    // change, so the sentence has to hold for both.
    return text("This record was removed, or your role cannot change it.", "Dit record is verwijderd, of je rol mag het niet wijzigen.");
  }
  if (code === "23505") {
    return text("This already exists. Refresh to see the current version.", "Dit bestaat al. Vernieuw om de actuele versie te zien.");
  }
  if (code === "23503") {
    return text("A linked record no longer exists. Refresh and choose again.", "Een gekoppeld record bestaat niet meer. Vernieuw en kies opnieuw.");
  }
  if (code === "22023" || code === "22001" || code === "22007" || code === "23514") {
    return text("Some input does not meet the requirements. Check the highlighted fields and try again.", "Een deel van de invoer voldoet niet aan de eisen. Controleer de velden en probeer opnieuw.");
  }
  // A sentence this app wrote itself (Dutch, no technical markers) may be shown as it is.
  if (message && !/[_{}]|SQL|PGRST|relation |column |violates|duplicate key|null value/i.test(message) && /[a-z]{3}/.test(message) && !code) {
    return message;
  }
  return text("Saving did not work. Nothing was marked as saved; try again.", "Opslaan is niet gelukt. Er is niets als opgeslagen gemarkeerd; probeer opnieuw.");
}
