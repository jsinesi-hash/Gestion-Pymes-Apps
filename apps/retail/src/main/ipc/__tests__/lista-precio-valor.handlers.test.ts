import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and, isNull } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { listaPrecioCreateHandler } from '../lista-precio';
import { clienteUpsertHandler } from '@core/main';
import {
  getPrecioEnListaHandler,
  setManualHandler,
  listarVigentesParaProductoHandler,
  listarVigentesPorListaHandler,
  contarAfectadosHandler,
  recalcularMasivoHandler,
  type RecalcularMasivoParams,
} from '../lista-precio-valor';

type Db = ReturnType<typeof setupDb>;

/** Cierra todas las filas vigentes (fecha_hasta IS NULL) de una (lista, producto).
 * ADR-034: después del auto-seed en alta de producto/lista, los tests que insertan
 * directamente deben cerrar la fila auto-sembrada primero. */
function closeVigentes(db: Db, listaId: string, productoId: string) {
  db.update(schema.lista_precio_valor)
    .set({ fecha_hasta: new Date(), updated_at: new Date() })
    .where(and(
      eq(schema.lista_precio_valor.lista_precio_id, listaId),
      eq(schema.lista_precio_valor.producto_id, productoId),
      isNull(schema.lista_precio_valor.fecha_hasta),
    ))
    .run();
}

describe('lista-precio-valor handlers', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
  });

  function crearLista(nombre = 'General', ajuste = 0) {
    return listaPrecioCreateHandler(db, { nombre, ajuste_porcentual: ajuste, predeterminada: false });
  }

  function crearProducto(precio = 1000) {
    const cat = categoriaCreateHandler(db, { nombre: 'Cat-' + generateId().slice(0, 8) });
    const imp = db.select().from(schema.impuesto).all()[0];
    return productoCreateHandler(db, {
      nombre_corto: 'Prod',
      categoria_id: cat.id,
      impuesto_id: imp.id,
      unidad_venta: 'u',
      precio_venta_lista: precio,
    });
  }

  function seedListaYProducto() {
    const lista = crearLista('SeedLista-' + generateId().slice(0, 6), 0);
    const prod = crearProducto(1000);
    return { listaId: lista.id, productoId: prod.id };
  }

  function seedParaRecalculo() {
    const lista = crearLista('SeedRecalc-' + generateId().slice(0, 6), 0);
    const p1 = crearProducto(1000);
    const p2 = crearProducto(2000);
    return { listaId: lista.id, productoId: p1.id, p2Id: p2.id };
  }

  // ── getPrecioEnLista ─────────────────────────────────────────────────────────

  describe('getPrecioEnListaHandler', () => {
    it('fallback: calcula precio cuando no existe fila lista_precio_valor', () => {
      loginAsAdmin(db);
      const lista = crearLista('General', 10); // +10%
      const prod = crearProducto(1000);

      // ADR-034: auto-seed inserts a vigente row on product creation; close it to test fallback path
      closeVigentes(db, lista.id, prod.id);

      const result = getPrecioEnListaHandler(db, {
        productoId: prod.id,
        listaId: lista.id,
      });

      // fallback = round(1000 * 100 * (1 + 10/100)) = round(110000) = 110000
      expect(result.origen).toBe('fallback');
      expect(result.precio_centavos).toBe(110000);
    });

    // ── ADR-049 §9: Price List Resolver — lista por cliente ────────────────────

    it('con clienteId, resuelve contra la lista propia del cliente en vez de la predeterminada', () => {
      loginAsAdmin(db);
      const listaPredeterminada = crearLista('Predeterminada', 0);
      const listaEspecial = crearLista('Mayorista', -10); // −10%
      const prod = crearProducto(1000);
      closeVigentes(db, listaPredeterminada.id, prod.id);
      closeVigentes(db, listaEspecial.id, prod.id);

      const cliente = clienteUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20111111112',
        nombre: 'Cliente', apellido: 'Mayorista', condicion_fiscal: 'Responsable Inscripto',
      });
      db.update(schema.cliente).set({ lista_precio_id: listaEspecial.id })
        .where(eq(schema.cliente.id, cliente.id)).run();

      const result = getPrecioEnListaHandler(db, {
        productoId: prod.id,
        listaId: listaPredeterminada.id, // el caller sigue mandando la predeterminada...
        clienteId: cliente.id,           // ...pero el cliente tiene lista propia y gana
      });

      // fallback sobre listaEspecial = round(1000*100*(1-10/100)) = 90000
      expect(result.precio_centavos).toBe(90000);
    });

    it('sin lista propia del cliente, cae al listaId (predeterminada) sin cambios', () => {
      loginAsAdmin(db);
      const lista = crearLista('Predeterminada', 0);
      const prod = crearProducto(1000);
      closeVigentes(db, lista.id, prod.id);
      const cliente = clienteUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20222222223',
        nombre: 'Consumidor', apellido: 'Test', condicion_fiscal: 'Consumidor Final',
      });

      const result = getPrecioEnListaHandler(db, {
        productoId: prod.id, listaId: lista.id, clienteId: cliente.id,
      });
      expect(result.precio_centavos).toBe(100000);
    });

    it('vigente: devuelve fila con fecha_hasta IS NULL', () => {
      loginAsAdmin(db);
      const lista = crearLista('General', 0);
      const prod = crearProducto(1000);
      const now = new Date();

      // ADR-034: close auto-seeded vigente row before inserting test row
      closeVigentes(db, lista.id, prod.id);

      // Insert a vigente row directly
      db.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 95000,
        fecha_desde: now,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      const result = getPrecioEnListaHandler(db, {
        productoId: prod.id,
        listaId: lista.id,
      });

      expect(result.origen).toBe('vigente');
      expect(result.precio_centavos).toBe(95000);
    });

    it('promocion activa: tiene precedencia sobre vigente', () => {
      loginAsAdmin(db);
      const lista = crearLista('General', 0);
      const prod = crearProducto(1000);
      const now = new Date();
      const past = new Date(now.getTime() - 60000);
      const future = new Date(now.getTime() + 3600000);

      // ADR-034: close auto-seeded vigente row before inserting test row
      closeVigentes(db, lista.id, prod.id);

      // Insert a vigente row
      db.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 95000,
        fecha_desde: past,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      // Insert an active promotion
      db.insert(schema.promocion).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 80000,
        fecha_desde: past,
        fecha_hasta: future,
        descripcion: 'Promo test',
        activo: true,
        usuario_creacion_id: 'test-user',
        fecha_creacion: now,
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      const result = getPrecioEnListaHandler(db, {
        productoId: prod.id,
        listaId: lista.id,
      });

      expect(result.origen).toBe('promocion');
      expect(result.precio_centavos).toBe(80000);
    });

    it('ignora promocion expirada', () => {
      loginAsAdmin(db);
      const lista = crearLista('General', 0);
      const prod = crearProducto(1000);
      const now = new Date();
      const past = new Date(now.getTime() - 7200000);
      const pastEnd = new Date(now.getTime() - 3600000);

      // ADR-034: close auto-seeded vigente row before inserting test row
      closeVigentes(db, lista.id, prod.id);

      // Insert a vigente row
      db.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 95000,
        fecha_desde: past,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      // Insert an expired promotion
      db.insert(schema.promocion).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 80000,
        fecha_desde: past,
        fecha_hasta: pastEnd,
        descripcion: 'Promo expirada',
        activo: true,
        usuario_creacion_id: 'test-user',
        fecha_creacion: now,
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      const result = getPrecioEnListaHandler(db, {
        productoId: prod.id,
        listaId: lista.id,
      });

      // Should return vigente, not promocion
      expect(result.origen).toBe('vigente');
      expect(result.precio_centavos).toBe(95000);
    });
  });

  // ── setManual ────────────────────────────────────────────────────────────────

  describe('setManualHandler', () => {
    it('primer insert cuando no hay fila vigente previa', () => {
      loginAsAdmin(db);
      const { listaId, productoId } = seedListaYProducto();
      // ADR-034: auto-seed ya insertó una fila vigente; setManual la cierra e inserta la nueva
      setManualHandler(db, { listaId, productoId, precioCentavos: 8000 });
      const rows = db.select().from(schema.lista_precio_valor)
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, listaId),
          eq(schema.lista_precio_valor.producto_id, productoId),
          isNull(schema.lista_precio_valor.fecha_hasta),
        )).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].precio_centavos).toBe(8000);
      expect(rows[0].origen).toBe('manual');
    });

    it('cierra fila vigente anterior e inserta nueva fila SCD2', () => {
      loginAsAdmin(db);
      const lista = crearLista('General', 0);
      const prod = crearProducto(1000);
      const now = new Date();

      // ADR-034: close auto-seeded vigente row before inserting test's "previous vigente" row
      closeVigentes(db, lista.id, prod.id);

      // Insert a vigente row
      const vigenteId = generateId();
      db.insert(schema.lista_precio_valor).values({
        id: vigenteId,
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 90000,
        fecha_desde: new Date(now.getTime() - 60000),
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      // Call setManual
      setManualHandler(db, {
        listaId: lista.id,
        productoId: prod.id,
        precioCentavos: 120000,
      });

      // Previous vigente should now have fecha_hasta set
      const anterior = db.select().from(schema.lista_precio_valor)
        .where(eq(schema.lista_precio_valor.id, vigenteId))
        .get();
      expect(anterior?.fecha_hasta).not.toBeNull();

      // New vigente row should exist
      const vigentes = db.select().from(schema.lista_precio_valor)
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, lista.id),
          eq(schema.lista_precio_valor.producto_id, prod.id),
          isNull(schema.lista_precio_valor.fecha_hasta),
        ))
        .all();
      expect(vigentes).toHaveLength(1);
      expect(vigentes[0].precio_centavos).toBe(120000);
      expect(vigentes[0].origen).toBe('manual');
    });
  });

  // ── listarVigentesParaProducto ────────────────────────────────────────────────

  describe('listarVigentesParaProductoHandler', () => {
    it('devuelve filas vigentes con nombre de lista', () => {
      loginAsAdmin(db);
      const lista = crearLista('Mayorista', 0);
      const prod = crearProducto(1000);
      const now = new Date();

      // ADR-034: close auto-seeded vigente row, then insert the desired test row
      closeVigentes(db, lista.id, prod.id);

      db.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 88000,
        fecha_desde: now,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      const result = listarVigentesParaProductoHandler(db, prod.id);

      expect(result).toHaveLength(1);
      expect(result[0].lista_nombre).toBe('Mayorista');
      expect(result[0].precio_centavos).toBe(88000);
    });
  });

  // ── listarVigentesPorLista ───────────────────────────────────────────────────

  describe('listarVigentesPorListaHandler', () => {
    it('devuelve filas vigentes con nombre de producto y sin promo cuando no hay', () => {
      loginAsAdmin(db);
      const lista = crearLista('Mayorista', 0);
      const prod = crearProducto(1000);
      const now = new Date();

      // ADR-034: close auto-seeded vigente row, then insert the desired test row
      closeVigentes(db, lista.id, prod.id);

      db.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 77000,
        fecha_desde: now,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      const result = listarVigentesPorListaHandler(db, lista.id);

      expect(result).toHaveLength(1);
      expect(result[0].precio_centavos).toBe(77000);
      expect(result[0].precio_promocion_centavos).toBeNull();
      expect(result[0].promocion_hasta).toBeNull();
    });

    it('incluye sku y gtin_barcode del producto (ADR-071)', () => {
      loginAsAdmin(db);
      const lista = crearLista('Mayorista', 0);
      const cat = categoriaCreateHandler(db, { nombre: 'Cat-' + generateId().slice(0, 8) });
      const imp = db.select().from(schema.impuesto).all()[0];
      const prod = productoCreateHandler(db, {
        nombre_corto: 'ProdConEan',
        categoria_id: cat.id,
        impuesto_id: imp.id,
        unidad_venta: 'u',
        precio_venta_lista: 1000,
        gtin_barcode: '7791234567890',
      });

      setManualHandler(db, { listaId: lista.id, productoId: prod.id, precioCentavos: 77000 });

      const result = listarVigentesPorListaHandler(db, lista.id);

      expect(result).toHaveLength(1);
      expect(result[0].sku).toBe(prod.sku);
      expect(typeof result[0].sku).toBe('string');
      expect(result[0].sku.length).toBeGreaterThan(0);
      expect(result[0].gtin_barcode).toBe('7791234567890');
    });

    it('incluye precio_promocion_centavos y promocion_hasta cuando hay promo activa', () => {
      loginAsAdmin(db);
      const lista = crearLista('Mayorista', 0);
      const prod = crearProducto(1000);
      const now = new Date();
      const past = new Date(now.getTime() - 60000);
      // Truncate to whole seconds so the value SQLite returns matches exactly
      const future = new Date(Math.floor((now.getTime() + 3600000) / 1000) * 1000);

      // ADR-034: close auto-seeded vigente row, then insert the desired test row
      closeVigentes(db, lista.id, prod.id);

      db.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 77000,
        fecha_desde: past,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      db.insert(schema.promocion).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 60000,
        fecha_desde: past,
        fecha_hasta: future,
        descripcion: 'Promo verano',
        activo: true,
        usuario_creacion_id: 'test-user',
        fecha_creacion: now,
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      const result = listarVigentesPorListaHandler(db, lista.id);

      expect(result).toHaveLength(1);
      expect(result[0].precio_centavos).toBe(77000);
      expect(result[0].precio_promocion_centavos).toBe(60000);
      // SQLite stores timestamps as INTEGER seconds; future is already truncated to seconds
      expect(result[0].promocion_hasta).toBeInstanceOf(Date);
      expect((result[0].promocion_hasta as Date).getTime()).toBe(future.getTime());
    });

    it('no incluye promo expirada', () => {
      loginAsAdmin(db);
      const lista = crearLista('Minorista', 0);
      const prod = crearProducto(2000);
      const now = new Date();
      const past = new Date(now.getTime() - 7200000);
      const pastEnd = new Date(now.getTime() - 3600000);

      // ADR-034: close auto-seeded vigente row, then insert the desired test row
      closeVigentes(db, lista.id, prod.id);

      db.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 150000,
        fecha_desde: past,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      db.insert(schema.promocion).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 100000,
        fecha_desde: past,
        fecha_hasta: pastEnd,
        descripcion: 'Promo expirada',
        activo: true,
        usuario_creacion_id: 'test-user',
        fecha_creacion: now,
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      const result = listarVigentesPorListaHandler(db, lista.id);

      expect(result).toHaveLength(1);
      expect(result[0].precio_promocion_centavos).toBeNull();
      expect(result[0].promocion_hasta).toBeNull();
    });
  });

  // ── contarAfectados ───────────────────────────────────────────────────────────

  describe('contarAfectadosHandler', () => {
    it('contarAfectados con excluir_manuales_dias excluye producto con manual reciente', () => {
      loginAsAdmin(db);
      const { listaId, productoId, p2Id } = seedParaRecalculo();
      const now = new Date();

      // ADR-034: auto-seed creó 2 filas vigentes con origen='manual'. Para que el filtro
      // excluir_manuales_dias solo afecte a productoId, cerramos ambas filas auto-sembradas
      // y luego insertamos solo la fila manual reciente para productoId.
      closeVigentes(db, listaId, productoId);
      closeVigentes(db, listaId, p2Id);
      db.insert(schema.lista_precio_valor).values({
        id: generateId(), lista_precio_id: listaId, producto_id: productoId,
        precio_centavos: 10000,
        fecha_desde: new Date(now.getTime() - 2 * 86400000), fecha_hasta: null,
        origen: 'manual', usuario_id: 'admin',
        version: 1, origin_id: 'T1', sync_state: 'pending', updated_at: now,
      }).run();
      const count = contarAfectadosHandler(db, {
        lista_precio_id: listaId, porcentaje: 10,
        base_calculo: 'precio_lista', alcance: 'catalogo',
        excluir_manuales_dias: 30,
      });
      // productoId excluido (tiene manual reciente), solo p2Id cuenta
      expect(count).toBe(1);
      // contarAfectados no escribe filas — solo lee
      const beforeCount = db.select().from(schema.lista_precio_valor).all().length;
      contarAfectadosHandler(db, {
        lista_precio_id: listaId, porcentaje: 10,
        base_calculo: 'precio_lista', alcance: 'catalogo',
        excluir_manuales_dias: 30,
      });
      const afterCount = db.select().from(schema.lista_precio_valor).all().length;
      expect(afterCount).toBe(beforeCount);
    });

    it('cuenta productos sin escribir nada', () => {
      loginAsAdmin(db);
      const lista = crearLista('General', 0);
      crearProducto(1000);
      crearProducto(2000);

      const params: RecalcularMasivoParams = {
        lista_precio_id: lista.id,
        porcentaje: 10,
        base_calculo: 'precio_lista',
        alcance: 'catalogo',
      };

      const countBefore = db.select().from(schema.lista_precio_valor).all().length;
      const count = contarAfectadosHandler(db, params);
      expect(count).toBeGreaterThanOrEqual(2);

      // Verify contarAfectados does not write any new rows
      const countAfter = db.select().from(schema.lista_precio_valor).all().length;
      expect(countAfter).toBe(countBefore);
    });
  });

  // ── recalcularMasivo ──────────────────────────────────────────────────────────

  describe('recalcularMasivoHandler', () => {
    it('recalcularMasivo registra fila en recalculo_masivo', () => {
      loginAsAdmin(db);
      const { listaId } = seedParaRecalculo();
      const result = recalcularMasivoHandler(db, {
        lista_precio_id: listaId, porcentaje: 5,
        base_calculo: 'precio_lista', alcance: 'catalogo',
      });
      const auditRow = db.select().from(schema.recalculo_masivo)
        .where(eq(schema.recalculo_masivo.id, result.recalculo_masivo_id))
        .get();
      expect(auditRow).not.toBeNull();
      expect(auditRow!.estado).toBe('aplicado');
      expect(auditRow!.productos_afectados).toBe(2);
      expect(auditRow!.porcentaje).toBe(5);
    });

    it('inserta filas vigentes con precio correcto', () => {
      loginAsAdmin(db);
      const lista = crearLista('General', 0);
      const prod = crearProducto(1000);

      const params: RecalcularMasivoParams = {
        lista_precio_id: lista.id,
        porcentaje: 10,
        base_calculo: 'precio_lista',
        alcance: 'catalogo',
      };

      const result = recalcularMasivoHandler(db, params);

      expect(result.productos_afectados).toBeGreaterThanOrEqual(1);
      expect(result.recalculo_masivo_id).toBeTruthy();

      // Verify new vigente row
      const vigente = db.select().from(schema.lista_precio_valor)
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, lista.id),
          eq(schema.lista_precio_valor.producto_id, prod.id),
          isNull(schema.lista_precio_valor.fecha_hasta),
        ))
        .get();

      expect(vigente).toBeTruthy();
      // precio = round(1000 * 100 * (1 + 10/100)) = 110000
      expect(vigente?.precio_centavos).toBe(110000);
      expect(vigente?.origen).toBe('recalculo');
    });

    it('cierra fila vigente anterior en recalculo masivo (SCD2)', () => {
      loginAsAdmin(db);
      const lista = crearLista('General', 0);
      const prod = crearProducto(1000);
      const now = new Date();

      // ADR-034: close auto-seeded vigente row, then insert the test's "previous vigente" row
      closeVigentes(db, lista.id, prod.id);

      // Insert a previous vigente row
      const vigenteId = generateId();
      db.insert(schema.lista_precio_valor).values({
        id: vigenteId,
        lista_precio_id: lista.id,
        producto_id: prod.id,
        precio_centavos: 90000,
        fecha_desde: new Date(now.getTime() - 60000),
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      const params: RecalcularMasivoParams = {
        lista_precio_id: lista.id,
        porcentaje: 20,
        base_calculo: 'precio_lista',
        alcance: 'catalogo',
      };

      recalcularMasivoHandler(db, params);

      // Previous vigente should now be closed
      const anterior = db.select().from(schema.lista_precio_valor)
        .where(eq(schema.lista_precio_valor.id, vigenteId))
        .get();
      expect(anterior?.fecha_hasta).not.toBeNull();

      // Should have exactly one vigente row now
      const vigentes = db.select().from(schema.lista_precio_valor)
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, lista.id),
          eq(schema.lista_precio_valor.producto_id, prod.id),
          isNull(schema.lista_precio_valor.fecha_hasta),
        ))
        .all();
      expect(vigentes).toHaveLength(1);
    });

    it('excluir_manuales_dias excluye productos con precio manual reciente', () => {
      loginAsAdmin(db);
      const lista = crearLista('General', 0);
      const prod1 = crearProducto(1000);
      const prod2 = crearProducto(2000);
      const now = new Date();
      const recentDate = new Date(now.getTime() - 3600000); // 1 hora atrás

      // ADR-034: close auto-seeded vigentes for both products (both have origen='manual').
      // Without closing prod2's row, excluir_manuales_dias would also exclude prod2 (auto-seeded).
      closeVigentes(db, lista.id, prod1.id);
      closeVigentes(db, lista.id, prod2.id);

      // Insert a recent manual vigente for prod1 only
      db.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: prod1.id,
        precio_centavos: 99000,
        fecha_desde: recentDate,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: 'test-user',
        version: 1,
        origin_id: 'test',
        sync_state: 'pending',
        updated_at: now,
      }).run();

      const params: RecalcularMasivoParams = {
        lista_precio_id: lista.id,
        porcentaje: 10,
        base_calculo: 'precio_lista',
        alcance: 'catalogo',
        excluir_manuales_dias: 7, // exclude products with manual price in last 7 days
      };

      const result = recalcularMasivoHandler(db, params);

      // prod1 should be excluded (has recent manual); prod2 should be included
      // prod1's vigente should remain unchanged
      const prod1Vigente = db.select().from(schema.lista_precio_valor)
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, lista.id),
          eq(schema.lista_precio_valor.producto_id, prod1.id),
          isNull(schema.lista_precio_valor.fecha_hasta),
        ))
        .get();
      expect(prod1Vigente?.precio_centavos).toBe(99000); // unchanged
      expect(prod1Vigente?.origen).toBe('manual'); // still manual

      // prod2 should have a new recalculo row
      const prod2Vigente = db.select().from(schema.lista_precio_valor)
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, lista.id),
          eq(schema.lista_precio_valor.producto_id, prod2.id),
          isNull(schema.lista_precio_valor.fecha_hasta),
        ))
        .get();
      expect(prod2Vigente?.origen).toBe('recalculo');
      expect(result.productos_afectados).toBeGreaterThanOrEqual(1);
    });
  });
});
