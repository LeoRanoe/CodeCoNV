/**
 * Who signed a controlled document, and when, read the same way for the screen, the PDF and the
 * Word file. The issuer's signature lives on the record; the recipient's lives on the formal
 * response, where the server stamped who captured it and when. Neither is ever derived from a
 * typed name alone.
 */
const zone = "America/Paramaribo";

function filled(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** A business moment, always in Suriname time: "10 Oct 2026, 13:52 SRT". */
export function signatureMoment(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(date)} SRT`;
}

const png = (value) => (typeof value === "string" && value.startsWith("data:image/png;base64,") ? value : null);

export function controlledDocumentSignatures(entry) {
  const details = record(entry?.details);
  const response = record(details.response);
  const issuerInk = png(filled(entry?.signature_image, details.signature_image));
  const recipientInk = png(filled(response.signature_image));
  return {
    issuer: {
      name: filled(entry?.signed_by, details.signed_by, details.issued_by),
      position: filled(details.signed_by_position, details.issuer_position),
      company: filled(details.issuer_company),
      ink: issuerInk,
      signedAt: signatureMoment(filled(entry?.signed_at, details.signed_at)),
      signed: Boolean(issuerInk),
    },
    recipient: {
      decision: filled(response.decision),
      comments: filled(response.comments),
      name: filled(response.respondent_name),
      position: filled(response.respondent_position),
      company: filled(response.respondent_company),
      ink: recipientInk,
      signed: Boolean(recipientInk),
      // A response without a signature still has the moment it was recorded.
      signedAt: signatureMoment(filled(recipientInk ? response.signed_at : "", response.responded_at)),
      capturedBy: filled(response.responded_by_name),
      onDevice: response.signature_capture === "on_device",
    },
    contractor: {
      name: filled(details.contractor_signed_by, details.contractor_representative),
      position: filled(details.contractor_position),
      remarks: filled(details.contractor_remarks),
      ink: png(filled(details.contractor_signature_image)),
      signedAt: signatureMoment(filled(details.contractor_signed_at)),
    },
    supervision: {
      name: filled(details.supervision_signed_by, details.supervision_name),
      ink: png(filled(details.supervision_signature_image)),
      signedAt: signatureMoment(filled(details.supervision_signed_at)),
    },
  };
}

/** The lifecycle shown beside a document: unsigned, issued (awaiting the recipient), acknowledged. */
export function documentSignatureState(entry) {
  const { issuer, recipient } = controlledDocumentSignatures(entry);
  if (!issuer.signed) return "draft";
  return recipient.signed || recipient.decision === "acknowledged" ? "acknowledged" : "issued";
}

/** The line under a recipient signature that says whose device it was written on. */
export function recipientCaptureNote(recipient) {
  if (!recipient.signed) return "";
  return recipient.onDevice && recipient.capturedBy ? `Signed on the device of ${recipient.capturedBy}` : "";
}
