import "server-only";

/**
 * Helper para validar que campos inmutables no hayan sido alterados.
 *
 * Compara los valores enviados por el cliente con los valores actuales en BD.
 * Si un campo marcado como inmutable difiere, lanza error.
 *
 * Esto previene que un usuario manipule el DOM (DevTools) para
 * habilitar campos deshabilitados y modificar valores que no debería.
 */

/**
 * Valida que los campos inmutables del input coincidan con los de la BD.
 *
 * @param current  Registro actual de la BD (antes de update).
 * @param input    Datos enviados por el cliente.
 * @param immutableFields  Lista de campos que no pueden cambiar en un update.
 *
 * @throws Error si algún campo inmutable fue alterado.
 */
export function validateImmutableFields<T extends Record<string, unknown>>(
  current: T,
  input: Partial<T>,
  immutableFields: (keyof T)[]
): void {
  const violations: string[] = [];

  for (const field of immutableFields) {
    if (field in input) {
      const currentValue = current[field];
      const inputValue = input[field];

      // Normalizar null/undefined/vacío para comparación
      const normalize = (v: unknown) => {
        if (v === null || v === undefined || v === "") return null;
        return v;
      };

      if (normalize(currentValue) !== normalize(inputValue)) {
        violations.push(String(field));
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `No se pueden modificar campos inmutables: ${violations.join(", ")}`
    );
  }
}

/**
 * Filtra el input para dejar SOLO los campos permitidos en un update.
 * Esto previene que el cliente envíe campos que no debería poder actualizar
 * (incluso si no son inmutables sino simplemente no permitidos para esa operación).
 *
 * @param input  Datos enviados por el cliente.
 * @param allowedFields  Campos que SÍ se permiten actualizar.
 */
export function filterAllowedFields<T extends Record<string, unknown>>(
  input: Partial<T>,
  allowedFields: (keyof T)[]
): Partial<T> {
  const filtered: Partial<T> = {};
  for (const field of allowedFields) {
    if (field in input) {
      filtered[field] = input[field];
    }
  }
  return filtered;
}
