/** Bounded arithmetic grammar. Never executes user text as JavaScript. */
export function calculateExpression(source) {
  if (typeof source !== "string" || source.length > 4096) throw new Error("Berekening is te lang.");
  if (/[\d.,]\s+[\d.,]/.test(source)) throw new Error("Ongeldige spatie in een getal.");
  const compact = source.replace(/\s/g, "").replace(/,/g, ".");
  const tokens = compact.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/]/g) ?? [];
  if (!compact || tokens.join("") !== compact) throw new Error("Ongeldig teken in berekening.");
  let index = 0;
  let depth = 0;
  const finite = (number) => {
    if (!Number.isFinite(number)) throw new Error("Uitkomst is te groot of ongeldig.");
    return number;
  };
  const factor = () => {
    if (++depth > 64) throw new Error("Te veel geneste haakjes of tekens.");
    try {
      const token = tokens[index++];
      if (token === "+" || token === "-") return finite((token === "-" ? -1 : 1) * factor());
      if (token === "(") {
        const number = expression();
        if (tokens[index++] !== ")") throw new Error("Ontbrekend sluithaakje.");
        return number;
      }
      if (!token || !/^(?:\d|\.)/.test(token)) throw new Error("Ongeldige berekening.");
      return finite(Number(token));
    } finally { depth -= 1; }
  };
  const term = () => {
    let number = factor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = factor();
      if (operator === "/" && right === 0) throw new Error("Delen door nul is niet toegestaan.");
      number = finite(operator === "*" ? number * right : number / right);
    }
    return number;
  };
  const expression = () => {
    let number = term();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = term();
      number = finite(operator === "+" ? number + right : number - right);
    }
    return number;
  };
  const result = expression();
  if (index !== tokens.length) throw new Error("Ongeldige berekening.");
  return result;
}
