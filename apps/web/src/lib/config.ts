/**
 * Configuración central de la aplicación.
 * Cambia los valores aquí para afectar toda la app.
 */

export const APP_CONFIG = {
  /** Cantidad de registros por página en todas las grillas */
  pagination: {
    defaultPageSize: 100,
    /** Opciones disponibles en el selector de page size */
    pageSizeOptions: [25, 50, 100, 150, 200],
  },
} as const;
