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
  '1.2.0': {
    titulo: 'Novedades de la versión 1.2.0',
    notas: [
      'Roles y permisos editables: el Supervisor decide qué puede hacer cada rol, y los cambios se mantienen al actualizar.',
      'Las autorizaciones en el momento (anular, cambiar precio, cerrar caja con diferencia, vender sobre el límite) las da quien tenga ese permiso.',
      'El Operador puede ver y recibir órdenes de compra.',
      'Recuperación de contraseña por mail con código de un solo uso; la contraseña vence cada 30 días.',
      'Más seguridad al ingresar: bloqueo temporal tras varios intentos fallidos, que se levanta si el Supervisor restablece la clave.',
      'Registro de errores del sistema visible para el Supervisor en Backup, y backups firmados para detectar archivos alterados.',
      'El ticket lista todos los medios de pago de la venta.',
      'Ventanas más consistentes: se cierran con Escape y se pueden operar con el teclado.',
    ],
  },
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
