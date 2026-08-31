const UNIDADES = [
  "cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiún", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];

const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function baseWords(n: number): string {
  if (n < 30) return UNIDADES[n];
  if (n < 100) {
    const u = n % 10;
    const d = Math.floor(n / 10);
    if (u === 0) return DECENAS[d];
    return `${DECENAS[d]} y ${UNIDADES[u]}`;
  }
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (r === 0) return CENTENAS[c];
  return `${CENTENAS[c]} ${baseWords(r)}`;
}

function words(n: number): string {
  if (n < 1000) return baseWords(n);
  if (n < 1_000_000) {
    const t = Math.floor(n / 1000);
    const r = n % 1000;
    const prefix = t === 1 ? "mil" : `${words(t)} mil`;
    return r === 0 ? prefix : `${prefix} ${words(r)}`;
  }
  if (n < 1_000_000_000_000) {
    const m = Math.floor(n / 1_000_000);
    const r = n % 1_000_000;
    const prefix = m === 1 ? "un millón" : `${words(m)} millones`;
    return r === 0 ? prefix : `${prefix} ${words(r)}`;
  }
  if (n < 1_000_000_000_000_000) {
    const b = Math.floor(n / 1_000_000_000_000);
    const r = n % 1_000_000_000_000;
    const prefix = b === 1 ? "un billón" : `${words(b)} billones`;
    return r === 0 ? prefix : `${prefix} ${words(r)}`;
  }
  return String(n);
}

const CURRENCY_NAMES: Record<string, { singular: string; plural: string }> = {
  CLP: { singular: "peso", plural: "pesos" },
  UF: { singular: "uf", plural: "uf" },
  USD: { singular: "dólar", plural: "dólares" },
  EUR: { singular: "euro", plural: "euros" },
};

export function amountInWords(amount: number | null, currency: string | null): string {
  if (!amount || amount <= 0) return "";
  const integer = Math.floor(amount);
  const code = (currency || "CLP").toUpperCase();
  const name = CURRENCY_NAMES[code] || { singular: code.toLowerCase(), plural: code.toLowerCase() };
  const noun = integer === 1 ? name.singular : name.plural;
  const w = words(integer);
  const de = integer >= 1_000_000 && integer % 1_000_000 === 0 && code !== "UF" ? " de" : "";
  return `${w}${de} ${noun}`;
}
