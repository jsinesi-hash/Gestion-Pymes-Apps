export interface NotasVersion {
  titulo: string;
  notas: string[];
}

/**
 * Changelog bundled: viaja dentro de la app y se muestra al reabrir tras actualizar.
 * La clave DEBE coincidir exactamente con `app.getVersion()` del build (ver package.json).
 * Al preparar un release nuevo, agregar acá la entrada de esa versión.
 */
export const CHANGELOG: Record<string, NotasVersion> = {
  '1.1.1': {
    titulo: 'Novedades de la versión 1.1.1',
    notas: [
      'Nueva pantalla de Roles y permisos (matriz de consulta).',
      'Modo Oscuro con mejor contraste y legibilidad.',
      'Nuevas tipografías y set ampliado de fuentes.',
      'Costos de proveedor: matcheo global y sugerencias al importar.',
      'Exportación disponible en más listados.',
      'Detalle de lote integrado al hub de precios.',
      'Corrección del acceso directo al finalizar la instalación.',
    ],
  },
  '1.1.0': {
    titulo: 'Novedades de la versión 1.1.0',
    notas: [
      'Remitos: emisión, conformación y anulación de remitos de entrega.',
      'Presupuestos: creación, emisión y conversión a venta.',
      'Agenda y avisos operativos.',
      'Búsqueda mejorada: coincidencia por similitud, sinónimos y sustitutos.',
      'Personalización de apariencia: temas, acentos y modos de la app.',
      'Pantalla de inicio con favoritos y navegación renovada.',
      'Mejoras de carga de productos, costos de proveedor y localización.',
      'Aviso de actualización al iniciar sesión como Supervisor.',
    ],
  },
};

export function obtenerNotas(version: string): NotasVersion | null {
  return CHANGELOG[version] ?? null;
}
