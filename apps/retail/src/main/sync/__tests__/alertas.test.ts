import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, loginAsOperador, clearSession } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../../ipc/categoria';
import { productoCreateHandler } from '../../ipc/producto';
import { stockEntradaHandler } from '../../ipc/stock';
import { ventaConfirmarHandler } from '../../ipc/venta';
import { cajaAbrirHandler, cajaAddMovimientoHandler, cajaCerrarHandler, clienteUpsertHandler } from '@core/main';
import { dashboardCajaHandler } from '../../ipc/dashboard';
import { alertasDistribuido } from '../alertas';

// ADR-153 §4 y §5 (F2 PR5): en modo distribuido el stock consolidado puede quedar negativo y un cliente
// sobre su límite (ventas concurrentes de terminales sin conexión entre sí). La coordinadora lo detecta
// después del pull y avisa una sola vez por producto o cliente (y por día), a quien tiene el permiso
// para corregirlo. El POS no vende un producto con stock negativo.
type Db = ReturnType<typeof setupDb>;
const CF_ID = 'cf000000-0000-0000-0000-000000000001';

function producto(db: Db, nombre: string) {
  const cat = categoriaCreateHandler(db, { nombre: `Cat ${nombre}` });
  const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
  const p = productoCreateHandler(db, { nombre_corto: nombre, categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista_centavos: 100_000 });
  stockEntradaHandler(db, { producto_id: p.id, cantidad: 5 });
  return p;
}
/** El stock consolidado tras dos ventas concurrentes en terminales distintas (lo deja así la proyección). */
const fijarStock = (db: Db, productoId: string, stock: number) =>
  db.update(schema.existencias).set({ stock_fisico: stock }).where(eq(schema.existencias.producto_id, productoId)).run();

const avisos = (db: Db, origen: string) => db.select().from(schema.aviso).where(eq(schema.aviso.origen_tipo, origen)).all();
const usuarioDe = (db: Db, id: string) => db.select().from(schema.usuario).where(eq(schema.usuario.id, id)).get()!.nombre_usuario;
const cuentaDe = (id: string) => eq(schema.cuenta_corriente_cliente.cliente_id, id);

describe('alertas del modo distribuido', () => {
  let db: Db;
  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    loginAsOperador(db); // crea al operador
    clearSession();
    loginAsAdmin(db);
  });

  it('stock negativo: un aviso por producto a quien puede ajustar stock, sin repetir', async () => {
    const pinza = producto(db, 'Pinza');
    const martillo = producto(db, 'Martillo');
    fijarStock(db, pinza.id, -2);
    await alertasDistribuido(db);

    const filas = avisos(db, 'stock_negativo');
    // Admin y operador tienen `stock.ajustar`: uno a cada uno, solo por la pinza.
    expect(filas.map((a) => usuarioDe(db, a.destinatario_usuario_id!)).sort()).toEqual(['admin', 'operador1']);
    expect(filas.every((a) => a.origen_id === pinza.id && a.severidad === 'alerta' && a.canal === 'in_app')).toBe(true);
    expect(JSON.parse(filas[0]!.payload)).toMatchObject({ titulo: 'Stock negativo: Pinza', datos: { producto_id: pinza.id, stock: -2 } });

    await alertasDistribuido(db);
    expect(avisos(db, 'stock_negativo')).toHaveLength(2);
    expect(avisos(db, 'stock_negativo').some((a) => a.origen_id === martillo.id)).toBe(false);
  });

  it('un producto inactivo no avisa', async () => {
    const p = producto(db, 'Viejo');
    fijarStock(db, p.id, -1);
    db.update(schema.producto).set({ activo: false }).where(eq(schema.producto.id, p.id)).run();
    await alertasDistribuido(db);
    expect(avisos(db, 'stock_negativo')).toEqual([]);
  });

  it('cliente sobre el límite: un aviso a quien puede autorizar el exceso (no al operador)', async () => {
    const cli = clienteUpsertHandler(db, {
      tipo_documento: 'DNI', numero_documento: '30111222', nombre: 'Ana', apellido: 'Paz',
      condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: true,
    });
    const otro = clienteUpsertHandler(db, {
      tipo_documento: 'DNI', numero_documento: '30111223', nombre: 'Beto', apellido: 'Paz',
      condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: true,
    });
    db.update(schema.cuenta_corriente_cliente).set({ limite_credito_centavos: 10_000, saldo_centavos: 15_000 }).where(cuentaDe(cli.id)).run();
    // Sin límite (0) no hay exceso, aunque deba.
    db.update(schema.cuenta_corriente_cliente).set({ limite_credito_centavos: 0, saldo_centavos: 99_000 }).where(cuentaDe(otro.id)).run();
    await alertasDistribuido(db);
    await alertasDistribuido(db);

    const filas = avisos(db, 'ctacte_sobre_limite');
    expect(filas.map((a) => usuarioDe(db, a.destinatario_usuario_id!))).toEqual(['admin']);
    expect(filas[0]!.origen_id).toBe(cli.id);
    expect(JSON.parse(filas[0]!.payload)).toMatchObject({ titulo: 'Cliente sobre el límite de crédito: Ana Paz', datos: { saldo: 150, limite: 100 } });
  });

  it('el POS no vende un producto con stock negativo (ADR-153 §5)', () => {
    const p = producto(db, 'Pinza');
    fijarStock(db, p.id, -1);
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 0 });
    expect(() => ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CF_ID,
      lineas: [{ producto_id: p.id, descripcion: 'Pinza', cantidad: 1, precio_unitario_centavos: 100_000, descuento_linea: 0, alicuota_iva: 21, subtotal_centavos: 100_000 }],
      descuento_global: 0, subtotal_centavos: 100_000, importe_iva_centavos: 17_355, total_centavos: 100_000, ajuste_redondeo_centavos: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 100_000 }],
    })).toThrow('STOCK_INSUFICIENTE');
  });

  // F3 PR5 (ADR-155 §5): un movimiento de otra caja que llega después del cierre del turno compartido queda en
  // ese turno, avisa una sola vez a quien autoriza diferencias de caja y no recalcula la diferencia del arqueo.
  it('movimiento posterior al cierre: un aviso por novedad, sin tocar la diferencia, y el arqueo marcado', async () => {
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 10_000 });
    cajaAddMovimientoHandler(db, { caja_id: caja.id, tipo: 'ingreso', motivo: 'aporte', monto_centavos: 1_000 });
    cajaCerrarHandler(db, { caja_id: caja.id, monto_contado_centavos: 11_000 });
    await alertasDistribuido(db);
    expect(avisos(db, 'caja_movimiento_tardio')).toEqual([]); // un cierre normal no avisa
    expect(dashboardCajaHandler(db).arqueos_recientes[0]).toMatchObject({ caja_id: caja.id, posterior_al_cierre: false });

    // Llega por sync un aporte de otra caja hecho sin conexión ANTES del cierre (fecha anterior): igual es tardío.
    const cerrada = db.select().from(schema.caja).where(eq(schema.caja.id, caja.id)).get()!;
    const tardio = (id: string, fecha: Date, monto: number) => db.insert(schema.movimiento_caja).values({
      id, caja_id: caja.id, tipo: 'ingreso', motivo: 'aporte', monto_centavos: monto, forma_pago: 'efectivo',
      referencia_tipo: 'manual', referencia_id: id, usuario_id: cerrada.usuario_id, fecha, observaciones: null,
      version: 1, origin_id: 'C2', sync_state: 'synced', updated_at: fecha,
    }).run();
    tardio('mov-tardio-1', new Date(cerrada.fecha_cierre!.getTime() - 60_000), 2_500);
    await alertasDistribuido(db);
    const filas = avisos(db, 'caja_movimiento_tardio');
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((a) => a.origen_id === caja.id)).toBe(true);
    expect(filas.map((a) => usuarioDe(db, a.destinatario_usuario_id!))).toEqual(['admin']); // el operador no autoriza diferencias
    expect(JSON.parse(filas[0]!.payload)).toMatchObject({ datos: { caja_id: caja.id, esperado_cierre: 110, esperado_actual: 135 } });
    // La diferencia del arqueo no cambió sola.
    expect(db.select().from(schema.caja).where(eq(schema.caja.id, caja.id)).get()).toMatchObject({ monto_esperado_centavos: 11_000, diferencia_centavos: 0 });
    expect(dashboardCajaHandler(db).arqueos_recientes[0]).toMatchObject({ caja_id: caja.id, posterior_al_cierre: true });

    // Sin novedades, no repite; otro movimiento tardío vuelve a avisar.
    await alertasDistribuido(db);
    expect(avisos(db, 'caja_movimiento_tardio')).toHaveLength(filas.length);
    tardio('mov-tardio-2', new Date(Date.now() + 1000), 500);
    await alertasDistribuido(db);
    expect(avisos(db, 'caja_movimiento_tardio')).toHaveLength(filas.length * 2);
  });
});
