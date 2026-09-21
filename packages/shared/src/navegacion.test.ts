import { describe, it, expect } from 'vitest';
import {
  esRutaNavegable, permisoDeRuta, resolverPantallaInicio,
  normalizarFavoritos, normalizarPantallaInicio, MAX_FAVORITOS,
} from './navegacion.js';

describe('navegacion — allowlist', () => {
  it('reconoce rutas navegables y rechaza desconocidas', () => {
    expect(esRutaNavegable('/pos')).toBe(true);
    expect(esRutaNavegable('/dashboard')).toBe(true);
    expect(esRutaNavegable('/ruta-inventada')).toBe(false);
  });

  it('mapea el permiso de una ruta', () => {
    expect(permisoDeRuta('/dashboard')).toBe('dashboard.ver');
    expect(permisoDeRuta('/pos')).toBeUndefined();
  });
});

describe('navegacion — resolverPantallaInicio', () => {
  const todo = () => true;
  it('usa la pantalla configurada si es navegable y hay permiso', () => {
    expect(resolverPantallaInicio('OPERADOR', '/stock', todo)).toBe('/stock');
  });
  it('cae al default por rol si no hay pantalla configurada', () => {
    expect(resolverPantallaInicio('SUPERVISOR', null, todo)).toBe('/dashboard');
    expect(resolverPantallaInicio('OPERADOR', null, todo)).toBe('/pos');
  });
  it('cae a /productos si el default por rol no tiene permiso', () => {
    const sinDashboard = (c: string) => c !== 'dashboard.ver';
    expect(resolverPantallaInicio('SUPERVISOR', null, sinDashboard)).toBe('/productos');
  });
  it('ignora una pantalla configurada sin permiso y cae al default por rol', () => {
    const sinDashboard = (c: string) => c !== 'dashboard.ver';
    expect(resolverPantallaInicio('OPERADOR', '/dashboard', sinDashboard)).toBe('/pos');
  });
  it('cae a /productos con un rol desconocido y sin pantalla', () => {
    expect(resolverPantallaInicio('OTRO', null, todo)).toBe('/productos');
  });
  it('cae al piso /productos cuando ni la pantalla ni el default por rol tienen permiso', () => {
    // Supervisor sin dashboard.ver: la pantalla configurada (/dashboard) y el default por
    // rol (/dashboard) requieren ese permiso, así que cae al piso incondicional /productos.
    const nada = () => false;
    expect(resolverPantallaInicio('SUPERVISOR', '/dashboard', nada)).toBe('/productos');
  });
});

describe('navegacion — normalizarFavoritos', () => {
  it('dedup y preserva orden', () => {
    expect(normalizarFavoritos(['/pos', '/stock', '/pos'])).toEqual(['/pos', '/stock']);
  });
  it('acepta array vacío', () => {
    expect(normalizarFavoritos([])).toEqual([]);
  });
  it('rechaza no-array', () => {
    expect(() => normalizarFavoritos('x' as unknown)).toThrow('FAVORITOS_INVALIDOS');
  });
  it('rechaza rutas fuera de la allowlist', () => {
    expect(() => normalizarFavoritos(['/pos', '/hack'])).toThrow('FAVORITOS_INVALIDOS');
  });
  it('rechaza por encima del tope', () => {
    const muchas = ['/pos','/stock','/caja','/productos','/clientes','/credito','/dashboard','/reportes/ventas','/etiquetas'];
    expect(muchas.length).toBeGreaterThan(MAX_FAVORITOS);
    expect(() => normalizarFavoritos(muchas)).toThrow('FAVORITOS_LIMITE');
  });
  it('acepta exactamente MAX_FAVORITOS', () => {
    const justas = ['/pos','/stock','/caja','/productos','/clientes','/credito','/dashboard','/reportes/ventas'];
    expect(justas.length).toBe(MAX_FAVORITOS);
    expect(normalizarFavoritos(justas)).toEqual(justas);
  });
});

describe('navegacion — normalizarPantallaInicio', () => {
  it('acepta null y undefined como null', () => {
    expect(normalizarPantallaInicio(null)).toBeNull();
    expect(normalizarPantallaInicio(undefined)).toBeNull();
  });
  it('acepta una ruta navegable', () => {
    expect(normalizarPantallaInicio('/pos')).toBe('/pos');
  });
  it('rechaza una ruta desconocida', () => {
    expect(() => normalizarPantallaInicio('/hack')).toThrow('PANTALLA_INICIO_INVALIDA');
  });
});
