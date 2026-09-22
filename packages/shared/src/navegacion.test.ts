import { describe, it, expect } from 'vitest';
import { crearNavegacion, MAX_FAVORITOS } from './navegacion.js';

const nav = crearNavegacion({
  rutas: [
    { path: '/pos' }, { path: '/stock', permiso: 'stock.entrada' },
    { path: '/dashboard', permiso: 'dashboard.ver' }, { path: '/productos', permiso: 'producto.consultar' },
  ],
  inicioPorRol: { SUPERVISOR: '/dashboard', OPERADOR: '/pos' },
  inicioFallback: '/productos',
});
const todo = () => true;
const sinDashboard = (c: string) => c !== 'dashboard.ver';

describe('crearNavegacion', () => {
  it('esRutaNavegable / permisoDeRuta', () => {
    expect(nav.esRutaNavegable('/pos')).toBe(true);
    expect(nav.esRutaNavegable('/ruta-inventada')).toBe(false);
    expect(nav.permisoDeRuta('/dashboard')).toBe('dashboard.ver');
  });
  it('resolverPantallaInicio', () => {
    expect(nav.resolverPantallaInicio('OPERADOR', '/stock', todo)).toBe('/stock');
    expect(nav.resolverPantallaInicio('SUPERVISOR', null, todo)).toBe('/dashboard');
    expect(nav.resolverPantallaInicio('SUPERVISOR', null, sinDashboard)).toBe('/productos');
    expect(nav.resolverPantallaInicio('OPERADOR', '/dashboard', sinDashboard)).toBe('/pos');
    expect(nav.resolverPantallaInicio('OTRO', null, todo)).toBe('/productos');
  });
  it('normalizarFavoritos', () => {
    expect(nav.normalizarFavoritos(['/pos', '/stock', '/pos'])).toEqual(['/pos', '/stock']);
    expect(() => nav.normalizarFavoritos('x')).toThrow('FAVORITOS_INVALIDOS');
    expect(() => nav.normalizarFavoritos(['/pos', '/hack'])).toThrow('FAVORITOS_INVALIDOS');
    const muchas = Array.from({ length: MAX_FAVORITOS + 1 }, (_, i) => `/r${i}`);
    const navMuchas = crearNavegacion({ rutas: muchas.map(path => ({ path })), inicioPorRol: {}, inicioFallback: '/r0' });
    expect(() => navMuchas.normalizarFavoritos(muchas)).toThrow('FAVORITOS_LIMITE');
  });
  it('normalizarPantallaInicio', () => {
    expect(nav.normalizarPantallaInicio(null)).toBeNull();
    expect(nav.normalizarPantallaInicio('/pos')).toBe('/pos');
    expect(() => nav.normalizarPantallaInicio('/hack')).toThrow('PANTALLA_INICIO_INVALIDA');
  });
  it('expone rutas e inicioFallback', () => {
    expect(nav.rutas).toHaveLength(4);
    expect(nav.inicioFallback).toBe('/productos');
  });
});
