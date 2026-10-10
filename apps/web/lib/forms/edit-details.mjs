/**
 * The details a controlled document is saved with when it is edited.
 *
 * The form always produces a fresh details object, including an empty `response`. What was answered
 * is not the form's to rewrite: the recorded response and its history stay exactly as stored, and a
 * record that was never answered gets no `response` key it did not have (the database treats an
 * empty object and a missing key as different values and refuses the change).
 */
const answered = ["response", "response_history"];

export function detailsForEdit(existing, edited) {
  const stored = existing && typeof existing === "object" ? existing : {};
  const merged = { ...stored, ...edited };
  for (const key of answered) {
    if (key in stored) merged[key] = stored[key];
    else delete merged[key];
  }
  return merged;
}
