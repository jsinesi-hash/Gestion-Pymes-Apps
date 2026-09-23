import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler } from '../stock';
import { cajaAbrirHandler, cajaCerrarHandler } from '../caja';
import {
  ventaConfirmarHandler,
  ventaAnularHandler,
  ventaListByCajaHandler,
  ventaGetHandler,
  type VentaConfirmarPayload,
  type VentaPagoPayload,
} from '../venta';
import { hashPassword } from '@core/main';
import { loginHandler } from '@core/main';
import {
  presupuestoCrearHandler, presupuestoEmitirHandler, presupuestoAnularHandler,
} from '../presupuesto';
import { listaPrecioCreateHandler } from '../lista-precio';
import { proveedorUpsertHandler } from '../proveedor';
import { productoProveedorUpsertHandler, productoProveedorSetPreferidoHandler } from '../producto-proveedor';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';

describe('venta handlers', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
  });

  function crearProductoConStock(stock = 10, precio = 1000) {
    const session = loginAsAdmin(db);
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto)
      .where(eq(schema.impuesto.predeterminado, true)).get()!;
    const prod = productoCreateHandler(db, {
      nombre_corto: 'Tornillo M6',
      categoria_id: cat.id,
      impuesto_id: imp.id,
      unidad_venta: 'u',
      precio_venta_lista: precio,
    });
    stockEntradaHandler(db, { producto_id: prod.id, cantidad: stock });
    return { prod, imp, session };
  }

  function abrirCaja() {
    return cajaAbrirHandler(db, { monto_inicial: 0 });
  }

  function makePayload(
    cajaId: string,
    prodId: string,
    cantidad = 1,
    precio = 1000,
    pagos?: VentaPagoPayload[],
  ): VentaConfirmarPayload {
    const total = precio * cantidad;
    return {
      caja_id: cajaId,
      cliente_id: CF_ID,
      lineas: [{
        producto_id: prodId,
        descripcion: 'Tornillo M6',
        cantidad,
        precio_unitario: precio,
        descuento_linea: 0,
        alicuota_iva: 21,
        subtotal: total,
      }],
      descuento_global: 0,
      subtotal: total,
      importe_iva: Math.round(total * 21 / 121 * 100) / 100,
      total,
      ajuste_redondeo: 0,
      pagos: pagos ?? [{ medio_pago: 'efectivo', monto_centavos: Math.round(total * 100) }],
    };
  }

  // ── ventaConfirmarHandler ────────────────────────────────────────────────

  describe('ventaConfirmarHandler', () => {
    it('crea venta confirmada con todos los movimientos', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      const result = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

      expect(result.venta.estado).toBe('confirmada');
      expect(result.venta.numero_interno).toMatch(/^V-C1-\d{6}$/);
      expect(result.venta.total).toBe(1000);
      expect(result.detalles).toHaveLength(1);
      expect(result.comprobante.tipo).toBe('ticket_interno');
    });

    it('descuenta stock al confirmar', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 3));
      const ex = db.select().from(schema.existencias)
        .where(eq(schema.existencias.producto_id, prod.id)).get()!;
      expect(ex.stock_fisico).toBe(7);
    });

    it('crea movimiento_caja ingreso', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      ventaConfirmarHandler(db, makePayload(caja.id, prod.id));
      const movs = db.select().from(schema.movimiento_caja)
        .where(eq(schema.movimiento_caja.caja_id, caja.id)).all();
      expect(movs.some(m => m.tipo === 'ingreso' && m.motivo === 'venta')).toBe(true);
    });

    it('el correlativo incrementa por venta', () => {
      const { prod } = crearProductoConStock(20);
      const caja = abrirCaja();
      const r1 = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));
      const r2 = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));
      expect(r1.venta.numero_interno).toBe('V-C1-000001');
      expect(r2.venta.numero_interno).toBe('V-C1-000002');
    });

    it('lanza STOCK_INSUFICIENTE si cantidad > stock', () => {
      const { prod } = crearProductoConStock(2);
      const caja = abrirCaja();
      expect(() => ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 5)))
        .toThrow('STOCK_INSUFICIENTE');
    });

    it('lanza PRODUCTO_INACTIVO si producto está desactivado', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      db.update(schema.producto).set({ activo: false })
        .where(eq(schema.producto.id, prod.id)).run();
      expect(() => ventaConfirmarHandler(db, makePayload(caja.id, prod.id)))
        .toThrow('PRODUCTO_INACTIVO');
    });

    it('lanza CAJA_REQUERIDA si la caja no está abierta', () => {
      const { prod } = crearProductoConStock();
      expect(() => ventaConfirmarHandler(db, makePayload('caja-inexistente', prod.id)))
        .toThrow('CAJA_REQUERIDA');
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      clearSession();
      expect(() => ventaConfirmarHandler(db, makePayload('caja', 'prod')))
        .toThrow('UNAUTHENTICATED');
    });

    it('guarda ajuste_redondeo cuando el total no es peso entero', () => {
      const { prod } = crearProductoConStock(10, 999.50);
      const caja = abrirCaja();
      const payload = makePayload(caja.id, prod.id, 1, 999.50);
      payload.total = 1000;
      payload.ajuste_redondeo = 0.50;
      // El pago debe cubrir el total redondeado (100000 centavos)
      payload.pagos[0].monto_centavos = 100000;
      const r = ventaConfirmarHandler(db, payload);
      expect(r.venta.ajuste_redondeo).toBe(0.50);
      expect(r.venta.total).toBe(1000);
    });

    it('lanza MEDIO_PAGO_DUPLICADO si se repite un medio de pago', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      expect(() => ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'efectivo', monto_centavos: 60000 },
        { medio_pago: 'efectivo', monto_centavos: 40000 },
      ]))).toThrow('MEDIO_PAGO_DUPLICADO');
    });

    // ── Cuenta Corriente ─────────────────────────────────────────────────────

    function crearClienteConCCC(limiteCredito = 100_000, saldoInicial = 0) {
      const clienteId = generateId();
      const cuentaId = generateId();
      const now = new Date();
      const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
      const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
      db.insert(schema.cliente).values({
        id: clienteId, tipo_documento: 'DNI', numero_documento: '99999999',
        nombre: 'Cliente', apellido: 'CCC Test', condicion_fiscal: 'Consumidor Final',
        habilita_cuenta_corriente: true, activo: true,
        usuario_creacion_id: adminId, fecha_creacion: now, ...sync,
      }).run();
      db.insert(schema.cuenta_corriente_cliente).values({
        id: cuentaId, cliente_id: clienteId,
        saldo_centavos: saldoInicial, limite_credito_centavos: limiteCredito,
        activo: true, ...sync,
      }).run();
      return { clienteId, cuentaId };
    }

    it('pago CCC carga saldo en cuenta_corriente_cliente y crea movimiento', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const caja = abrirCaja();
      const { clienteId, cuentaId } = crearClienteConCCC(500_000);
      const payload = makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'cuenta_corriente', monto_centavos: 100_000 },
      ]);
      payload.cliente_id = clienteId;
      ventaConfirmarHandler(db, payload);

      const cuenta = db.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
      expect(cuenta.saldo_centavos).toBe(100_000);

      const movs = db.select().from(schema.movimiento_cuenta_corriente)
        .where(eq(schema.movimiento_cuenta_corriente.cuenta_id, cuentaId)).all();
      expect(movs).toHaveLength(1);
      expect(movs[0].tipo).toBe('cargo');
      expect(movs[0].motivo).toBe('venta_credito');
      expect(movs[0].monto_centavos).toBe(100_000);
      expect(movs[0].saldo_resultante_centavos).toBe(100_000);
    });

    it('pago CCC NO genera movimiento_caja', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const caja = abrirCaja();
      const { clienteId } = crearClienteConCCC(500_000);
      const payload = makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'cuenta_corriente', monto_centavos: 100_000 },
      ]);
      payload.cliente_id = clienteId;
      ventaConfirmarHandler(db, payload);

      const movsCaja = db.select().from(schema.movimiento_caja)
        .where(and(eq(schema.movimiento_caja.caja_id, caja.id), eq(schema.movimiento_caja.motivo, 'venta'))).all();
      expect(movsCaja).toHaveLength(0);
    });

    it('pago CCC sobre limite lanza LIMITE_CREDITO_EXCEDIDO sin credenciales supervisor', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const caja = abrirCaja();
      const { clienteId } = crearClienteConCCC(50_000); // límite $500
      const payload = makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'cuenta_corriente', monto_centavos: 100_000 }, // $1000 > $500
      ]);
      payload.cliente_id = clienteId;
      expect(() => ventaConfirmarHandler(db, payload)).toThrow('LIMITE_CREDITO_EXCEDIDO');
    });

    it('pago CCC sobre limite pasa con credenciales de Supervisor válidas', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const caja = abrirCaja();
      const { clienteId, cuentaId } = crearClienteConCCC(50_000);
      const payload = makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'cuenta_corriente', monto_centavos: 100_000 },
      ]);
      payload.cliente_id = clienteId;
      payload.supervisor_credenciales = { nombre_usuario: 'admin', password: 'admin1234' };
      ventaConfirmarHandler(db, payload);

      const cuenta = db.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
      expect(cuenta.saldo_centavos).toBe(100_000);
    });

    it('pago CCC sin limite configurado (limite=0) pasa siempre', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const caja = abrirCaja();
      const { clienteId, cuentaId } = crearClienteConCCC(0); // sin límite
      const payload = makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'cuenta_corriente', monto_centavos: 100_000 },
      ]);
      payload.cliente_id = clienteId;
      ventaConfirmarHandler(db, payload);

      const cuenta = db.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
      expect(cuenta.saldo_centavos).toBe(100_000);
    });
  });

  // ── ADR-049 §9: POS — re-resolución de precio y costo neto ────────────────

  describe('ventaConfirmarHandler — motor de precios v2', () => {
    it('lanza PRECIO_DESACTUALIZADO si el precio vigente cambió desde que se armó el carrito', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const lista = listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, predeterminada: true });
      // simula que el precio cambió (recálculo, importación, etc.) después de agregar al carrito
      db.update(schema.lista_precio_valor)
        .set({ precio_centavos: 150000 })
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, lista.id),
          eq(schema.lista_precio_valor.producto_id, prod.id),
        )).run();

      const caja = abrirCaja();
      expect(() => ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000)))
        .toThrow('PRECIO_DESACTUALIZADO');
    });

    it('acepta el precio desactualizado con credenciales de Supervisor (override)', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const lista = listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, predeterminada: true });
      db.update(schema.lista_precio_valor)
        .set({ precio_centavos: 150000 })
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, lista.id),
          eq(schema.lista_precio_valor.producto_id, prod.id),
        )).run();

      const caja = abrirCaja();
      const payload = makePayload(caja.id, prod.id, 1, 1000);
      payload.supervisor_credenciales = { nombre_usuario: 'admin', password: 'admin1234' };
      const result = ventaConfirmarHandler(db, payload);
      expect(result.venta.estado).toBe('confirmada');
    });

    it('sin lista predeterminada configurada, no valida precio (comportamiento actual)', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const caja = abrirCaja();
      const result = ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000));
      expect(result.venta.estado).toBe('confirmada');
    });

    it('guarda costo_unitario = costo neto del proveedor preferido en el movimiento de stock', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const prov = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20111111112',
        razon_social: 'Proveedor Test', condicion_fiscal: 'Responsable Inscripto',
      });
      const pp = productoProveedorUpsertHandler(db, {
        producto_id: prod.id, proveedor_id: prov.id, costo_centavos: 50000,
      });
      productoProveedorSetPreferidoHandler(db, pp.id);

      const caja = abrirCaja();
      ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000));

      const mov = db.select().from(schema.movimiento_stock)
        .where(and(
          eq(schema.movimiento_stock.producto_id, prod.id),
          eq(schema.movimiento_stock.motivo, 'venta'),
        )).get()!;
      expect(mov.costo_unitario).toBe(500); // 50000 centavos / 100, sin bonif/flete/cost.fin.
    });

    it('sin proveedor preferido, costo_unitario sigue siendo null (comportamiento actual)', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const caja = abrirCaja();
      ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000));
      const mov = db.select().from(schema.movimiento_stock)
        .where(and(
          eq(schema.movimiento_stock.producto_id, prod.id),
          eq(schema.movimiento_stock.motivo, 'venta'),
        )).get()!;
      expect(mov.costo_unitario).toBeNull();
    });
  });

  // ── ventaAnularHandler ───────────────────────────────────────────────────

  describe('ventaAnularHandler', () => {
    function supervisorCreds() {
      return { nombre_usuario: 'admin', password: 'admin1234' };
    }

    function confirmarVenta(cajaId: string, prodId: string) {
      return ventaConfirmarHandler(db, makePayload(cajaId, prodId));
    }

    it('anula venta confirmada y revierte stock', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const { venta } = confirmarVenta(caja.id, prod.id);

      const exAntes = db.select().from(schema.existencias)
        .where(eq(schema.existencias.producto_id, prod.id)).get()!;
      expect(exAntes.stock_fisico).toBe(9);

      ventaAnularHandler(db, { venta_id: venta.id, motivo: 'Error de cobro', supervisor_credenciales: supervisorCreds() });

      const ventaAnulada = db.select().from(schema.venta).where(eq(schema.venta.id, venta.id)).get()!;
      expect(ventaAnulada.estado).toBe('anulada');

      const exDespues = db.select().from(schema.existencias)
        .where(eq(schema.existencias.producto_id, prod.id)).get()!;
      expect(exDespues.stock_fisico).toBe(10);
    });

    it('crea movimiento_caja egreso de ajuste en la caja', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const { venta } = confirmarVenta(caja.id, prod.id);

      ventaAnularHandler(db, { venta_id: venta.id, motivo: 'Test', supervisor_credenciales: supervisorCreds() });

      const movs = db.select().from(schema.movimiento_caja)
        .where(eq(schema.movimiento_caja.caja_id, caja.id)).all();
      const egreso = movs.find(m => m.tipo === 'egreso' && m.referencia_tipo === 'anulacion_venta');
      expect(egreso).toBeDefined();
      expect(egreso!.observaciones).toBe('Test');
    });

    it('lanza VENTA_YA_ANULADA al anular dos veces', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const { venta } = confirmarVenta(caja.id, prod.id);
      ventaAnularHandler(db, { venta_id: venta.id, motivo: 'Test', supervisor_credenciales: supervisorCreds() });
      expect(() => ventaAnularHandler(db, { venta_id: venta.id, motivo: 'Test', supervisor_credenciales: supervisorCreds() }))
        .toThrow('VENTA_YA_ANULADA');
    });

    it('lanza CAJA_ORIGEN_CERRADA si la caja de la venta está cerrada', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const { venta } = confirmarVenta(caja.id, prod.id);
      cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 1000 });
      abrirCaja();
      expect(() => ventaAnularHandler(db, { venta_id: venta.id, motivo: 'Test', supervisor_credenciales: supervisorCreds() }))
        .toThrow('CAJA_ORIGEN_CERRADA');
    });

    it('lanza SUPERVISOR_INVALIDO con credenciales incorrectas', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const { venta } = confirmarVenta(caja.id, prod.id);
      expect(() => ventaAnularHandler(db, {
        venta_id: venta.id, motivo: 'Test',
        supervisor_credenciales: { nombre_usuario: 'admin', password: 'wrong' },
      })).toThrow('SUPERVISOR_INVALIDO');
    });

    it('lanza MOTIVO_REQUERIDO si motivo está vacío', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const { venta } = confirmarVenta(caja.id, prod.id);
      expect(() => ventaAnularHandler(db, { venta_id: venta.id, motivo: '  ', supervisor_credenciales: supervisorCreds() }))
        .toThrow('MOTIVO_REQUERIDO');
    });

    it('anular venta CCC revierte saldo en cuenta_corriente_cliente', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const caja = abrirCaja();
      // Crear cliente con CCC (reutilizamos la helper del describe padre)
      const clienteId = generateId();
      const cuentaId = generateId();
      const now = new Date();
      const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
      const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
      db.insert(schema.cliente).values({
        id: clienteId, tipo_documento: 'DNI', numero_documento: '88888888',
        nombre: 'Cliente', apellido: 'Anular CCC', condicion_fiscal: 'Consumidor Final',
        habilita_cuenta_corriente: true, activo: true,
        usuario_creacion_id: adminId, fecha_creacion: now, ...sync,
      }).run();
      db.insert(schema.cuenta_corriente_cliente).values({
        id: cuentaId, cliente_id: clienteId,
        saldo_centavos: 0, limite_credito_centavos: 500_000,
        activo: true, ...sync,
      }).run();

      const payload = makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'cuenta_corriente', monto_centavos: 100_000 },
      ]);
      payload.cliente_id = clienteId;
      const { venta } = ventaConfirmarHandler(db, payload);

      const cuentaAntes = db.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
      expect(cuentaAntes.saldo_centavos).toBe(100_000);

      ventaAnularHandler(db, { venta_id: venta.id, motivo: 'Test CCC', supervisor_credenciales: supervisorCreds() });

      const cuentaDespues = db.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
      expect(cuentaDespues.saldo_centavos).toBe(0);

      const movs = db.select().from(schema.movimiento_cuenta_corriente)
        .where(eq(schema.movimiento_cuenta_corriente.cuenta_id, cuentaId)).all();
      expect(movs).toHaveLength(2); // cargo + reversa
      expect(movs.some(m => m.tipo === 'pago' && m.motivo === 'nota_credito')).toBe(true);
    });

    it('lanza FORBIDDEN sin permiso venta.anular', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const { venta } = confirmarVenta(caja.id, prod.id);

      clearSession();
      const opRol = db.select().from(schema.rol).where(eq(schema.rol.nombre, 'OPERADOR')).get()!;
      const opId = generateId();
      db.insert(schema.usuario).values({
        id: opId,
        nombre_usuario: 'operador_test',
        nombre_completo: 'Operador Test',
        hash_password: hashPassword('pass1234'),
        rol_id: opRol.id,
        activo: true,
        ultimo_acceso: null,
        usuario_creacion_id: 'system',
        fecha_creacion: new Date(),
        version: 1,
        origin_id: 'C1',
        sync_state: 'pending',
        updated_at: new Date(),
      }).run();
      loginHandler(db, { nombreUsuario: 'operador_test', password: 'pass1234' });

      expect(() => ventaAnularHandler(db, { venta_id: venta.id, motivo: 'Test', supervisor_credenciales: supervisorCreds() }))
        .toThrow('FORBIDDEN');
    });
  });

  // ── ventaListByCajaHandler ───────────────────────────────────────────────

  describe('ventaListByCajaHandler', () => {
    it('devuelve ventas de la caja ordenadas por fecha DESC (más reciente primero)', () => {
      const { prod } = crearProductoConStock(20);
      const caja = abrirCaja();
      const { venta: v1 } = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));
      const { venta: v2 } = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

      // Ensure distinct timestamps so DESC order is deterministic
      db.update(schema.venta).set({ fecha: new Date(Date.now() - 5000) })
        .where(eq(schema.venta.id, v1.id)).run();
      db.update(schema.venta).set({ fecha: new Date() })
        .where(eq(schema.venta.id, v2.id)).run();

      const ventas = ventaListByCajaHandler(db, { caja_id: caja.id });
      expect(ventas).toHaveLength(2);
      expect(ventas[0].numero_interno).toBe('V-C1-000002');
      expect(ventas[1].numero_interno).toBe('V-C1-000001');
    });

    it('no devuelve ventas de otra caja', () => {
      const { prod } = crearProductoConStock(20);
      const caja = abrirCaja();
      ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

      const ventas = ventaListByCajaHandler(db, { caja_id: 'otra-caja' });
      expect(ventas).toHaveLength(0);
    });

    it('incluye ventas anuladas', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const { venta } = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));
      ventaAnularHandler(db, { venta_id: venta.id, motivo: 'Test', supervisor_credenciales: { nombre_usuario: 'admin', password: 'admin1234' } });

      const ventas = ventaListByCajaHandler(db, { caja_id: caja.id });
      expect(ventas.some(v => v.estado === 'anulada')).toBe(true);
    });

    it('incluye el nombre completo del cliente cuando la venta tiene un cliente específico asociado', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const clienteId = generateId();
      const now = new Date();
      const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
      const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
      db.insert(schema.cliente).values({
        id: clienteId, tipo_documento: 'DNI', numero_documento: '55555555',
        nombre: 'Ana', apellido: 'García', condicion_fiscal: 'Consumidor Final',
        activo: true, usuario_creacion_id: adminId, fecha_creacion: now, ...sync,
      }).run();
      const payload = makePayload(caja.id, prod.id);
      payload.cliente_id = clienteId;
      ventaConfirmarHandler(db, payload);

      const ventas = ventaListByCajaHandler(db, { caja_id: caja.id });
      expect(ventas).toHaveLength(1);
      expect((ventas[0] as any).cliente_nombre).toBe('Ana García');
    });

    it('usa "Consumidor Final" cuando la venta no tiene un cliente específico asociado', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      // makePayload usa CF_ID (cliente fijo "Consumidor Final" sembrado) por defecto
      ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

      const ventas = ventaListByCajaHandler(db, { caja_id: caja.id });
      expect(ventas).toHaveLength(1);
      expect((ventas[0] as any).cliente_nombre).toBe('Consumidor Final');
    });
  });

  // ── ventaGetHandler ──────────────────────────────────────────────────────

  describe('ventaGetHandler', () => {
    it('devuelve venta con detalles y comprobante', () => {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      const { venta } = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

      const result = ventaGetHandler(db, { id: venta.id });
      expect(result).not.toBeNull();
      expect(result!.detalles).toHaveLength(1);
      expect(result!.comprobante).not.toBeNull();
    });

    it('devuelve null para id inexistente', () => {
      loginAsAdmin(db);
      expect(ventaGetHandler(db, { id: 'no-existe' })).toBeNull();
    });
  });

  describe('pagos múltiples', () => {
    it('pago único efectivo exacto → vuelto_centavos 0', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      const r = ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'efectivo', monto_centavos: 100000 },
      ]));
      expect(r.venta.estado).toBe('confirmada');
      expect(r.venta.vuelto_centavos ?? 0).toBe(0);
      const movs = db.select().from(schema.movimiento_caja)
        .where(and(eq(schema.movimiento_caja.caja_id, caja.id), eq(schema.movimiento_caja.motivo, 'venta'))).all();
      expect(movs).toHaveLength(1);
      expect(movs[0].monto).toBe(1000);
    });

    it('pago efectivo con exceso → vuelto_centavos correcto', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      const r = ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'efectivo', monto_centavos: 150000 },
      ]));
      expect(r.venta.vuelto_centavos).toBe(50000);
    });

    it('combinado efectivo + tarjeta con recargo → dos movimientos de caja', () => {
      const { prod } = crearProductoConStock(10, 1000);
      const caja = abrirCaja();
      const pagos: VentaPagoPayload[] = [
        { medio_pago: 'efectivo', monto_centavos: 50000 },
        { medio_pago: 'tarjeta', monto_centavos: 50000, recargo_pct: 10, recargo_centavos: 5000 },
      ];
      const r = ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000, pagos));
      expect(r.venta.estado).toBe('confirmada');
      const movs = db.select().from(schema.movimiento_caja)
        .where(and(eq(schema.movimiento_caja.caja_id, caja.id), eq(schema.movimiento_caja.motivo, 'venta'))).all();
      expect(movs).toHaveLength(2);
      expect(movs.some(m => m.forma_pago === 'efectivo' && m.monto === 500)).toBe(true);
      expect(movs.some(m => m.forma_pago === 'tarjeta' && m.monto === 550)).toBe(true);
    });

    it('pago con CCC no genera movimiento de caja', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      // CCC requiere un cliente con cuenta corriente activa
      const clienteId = generateId();
      const cuentaId = generateId();
      const now = new Date();
      const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
      const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
      db.insert(schema.cliente).values({
        id: clienteId, tipo_documento: 'DNI', numero_documento: '77777777',
        nombre: 'Cliente', apellido: 'CCC', condicion_fiscal: 'Consumidor Final',
        habilita_cuenta_corriente: true, activo: true,
        usuario_creacion_id: adminId, fecha_creacion: now, ...sync,
      }).run();
      db.insert(schema.cuenta_corriente_cliente).values({
        id: cuentaId, cliente_id: clienteId,
        saldo_centavos: 0, limite_credito_centavos: 0,
        activo: true, ...sync,
      }).run();
      const payload = makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'cuenta_corriente', monto_centavos: 100000 },
      ]);
      payload.cliente_id = clienteId;
      const r = ventaConfirmarHandler(db, payload);
      expect(r.venta.estado).toBe('confirmada');
      const movs = db.select().from(schema.movimiento_caja)
        .where(and(eq(schema.movimiento_caja.caja_id, caja.id), eq(schema.movimiento_caja.motivo, 'venta'))).all();
      expect(movs).toHaveLength(0);
    });

    it('lanza SALDO_PENDIENTE si pagos no cubren el total', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      expect(() => ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'efectivo', monto_centavos: 50000 },
      ]))).toThrow('SALDO_PENDIENTE');
    });

    it('crea N filas venta_pago', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      const pagos: VentaPagoPayload[] = [
        { medio_pago: 'efectivo', monto_centavos: 60000 },
        { medio_pago: 'tarjeta', monto_centavos: 40000 },
      ];
      const r = ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000, pagos));
      const pagoRows = db.select().from(schema.venta_pago)
        .where(eq(schema.venta_pago.venta_id, r.venta.id)).all();
      expect(pagoRows).toHaveLength(2);
    });

    it('recargo_centavos con decimal .5 → Math.round sube', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      // monto_centavos=100, recargo_pct=1.5 → 1.5 centavos → round → 2
      const pagos: VentaPagoPayload[] = [
        { medio_pago: 'efectivo', monto_centavos: 99900 },
        { medio_pago: 'tarjeta', monto_centavos: 100, recargo_pct: 1.5, recargo_centavos: 2 },
      ];
      const r = ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000, pagos));
      const rows = db.select().from(schema.venta_pago)
        .where(eq(schema.venta_pago.venta_id, r.venta.id)).all();
      expect(rows.find(p => p.medio_pago === 'tarjeta')?.recargo_centavos).toBe(2);
    });

    it('100% tarjeta → vuelto_centavos es 0', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      const r = ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000, [
        { medio_pago: 'tarjeta', monto_centavos: 100000 },
      ]));
      expect(r.venta.vuelto_centavos ?? 0).toBe(0);
    });
  });

  // ── ventaGetHandler ──────────────────────────────────────────────────────

  describe('ventaGetHandler', () => {
    it('retorna venta con detalles, comprobante y cliente', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      const confirmada = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

      const result = ventaGetHandler(db, { id: confirmada.venta.id });

      expect(result).not.toBeNull();
      expect(result!.venta.id).toBe(confirmada.venta.id);
      expect(result!.detalles).toHaveLength(1);
      expect(result!.comprobante?.tipo).toBe('ticket_interno');
      expect(result!.cliente).not.toBeNull();
      expect(result!.cliente!.nombre_completo).toBe('Consumidor Final');
    });

    it('retorna null para id inexistente', () => {
      loginAsAdmin(db);
      expect(ventaGetHandler(db, { id: 'no-existe' })).toBeNull();
    });
  });

  // ── ADR-046 §4: conversión de presupuesto a venta ────────────────────────
  describe('ventaConfirmarHandler con presupuesto_id', () => {
    function crearPresupuestoEmitido(prodId: string) {
      const p = presupuestoCrearHandler(db, { lineas: [{ producto_id: prodId, cantidad: 1 }] });
      return presupuestoEmitirHandler(db, { id: p.id });
    }

    it('marca el presupuesto como convertido y enlaza venta ↔ presupuesto', () => {
      const { prod } = crearProductoConStock();
      const presup = crearPresupuestoEmitido(prod.id);
      const caja = abrirCaja();

      const { venta } = ventaConfirmarHandler(db, { ...makePayload(caja.id, prod.id), presupuesto_id: presup.id });

      const presupRow = db.select().from(schema.presupuesto)
        .where(eq(schema.presupuesto.id, presup.id)).get()!;
      expect(presupRow.estado).toBe('convertido');
      expect(presupRow.venta_id).toBe(venta.id);

      const ventaRow = db.select().from(schema.venta)
        .where(eq(schema.venta.id, venta.id)).get()!;
      expect(ventaRow.presupuesto_id).toBe(presup.id);
    });

    it('hace rollback de la venta si el presupuesto ya no es convertible (anulado)', () => {
      const { prod } = crearProductoConStock();
      const presup = crearPresupuestoEmitido(prod.id);
      const caja = abrirCaja();
      // se anula antes de convertir → la conversión debe fallar y no crear venta
      presupuestoAnularHandler(db, { id: presup.id });

      expect(() => ventaConfirmarHandler(db, { ...makePayload(caja.id, prod.id), presupuesto_id: presup.id }))
        .toThrow(/NO_CONVERTIBLE/);

      const ventas = db.select().from(schema.venta).all();
      expect(ventas).toHaveLength(0);
    });
  });
});
