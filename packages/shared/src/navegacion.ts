// ADR-080 (PERF-1): allowlist de rutas que pueden ser pantalla de inicio o favorito, y
// funciones puras de resolución/validación. Vive en shared porque la consumen tanto el
// main (validación en el borde de preferencias:save) como el renderer (InicioRedirect y
// sidebar). Sin dependencias: TypeScript puro.

export type RutaNavegable = { path: string; permiso?: string };

// Cada `permiso` debe existir en PERMISOS (packages/client/src/main/auth/seed.ts).
export const RUTAS_NAVEGABLES: readonly RutaNavegable[] = [
  { path: '/pos' },
  { path: '/presupuestos', permiso: 'presupuesto.crear' },
  { path: '/remitos', permiso: 'remito.crear' },
  { path: '/caja', permiso: 'caja.operar' },
  { path: '/productos', permiso: 'producto.consultar' },
  { path: '/stock', permiso: 'stock.entrada' },
  { path: '/etiquetas' },
  { path: '/compras/proveedores', permiso: 'proveedor.gestionar' },
  { path: '/compras/ordenes', permiso: 'compra.recibir' },
  { path: '/clientes', permiso: 'ctacte.cobrar' },
  { path: '/credito', permiso: 'ctacte.cobrar' },
  { path: '/dashboard', permiso: 'dashboard.ver' },
  { path: '/reportes/ventas', permiso: 'dashboard.ver' },
];

const PATHS = new Set(RUTAS_NAVEGABLES.map((r) => r.path));

export function esRutaNavegable(path: string): boolean {
  return PATHS.has(path);
}

export function permisoDeRuta(path: string): string | undefined {
  return RUTAS_NAVEGABLES.find((r) => r.path === path)?.permiso;
}

export const INICIO_POR_ROL: Record<string, string> = {
  SUPERVISOR: '/dashboard',
  OPERADOR: '/pos',
};
export const INICIO_FALLBACK = '/productos';
export const MAX_FAVORITOS = 8;

/** Decide a dónde mandar la ruta índice cuando el flag está encendido. Pura. */
export function resolverPantallaInicio(
  rolNombre: string,
  pantallaInicio: string | null | undefined,
  tienePermiso: (codigo: string) => boolean,
): string {
  const permitida = (p: string): boolean => {
    if (!esRutaNavegable(p)) return false;
    const perm = permisoDeRuta(p);
    return !perm || tienePermiso(perm);
  };
  if (pantallaInicio && permitida(pantallaInicio)) return pantallaInicio;
  const porRol = INICIO_POR_ROL[rolNombre];
  if (porRol && permitida(porRol)) return porRol;
  // Piso incondicional: /productos no tiene guard de permiso a nivel de ruta (todos lo
  // abren), así que es el último recurso aunque su entrada en la allowlist declare permiso.
  return INICIO_FALLBACK;
}

/** Valida/normaliza la lista de favoritos que llega al handler. */
export function normalizarFavoritos(input: unknown): string[] {
  if (!Array.isArray(input)) throw new Error('FAVORITOS_INVALIDOS');
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== 'string' || !esRutaNavegable(v)) throw new Error('FAVORITOS_INVALIDOS');
    if (!out.includes(v)) out.push(v);
  }
  if (out.length > MAX_FAVORITOS) throw new Error('FAVORITOS_LIMITE');
  return out;
}

/** Valida/normaliza la pantalla de inicio que llega al handler. */
export function normalizarPantallaInicio(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'string' || !esRutaNavegable(input)) {
    throw new Error('PANTALLA_INICIO_INVALIDA');
  }
  return input;
}
