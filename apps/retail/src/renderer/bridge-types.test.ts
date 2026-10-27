import { describe, it, expect } from 'vitest';
import { bridge } from '@core/ui';
import './bridge-types';

// Revisión 2026-10-20 (P1): el tipo de `bridge()` en Retail = catálogo universal + `canalesRetail`.
// Las líneas `@ts-expect-error` se verifican en COMPILACIÓN (`tsc --noEmit`): si `bridge()` volviera
// a ser `any`, dejarían de ser errores y el typecheck fallaría.
export function _verificacionDeTipos(): void {
  // universales (core)
  void bridge().auth.whoami();
  void bridge().caja.abrir({ monto_inicial: 0 });
  // propios de Retail (preload de la app)
  void bridge().precios.lista.list();
  void bridge().catalogo.movimientoStock.list({ producto_id: 'p' });

  // `venta.confirmar` y `venta.anular` tienen payload tipado (VentaConfirmarPayload / VentaAnularPayload)
  // @ts-expect-error — payload incompleto
  void bridge().venta.confirmar({});
  // @ts-expect-error — falta el motivo y las credenciales de Supervisor
  void bridge().venta.anular({ venta_id: 'v' });
  void bridge().venta.anular({ venta_id: 'v', motivo: 'm', supervisor_credenciales: { nombre_usuario: 'u', password: 'p' } });

  // @ts-expect-error — namespace inexistente
  void bridge().namespaceInexistente.algo();
  // @ts-expect-error — método inexistente en un namespace de la app
  void bridge().venta.metodoInexistente();
  // @ts-expect-error — `movimientoStock.create` se eliminó en ADR-117
  void bridge().catalogo.movimientoStock.create({});
}

describe('bridge-types (Retail)', () => {
  it('el módulo de tipos se importa sin efectos en ejecución', () => {
    expect(typeof bridge).toBe('function');
  });
});
