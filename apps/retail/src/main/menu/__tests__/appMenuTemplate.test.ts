import { describe, it, expect, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { buildMenuTemplate, type MenuAccion } from '../appMenuTemplate';

const TODOS = new Set<string>([
  'venta.crear', 'import.masiva', 'backup.crear', 'caja.operar',
  'producto.consultar', 'stock.entrada', 'compra.recibir', 'ctacte.cobrar',
]);
const OPERADOR = new Set<string>([
  'venta.crear', 'caja.operar', 'producto.consultar', 'stock.entrada',
  'compra.recibir', 'ctacte.cobrar',
]);

function submenu(tpl: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions[] {
  const top = tpl.find(t => t.label === label);
  return (top?.submenu as MenuItemConstructorOptions[]) ?? [];
}
function labels(items: MenuItemConstructorOptions[]): string[] {
  return items.filter(i => i.type !== 'separator').map(i => String(i.label));
}

const base = { autenticado: true, isDev: false, onAccion: () => {}, onAyuda: () => {} };

describe('buildMenuTemplate', () => {
  it('incluye los 5 menús (con Operación) para un usuario con permisos', () => {
    const tpl = buildMenuTemplate({ ...base, permisos: TODOS });
    expect(tpl.map(t => t.label)).toEqual(['Archivo', 'Editar', 'Ver', 'Operación', 'Ayuda']);
  });

  it('Ayuda incluye "Manual de usuario" que dispara onAyuda("guia")', () => {
    const onAyuda = vi.fn<(a: 'atajos' | 'acerca' | 'guia') => void>();
    const ayuda = submenu(buildMenuTemplate({ ...base, permisos: TODOS, onAyuda }), 'Ayuda');
    const manual = ayuda.find(i => i.label === 'Manual de usuario');
    expect(manual).toBeTruthy();
    (manual?.click as () => void)();
    expect(onAyuda).toHaveBeenCalledWith('guia');
  });

  it('oculta ítems de Supervisor cuando el rol no los tiene (Operador)', () => {
    const tpl = buildMenuTemplate({ ...base, permisos: OPERADOR });
    const archivo = labels(submenu(tpl, 'Archivo'));
    expect(archivo).not.toContain('Importar datos…');
    expect(archivo).not.toContain('Copia de seguridad…');
    expect(archivo).toContain('Nueva venta');
    expect(archivo).toContain('Salir');
  });

  it('muestra los ítems de Supervisor cuando el rol los tiene', () => {
    const archivo = labels(submenu(buildMenuTemplate({ ...base, permisos: TODOS }), 'Archivo'));
    expect(archivo).toContain('Importar datos…');
    expect(archivo).toContain('Copia de seguridad…');
  });

  it('omite el menú Operación si no hay ningún ítem visible (sin sesión)', () => {
    const tpl = buildMenuTemplate({ ...base, autenticado: false, permisos: new Set() });
    expect(tpl.map(t => t.label)).not.toContain('Operación');
  });

  it('oculta "Cerrar sesión" cuando no está autenticado', () => {
    const tpl = buildMenuTemplate({ ...base, autenticado: false, permisos: new Set() });
    expect(labels(submenu(tpl, 'Archivo'))).not.toContain('Cerrar sesión');
  });

  it('agrega DevTools solo en modo desarrollo', () => {
    const prod = labels(submenu(buildMenuTemplate({ ...base, permisos: TODOS, isDev: false }), 'Ver'));
    const dev  = labels(submenu(buildMenuTemplate({ ...base, permisos: TODOS, isDev: true  }), 'Ver'));
    expect(prod).not.toContain('Herramientas de desarrollo');
    expect(dev).toContain('Herramientas de desarrollo');
  });

  it('no deja separadores al inicio, al final ni consecutivos', () => {
    const archivo = submenu(buildMenuTemplate({ ...base, permisos: OPERADOR }), 'Archivo');
    expect(archivo[0]?.type).not.toBe('separator');
    expect(archivo[archivo.length - 1]?.type).not.toBe('separator');
    for (let i = 1; i < archivo.length; i++) {
      expect(archivo[i].type === 'separator' && archivo[i - 1].type === 'separator').toBe(false);
    }
  });

  it('el click de un ítem dispara onAccion con la acción correcta', () => {
    const onAccion = vi.fn<(a: MenuAccion) => void>();
    const oper = submenu(buildMenuTemplate({ ...base, permisos: TODOS, onAccion }), 'Operación');
    const abrir = oper.find(i => i.label === 'Abrir caja');
    (abrir?.click as () => void)();
    expect(onAccion).toHaveBeenCalledWith('abrir-caja');
  });
});
