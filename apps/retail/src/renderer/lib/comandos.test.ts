import { filtrarPorTexto } from './comandos';
// Task B4: los comandos concretos de Retail se mudaron a shell/comandosRetail.ts.
import { COMANDOS_ACCION, COMANDOS_NAV } from '../shell/comandosRetail';

it('acciones y navegación exponen ruta y permiso', () => {
  expect(COMANDOS_ACCION.find(a => a.label === 'Nuevo producto')?.to).toBe('/productos/nuevo');
  expect(COMANDOS_ACCION.find(a => a.label === 'Nuevo producto')?.permiso).toBe('producto.crear');
  expect(COMANDOS_NAV.length).toBeGreaterThan(3);
  expect(COMANDOS_NAV.every(c => typeof c.to === 'string')).toBe(true);
});

it('filtrarPorTexto es acento-insensible y case-insensible', () => {
  const r = filtrarPorTexto([{ label: 'Cañería' }, { label: 'Tornillo' }], 'caneria');
  expect(r).toHaveLength(1);
  expect(r[0].label).toBe('Cañería');
});

it('filtrarPorTexto con texto vacío devuelve todo', () => {
  const items = [{ label: 'A' }, { label: 'B' }];
  expect(filtrarPorTexto(items, '')).toHaveLength(2);
});
