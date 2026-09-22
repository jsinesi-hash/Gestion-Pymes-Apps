import { describe, it, expect } from 'vitest';
import { crearNavegacion, MAX_FAVORITOS } from './navegacion.js';

// Fixture equivalente a la vieja allowlist global de Retail (RUTAS_NAVEGABLES/INICIO_POR_ROL/
// INICIO_FALLBACK), ahora pasada como config a la fábrica en vez de vivir como constantes de
// módulo. Los casos son los mismos de antes de la parametrización (Elaborados E1 / Task A1).
const nav = crearNavegacion({
  rutas: [
    { path: '/pos' }, { path: '/stock', permiso: 'stock.entrada' },
    { path: '/dashboard', permiso: 'dashboard.ver' }, { path: '/productos', permiso: 'producto.consultar' },
  ],
  inicioPorRol: { SUPERVISOR: '/dashboard', OPERADOR: '/pos' },
  inicioFallback: '/productos',
});

describe('crearNavegacion — allowlist', () => {
  it('reconoce rutas navegables y rechaza desconocidas', () => {
    expect(nav.esRutaNavegable('/pos')).toBe(true);
    expect(nav.esRutaNavegable('/dashboard')).toBe(true);
    expect(nav.esRutaNavegable('/ruta-inventada')).toBe(false);
  });

  it('mapea el permiso de una ruta', () => {
    expect(nav.permisoDeRuta('/dashboard')).toBe('dashboard.ver');
    expect(nav.permisoDeRuta('/pos')).toBeUndefined();
  });
});

describe('crearNavegacion — resolverPantallaInicio', () => {
  const todo = () => true;
  it('usa la pantalla configurada si es navegable y hay permiso', () => {
    expect(nav.resolverPantallaInicio('OPERADOR', '/stock', todo)).toBe('/stock');
  });
  it('cae al default por rol si no hay pantalla configurada', () => {
    expect(nav.resolverPantallaInicio('SUPERVISOR', null, todo)).toBe('/dashboard');
    expect(nav.resolverPantallaInicio('OPERADOR', null, todo)).toBe('/pos');
  });
  it('cae a /productos si el default por rol no tiene permiso', () => {
    const sinDashboard = (c: string) => c !== 'dashboard.ver';
    expect(nav.resolverPantallaInicio('SUPERVISOR', null, sinDashboard)).toBe('/productos');
  });
  it('ignora una pantalla configurada sin permiso y cae al default por rol', () => {
    const sinDashboard = (c: string) => c !== 'dashboard.ver';
    expect(nav.resolverPantallaInicio('OPERADOR', '/dashboard', sinDashboard)).toBe('/pos');
  });
  it('cae a /productos con un rol desconocido y sin pantalla', () => {
    expect(nav.resolverPantallaInicio('OTRO', null, todo)).toBe('/productos');
  });
  it('cae al piso /productos cuando ni la pantalla ni el default por rol tienen permiso', () => {
    // Supervisor sin dashboard.ver: la pantalla configurada (/dashboard) y el default por
    // rol (/dashboard) requieren ese permiso, así que cae al piso incondicional /productos.
    const nada = () => false;
    expect(nav.resolverPantallaInicio('SUPERVISOR', '/dashboard', nada)).toBe('/productos');
  });
});

describe('crearNavegacion — normalizarFavoritos', () => {
  it('dedup y preserva orden', () => {
    expect(nav.normalizarFavoritos(['/pos', '/stock', '/pos'])).toEqual(['/pos', '/stock']);
  });
  it('acepta array vacío', () => {
    expect(nav.normalizarFavoritos([])).toEqual([]);
  });
  it('rechaza no-array', () => {
    expect(() => nav.normalizarFavoritos('x' as unknown)).toThrow('FAVORITOS_INVALIDOS');
  });
  it('rechaza rutas fuera de la allowlist', () => {
    expect(() => nav.normalizarFavoritos(['/pos', '/hack'])).toThrow('FAVORITOS_INVALIDOS');
  });
  it('rechaza por encima del tope', () => {
    // El fixture `nav` de arriba solo tiene 4 rutas; para probar el tope hace falta una
    // config con más de MAX_FAVORITOS rutas navegables.
    const muchas = Array.from({ length: MAX_FAVORITOS + 1 }, (_, i) => `/r${i}`);
    const navMuchas = crearNavegacion({ rutas: muchas.map(path => ({ path })), inicioPorRol: {}, inicioFallback: '/r0' });
    expect(muchas.length).toBeGreaterThan(MAX_FAVORITOS);
    expect(() => navMuchas.normalizarFavoritos(muchas)).toThrow('FAVORITOS_LIMITE');
  });
  it('acepta exactamente MAX_FAVORITOS', () => {
    const justas = Array.from({ length: MAX_FAVORITOS }, (_, i) => `/r${i}`);
    const navJustas = crearNavegacion({ rutas: justas.map(path => ({ path })), inicioPorRol: {}, inicioFallback: '/r0' });
    expect(justas.length).toBe(MAX_FAVORITOS);
    expect(navJustas.normalizarFavoritos(justas)).toEqual(justas);
  });
});

describe('crearNavegacion — normalizarPantallaInicio', () => {
  it('acepta null y undefined como null', () => {
    expect(nav.normalizarPantallaInicio(null)).toBeNull();
    expect(nav.normalizarPantallaInicio(undefined)).toBeNull();
  });
  it('acepta una ruta navegable', () => {
    expect(nav.normalizarPantallaInicio('/pos')).toBe('/pos');
  });
  it('rechaza una ruta desconocida', () => {
    expect(() => nav.normalizarPantallaInicio('/hack')).toThrow('PANTALLA_INICIO_INVALIDA');
  });
});

describe('crearNavegacion — config expuesta', () => {
  it('expone rutas e inicioFallback', () => {
    expect(nav.rutas).toHaveLength(4);
    expect(nav.inicioFallback).toBe('/productos');
  });
});
