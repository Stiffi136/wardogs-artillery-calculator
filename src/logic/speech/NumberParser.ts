const units: Record<string, number> = {
  null: 0,
  eins: 1,
  ein: 1,
  eine: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
  zwanzig: 20,
  dreißig: 30,
  vierzig: 40,
  fünfzig: 50,
  sechzig: 60,
  siebzig: 70,
  achtzig: 80,
  neunzig: 90,
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function wordNumber(word: string): number | undefined {
  const clean = word.toLowerCase().replace(/[.,!?]/g, "");
  if (clean in units) return units[clean];
  if (clean.includes("hundert")) {
    const [prefix, suffix] = clean.split("hundert");
    return (
      (prefix ? (units[prefix] ?? 1) : 1) * 100 +
      (suffix ? (wordNumber(suffix) ?? 0) : 0)
    );
  }
  const match = clean.match(
    /^(ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)und(zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig)$/,
  );
  return match ? units[match[1]] + units[match[2]] : undefined;
}

/** Parses spoken German and English numeric forms; adjacent single digits stay separate coordinates. */
export function parseNumbers(text: string): number[] {
  const normalized = text
    .toLowerCase()
    // Whisper can render two spoken numbers as a hyphenated pair ("10-20").
    // Only split a hyphen between digits, preserving negative values ("-10").
    .replace(/(\d)-(\d)/g, "$1 $2")
    // Whisper may use commas for both decimal separators and a short pause:
    // "62,43,63,23" or "20,3, 27,8" represents two coordinates.
    .replace(/\b(\d+),(\d+),\s*(\d+),(\d+)\b/g, "$1.$2 $3.$4")
    // Keep written decimal commas (for example "82,9") as part of one number.
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/,/g, " ")
    .replace(/[;:!?]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const values: number[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const numeric = Number(token.replace(",", "."));
    if (token !== "" && Number.isFinite(numeric)) {
      values.push(numeric);
      continue;
    }
    const parsed = wordNumber(token);
    if (parsed !== undefined) {
      if (
        (tokens[index + 1] === "komma" ||
          tokens[index + 1] === "punkt" ||
          tokens[index + 1] === "point") &&
        tokens[index + 2]
      ) {
        const decimalToken = tokens[index + 2];
        const decimal = /^\d+$/.test(decimalToken)
          ? decimalToken
          : String(wordNumber(decimalToken) ?? "");
        if (decimal) {
          values.push(Number(`${parsed}.${decimal}`));
          index += 2;
          continue;
        }
      }
      if (
        /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)$/.test(
          token,
        ) &&
        /^(one|two|three|four|five|six|seven|eight|nine)$/.test(
          tokens[index + 1] ?? "",
        )
      ) {
        values.push(parsed + (wordNumber(tokens[index + 1]) ?? 0));
        index += 1;
        continue;
      }
      values.push(parsed);
    }
  }
  return values;
}
