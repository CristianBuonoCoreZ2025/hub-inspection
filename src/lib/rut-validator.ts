/**
 * Validador de RUT chileno con dígito verificador.
 * Formato aceptado: 12345678-9, 12.345.678-9, 123456789
 */

export function validateRut(rut: string): boolean {
  if (!rut || rut.trim() === "") return true; // vacío = válido (opcional)

  // Limpiar: quitar puntos y espacios, mantener guion
  const cleaned = rut.replace(/\./g, "").replace(/\s/g, "").toUpperCase();

  // Validar formato básico
  const match = cleaned.match(/^([0-9]+)-([0-9K])$/);
  if (!match) return false;

  const body = match[1];
  const dv = match[2];

  if (body.length < 7) return false;

  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body.charAt(i), 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const computedDv =
    remainder === 0 ? "0" : remainder === 1 ? "K" : String(11 - remainder);

  return dv === computedDv;
}

export function formatRut(rut: string): string {
  if (!rut) return "";
  const cleaned = rut.replace(/\./g, "").replace(/-/g, "").replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 2) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Formatear con puntos
  let formatted = "";
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    if (count === 3) {
      formatted = "." + formatted;
      count = 0;
    }
    formatted = body.charAt(i) + formatted;
    count++;
  }

  return `${formatted}-${dv}`;
}
