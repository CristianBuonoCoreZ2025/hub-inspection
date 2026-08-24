/**
 * Validación y formateo de RUT chileno.
 * El RUT consta de un número y un dígito verificador separados por guión.
 * Ejemplo válido: 12.345.678-9, 12345678-9, 12345678K
 */

/**
 * Valida un RUT chileno usando el algoritmo de módulo 11.
 * Acepta formatos con o sin puntos, con o sin guión.
 */
export function validateRut(rut: string): boolean {
  if (!rut) return false;

  // Limpiar: quitar puntos, espacios, guión, convertir a mayúscula
  const clean = rut.replace(/[.\s-]/g, "").toUpperCase();
  if (clean.length < 2) return false;

  // Separar cuerpo y dígito verificador
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // El cuerpo debe ser numérico
  if (!/^\d+$/.test(body)) return false;

  // Calcular dígito verificador esperado
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const mod11 = 11 - (sum % 11);
  let expectedDv: string;
  if (mod11 === 11) expectedDv = "0";
  else if (mod11 === 10) expectedDv = "K";
  else expectedDv = mod11.toString();

  return dv === expectedDv;
}

/**
 * Formatea un RUT al formato chileno estándar: 12.345.678-9
 */
export function formatRut(rut: string): string {
  if (!rut) return "";
  const clean = rut.replace(/[.\s-]/g, "").toUpperCase();
  if (clean.length < 2) return rut;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // Agregar puntos al cuerpo
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

/**
 * Determina si un país usa RUT (Chile) o tax_id genérico.
 */
export function isRutCountry(countryName: string): boolean {
  return countryName.toLowerCase() === "chile";
}

/**
 * Extrae el cuerpo numérico de un RUT (sin dígito verificador).
 * Ej: "12.345.678-9" → 12345678
 */
export function rutBodyNumber(rut: string): number | null {
  if (!rut) return null;
  const clean = rut.replace(/[.\s-]/g, "").toUpperCase();
  if (clean.length < 2) return null;
  const body = clean.slice(0, -1);
  if (!/^\d+$/.test(body)) return null;
  return parseInt(body, 10);
}

/**
 * En Chile, las personas jurídicas regularmente tienen RUT >= 50.000.000.
 * Retorna 'legal' o 'natural' según el cuerpo del RUT.
 * Solo aplica para Chile; para otros países retorna null.
 */
export function guessPersonType(rut: string, countryName: string): "legal" | "natural" | null {
  if (!isRutCountry(countryName)) return null;
  const body = rutBodyNumber(rut);
  if (body === null) return null;
  return body >= 50_000_000 ? "legal" : "natural";
}
