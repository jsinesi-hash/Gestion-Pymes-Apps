import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb } from './helpers';
import { generateId } from '@ferreteria/shared';
import * as schema from '../../db/schema';
import { construirComandoCierre } from '../caja-cierre-aviso';

function resumenBase(over = {}) {
  return {
    caja_id: 'c1', monto_inicial: 5000,
    por_forma_pago: [{ forma_pago: 'efectivo', ingresado: 20000, cantidad_operaciones: 8 }],
    esperado_efectivo: 25000, ventas_count: 8, total_ventas: 20000, ...over,
  };
}
const cajaRow = { id: 'c1', usuario_id: 'u1', fecha_apertura: new Date('2026-07-22T09:00:00'), fecha_cierre: new Date('2026-07-22T18:00:00') } as any;

// Siembra categoria + 3 productos con existencias (dos bajo minimo, uno en stock 0).
function sembrarBajoMinimo(db: ReturnType<typeof setupDb>) {
  const now = new Date();
  const catId = generateId();
  db.insert(schema.categoria).values({ id: catId, nombre: 'Test', usuario_creacion_id: 'u1', fecha_creacion: now, origin_id: 't', updated_at: now } as any).run();
  let seq = 1;
  for (const [nombre, fisico, minimo] of [['Tornillo', 0, 10], ['Tuerca', 3, 12], ['Martillo', 50, 5]] as const) {
    const pid = generateId();
    db.insert(schema.producto).values({ id: pid, sku: `SKU-${nombre}`, sku_secuencial: seq++, nombre_corto: nombre, nombre_largo: nombre, unidad_venta: 'u', categoria_id: catId, usuario_creacion_id: 'u1', fecha_creacion: now, origin_id: 't', updated_at: now } as any).run();
    db.insert(schema.existencias).values({ id: generateId(), producto_id: pid, stock_fisico: fisico, stock_minimo: minimo, origin_id: 't', updated_at: now } as any).run();
  }
}

describe('construirComandoCierre', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); });

  it('severidad normal cuando |diferencia| <= umbral (centavos)', () => {
    const cmd = construirComandoCierre(db, { cajaRow, resumen: resumenBase(), diferencia: -10, monto_contado: 24990, usuarioCierreId: 'u1', now: new Date() });
    expect(cmd.severidad).toBe('normal');
    expect(cmd.origen_tipo).toBe('cierre_caja');
    expect(cmd.origen_id).toBe('c1');
    expect(cmd.dedupe_clave).toBe('cierre_caja:c1');
    expect(cmd.canales).toEqual(['in_app', 'email']);
  });

  it('severidad alerta cuando |diferencia| supera el umbral ($2.000 = 200000c)', () => {
    const cmd = construirComandoCierre(db, { cajaRow, resumen: resumenBase(), diferencia: -3000, monto_contado: 22000, usuarioCierreId: 'u1', now: new Date() });
    expect(cmd.severidad).toBe('alerta');
    expect(cmd.titulo.toLowerCase()).toContain('descuadre');
  });

  it('destinatario default = rol supervisor', () => {
    const cmd = construirComandoCierre(db, { cajaRow, resumen: resumenBase(), diferencia: 0, monto_contado: 25000, usuarioCierreId: 'u1', now: new Date() });
    expect(cmd.destinatario).toEqual({ tipo: 'rol', rol: 'supervisor' });
  });

  it('respeta notif_cierre_destinatario si apunta a un usuario', () => {
    db.update(schema.parametros_sistema).set({ valor: '{"tipo":"usuario","id":"abc"}' }).where(eq(schema.parametros_sistema.clave, 'notif_cierre_destinatario')).run();
    const cmd = construirComandoCierre(db, { cajaRow, resumen: resumenBase(), diferencia: 0, monto_contado: 25000, usuarioCierreId: 'u1', now: new Date() });
    expect(cmd.destinatario).toEqual({ tipo: 'usuario', id: 'abc' });
  });

  it('incluye bajo_minimo (top por faltante, incluye stock 0) en datos', () => {
    sembrarBajoMinimo(db);
    const cmd = construirComandoCierre(db, { cajaRow, resumen: resumenBase(), diferencia: 0, monto_contado: 25000, usuarioCierreId: 'u1', now: new Date() });
    const datos = cmd.datos as any;
    expect(datos.bajo_minimo.total).toBe(2);
    expect(datos.bajo_minimo.top[0].nombre_corto).toBe('Tornillo'); // faltante 10 > Tuerca 9
    expect(datos.bajo_minimo.top.map((p: any) => p.nombre_corto)).not.toContain('Martillo');
    // payload snapshot completo
    expect(datos.efectivo_contado).toBe(25000);
    expect(datos.efectivo_esperado).toBe(25000);
    expect(datos.fondo_inicial).toBe(5000);
    expect(datos.desglose_por_medio_pago[0].forma_pago).toBe('efectivo');
  });
});
