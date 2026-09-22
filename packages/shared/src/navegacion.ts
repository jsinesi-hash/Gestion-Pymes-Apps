// ADR-080 (PERF-1) + Elaborados E1: mecánica pura de pantalla de inicio/favoritos. Las RUTAS son
// configuración de cada app (apps/<app>/src/common/navegacion.ts); acá solo vive la lógica.
export type RutaNavegable = { path: string; permiso?: string };
export type ConfigNavegacion = {
  rutas: readonly RutaNavegable[];
  inicioPorRol: Readonly<Record<string, string>>;
  inicioFallback: string;
};
export type Navegacion = {
  readonly rutas: readonly RutaNavegable[];
  readonly inicioFallback: string;
  esRutaNavegable(path: string): boolean;
  permisoDeRuta(path: string): string | undefined;
  resolverPantallaInicio(rolNombre: string, pantallaInicio: string | null | undefined,
    tienePermiso: (codigo: string) => boolean): string;
  normalizarFavoritos(input: unknown): string[];
  normalizarPantallaInicio(input: unknown): string | null;
};
export const MAX_FAVORITOS = 8;

export function crearNavegacion(cfg: ConfigNavegacion): Navegacion {
  const paths = new Set(cfg.rutas.map(r => r.path));
  const esRutaNavegable = (p: string) => paths.has(p);
  const permisoDeRuta = (p: string) => cfg.rutas.find(r => r.path === p)?.permiso;
  return {
    rutas: cfg.rutas,
    inicioFallback: cfg.inicioFallback,
    esRutaNavegable,
    permisoDeRuta,
    resolverPantallaInicio(rolNombre, pantallaInicio, tienePermiso) {
      const permitida = (p: string) => {
        if (!esRutaNavegable(p)) return false;
        const perm = permisoDeRuta(p);
        return !perm || tienePermiso(perm);
      };
      if (pantallaInicio && permitida(pantallaInicio)) return pantallaInicio;
      const porRol = cfg.inicioPorRol[rolNombre];
      if (porRol && permitida(porRol)) return porRol;
      return cfg.inicioFallback;
    },
    normalizarFavoritos(input) {
      if (!Array.isArray(input)) throw new Error('FAVORITOS_INVALIDOS');
      const out: string[] = [];
      for (const v of input) {
        if (typeof v !== 'string' || !esRutaNavegable(v)) throw new Error('FAVORITOS_INVALIDOS');
        if (!out.includes(v)) out.push(v);
      }
      if (out.length > MAX_FAVORITOS) throw new Error('FAVORITOS_LIMITE');
      return out;
    },
    normalizarPantallaInicio(input) {
      if (input === null || input === undefined) return null;
      if (typeof input !== 'string' || !esRutaNavegable(input)) throw new Error('PANTALLA_INICIO_INVALIDA');
      return input;
    },
  };
}
