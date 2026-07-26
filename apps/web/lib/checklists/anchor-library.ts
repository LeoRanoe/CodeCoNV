export const anchorChecklistLibrary = [
  {
    code: "LIB-101",
    module: "inspection" as const,
    category: "Anchors / Ankers",
    name: "Cast-in anchors · installation",
    description: "CODECO project checklist based on the client cast-in anchor reference form.",
    sort_order: 101,
    prompts: [
      "General|Approved construction drawings and the anchor layout are available on site.",
      "General|The latest Issued for Construction revision is available; obsolete revisions are removed and changes communicated.",
      "General|Approved documents are stored protected and organized on site.",
      "General|The approved work method statement and Engineer approval are available before installation.",
      "General|Anchor type, diameter, grade, embedment depth and projection match the approved documents.",
      "General|[AUTO_WEATHER] Ambient weather conditions are suitable for anchor installation and concrete work.",
      "Safety|All personnel wear the required PPE.",
      "Safety|Safety harnesses are used for work above 1.80 m.",
      "Safety|The work area is properly barricaded and access is controlled.",
      "Safety|Nearby structures and existing services are adequately protected.",
      "Safety|Electrical and mechanical hazards are identified and controlled.",
      "Anchor placement|Anchor locations are marked according to the approved shop drawings.",
      "Anchor placement|Lines, levels and reference points are verified.",
      "Anchor placement|The correct anchor type, size and quantity are available.",
      "Anchor placement|Anchors are free from damage, rust and contamination.",
      "Anchor placement|Installation templates are dimensionally accurate and securely fixed.",
      "Anchor placement|Threads are protected against concrete contamination.",
      "Anchor placement|Alignment, spacing, embedment depth and projection comply with the approved documents.",
      "Anchor placement|Concrete cover around anchors complies with the approved shop drawings.",
    ],
  },
  {
    code: "LIB-102",
    module: "inspection" as const,
    category: "Anchors / Ankers",
    name: "Cast-in anchors · before and during concrete casting",
    description: "CODECO project checklist for safety, pre-pour and concrete-casting controls.",
    sort_order: 102,
    prompts: [
      "Safety|All personnel wear the required PPE.",
      "Safety|Safety harnesses are used for work above 1.80 m.",
      "Safety|The work area is properly barricaded and access is controlled.",
      "Safety|Nearby structures and existing services are adequately protected.",
      "Safety|Electrical and mechanical hazards are identified and controlled.",
      "Before concrete casting|Anchor type, diameter, grade, embedment depth and projection match the approved documents.",
      "Before concrete casting|Anchor locations are verified.",
      "Before concrete casting|Alignment, spacing and projection are verified.",
      "Before concrete casting|Embedment depth is verified.",
      "Before concrete casting|Anchor type and grade are verified.",
      "Before concrete casting|Templates are securely fixed.",
      "Before concrete casting|Anchors are rigidly secured.",
      "Before concrete casting|Threads are protected.",
      "Before concrete casting|Required concrete cover is maintained.",
      "Before concrete casting|Engineer inspection is completed before pouring.",
      "Concrete casting|Anchors remain securely fixed during concrete placement.",
      "Concrete casting|No movement or rotation occurs during vibration.",
      "Concrete casting|Anchor threads remain protected from concrete contamination.",
      "Concrete casting|Concrete is placed without disturbing anchor positions.",
      "Concrete casting|Vibrators do not contact anchors or templates.",
      "Concrete casting|No segregation is observed around anchor assemblies.",
    ],
  },
  {
    code: "LIB-103",
    module: "inspection" as const,
    category: "Anchors / Ankers",
    name: "Cast-in anchors · after concrete casting",
    description: "CODECO project checklist for post-casting anchor inspection and records.",
    sort_order: 103,
    prompts: [
      "Safety|All personnel wear the required PPE.",
      "Safety|Safety harnesses are used for work above 1.80 m.",
      "Safety|The work area is properly barricaded and access is controlled.",
      "Safety|Nearby structures and existing services are adequately protected.",
      "Safety|Electrical and mechanical hazards are identified and controlled.",
      "After concrete casting|Anchor type, diameter, grade, embedment depth and projection match the approved documents.",
      "After concrete casting|The required curing period is complete before templates are removed or loads are applied.",
      "After concrete casting|Anchor positions are verified after formwork removal.",
      "After concrete casting|Projection height is within the specified tolerance.",
      "After concrete casting|Anchor verticality is verified.",
      "After concrete casting|Threads are clean and free from concrete contamination.",
      "After concrete casting|No honeycombing, voids or cracks are present around anchors.",
      "After concrete casting|Concrete cover complies with the approved drawings.",
      "After concrete casting|Corrosion protection is intact where applicable.",
      "After concrete casting|Inspection records are complete and approved.",
    ],
  },
] as const;

export const anchorChecklistCodes = anchorChecklistLibrary.map((item) => item.code);

export function legacyAnchorPrompts(code: string) {
  const checklist = anchorChecklistLibrary.find((item) => item.code === code);
  if (!checklist) return null;
  return checklist.prompts.map((entry) => {
    const [section, ...promptParts] = entry.split("|");
    const prompt = promptParts.join("|").replace(/^\[AUTO_WEATHER\]\s*/, "");
    return `${section} — ${prompt}`;
  });
}
