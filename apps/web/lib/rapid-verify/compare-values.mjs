/**
 * Rapid Verify compares a submitted specification with the prescribed one. Counting shared words
 * (the coverage percentage) cannot tell 12 mm from 13 mm, so the figures with a unit and the
 * colour words are compared on their own. The result only says where the two texts disagree; a
 * person still decides what it means.
 */
const units = ["mm2", "mm²", "cm2", "cm²", "m2", "m²", "m3", "m³", "mpa", "kpa", "kn", "mm", "cm", "kg", "bar", "ltr", "m", "l", "%", "°c"];
const quantity = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${units.map((unit) => unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![a-z0-9²³])`, "gi");
const unitAlias = { "mm²": "mm2", "cm²": "cm2", "m²": "m2", "m³": "m3", ltr: "l", "°c": "c" };

/** Colours the client's specifications use, English and Dutch, mapped to one name. */
const colours = {
  grey: "grey", gray: "grey", grijs: "grey", white: "white", wit: "white", black: "black", zwart: "black",
  red: "red", rood: "red", blue: "blue", blauw: "blue", green: "green", groen: "green", yellow: "yellow", geel: "yellow",
  brown: "brown", bruin: "brown", silver: "silver", zilver: "silver", bronze: "bronze", brons: "bronze", beige: "beige",
  orange: "orange", oranje: "orange", clear: "clear", helder: "clear", transparent: "clear", transparant: "clear",
};

const plain = (value) => value.toLowerCase().normalize("NFC");

export function quantitiesIn(value) {
  const found = [];
  for (const match of plain(value).matchAll(quantity)) {
    const unit = unitAlias[match[2]] ?? match[2];
    const number = Number(match[1].replace(",", "."));
    if (Number.isFinite(number)) found.push({ number, unit });
  }
  return found;
}

export function coloursIn(value) {
  return [...new Set(plain(value).split(/[^a-zà-ÿ]+/).map((word) => colours[word]).filter(Boolean))];
}

const show = (number, unit) => `${String(number).replace(".", ",")} ${unit === "c" ? "°C" : unit}`;

/**
 * @param {string} submitted the specification as delivered
 * @param {string} prescribed the passages of the project sources that matched it
 * @returns {Array<{ kind: "value" | "colour", status: "matches" | "differs" | "not_found", submitted: string, prescribed: string[] }>}
 */
export function compareSpecificationValues(submitted, prescribed) {
  const wanted = quantitiesIn(prescribed);
  const rows = [];
  const seen = new Set();
  for (const { number, unit } of quantitiesIn(submitted)) {
    const key = `${number} ${unit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const sameUnit = [...new Set(wanted.filter((item) => item.unit === unit).map((item) => item.number))];
    const status = sameUnit.includes(number) ? "matches" : sameUnit.length ? "differs" : "not_found";
    rows.push({ kind: "value", status, submitted: show(number, unit), prescribed: sameUnit.map((item) => show(item, unit)) });
  }
  const submittedColours = coloursIn(submitted);
  const prescribedColours = coloursIn(prescribed);
  for (const colour of submittedColours) {
    const status = prescribedColours.includes(colour) ? "matches" : prescribedColours.length ? "differs" : "not_found";
    rows.push({ kind: "colour", status, submitted: colour, prescribed: prescribedColours });
  }
  return rows;
}
