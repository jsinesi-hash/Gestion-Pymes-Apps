import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { proveedorUpsertHandler } from '../proveedor';
import { productoProveedorUpsertHandler, productoProveedorSetPreferidoHandler } from '../producto-proveedor';
import { listaPrecioCreateHandler } from '../lista-precio';
import { reglaPrecioUpsertHandler } from '../regla-precio';
import {
  crearBatchHandler, obtenerBatchHandler, listarBatchesHandler,
  aprobarBatchHandler, publicarBatchHandler, revertirBatchHandler, excluirErroresHandler,
  revalidarBatchHandler,
} from '../price-batch';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let listaId: string;
let productoId: string;

function vigente(listaId: string, productoId: string): number | null {
  const row = db.select().from(schema.lista_precio_valor)
    .where(and(
      eq(schema.lista_precio_valor.lista_precio_id, listaId),
      eq(schema.lista_precio_valor.producto_id, productoId),
      isNull(schema.lista_precio_valor.fecha_hasta),
    )).get();
  return row?.precio_centavos ?? null;
}

function setup(margenPct: number) {
  db = setupDb();
  runCatalogSeed(db);
  clearSession();
  loginAsAdmin(db);

  const cat = categoriaCreateHandler(db, { nombre: 'Herramientas' });
  const imp = db.select().from(schema.impuesto).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: 'Amoladora', categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'u', precio_venta_lista: 100, // => precio_anterior 10000
  });
  productoId = prod.id;

  const prov = proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT', numero_documento: '20111111112',
    razon_social: 'Bosch', condicion_fiscal: 'Responsable Inscripto',
  });
  const { id: ppId } = productoProveedorUpsertHandler(db, {
    producto_id: productoId, proveedor_id: prov.id, costo_centavos: 5000, // $50
  });
  productoProveedorSetPreferidoHandler(db, ppId);

  const lista = listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
  listaId = lista.id;
  reglaPrecioUpsertHandler(db, { lista_precio_id: listaId, tipo: 'lista', objetivo_id: null, margen_pct: margenPct });
}

describe('price-batch — circuito completo (ADR-049 §4-6)', () => {
  beforeEach(() => setup(40));

  it('crear calcula el lote y queda validado; precio propuesto = costo × (1 + margen)', () => {
    const { id, estado } = crearBatchHandler(db, { lista_precio_id: listaId, origen: 'MARGIN_UPDATE', alcance: 'catalogo' });
    expect(estado).toBe('validado');
    const { batch, detalle } = obtenerBatchHandler(db, id)!;
    expect(batch.errores).toBe(0);
    const fila = detalle.find(d => d.producto_id === productoId)!;
    // costo neto 5000, margen 40% => 7000
    expect(fila.precio_propuesto_centavos).toBe(7000);
    expect(fila.precio_anterior_centavos).toBe(10000);
  });

  it('aprobar + publicar deja el precio vigente en el propuesto', () => {
    const { id } = crearBatchHandler(db, { lista_precio_id: listaId, origen: 'MARGIN_UPDATE', alcance: 'catalogo' });
    aprobarBatchHandler(db, id);
    const { publicados } = publicarBatchHandler(db, id);
    expect(publicados).toBe(1);
    expect(vigente(listaId, productoId)).toBe(7000);
    const b = db.select().from(schema.price_batch).where(eq(schema.price_batch.id, id)).get()!;
    expect(b.estado).toBe('publicado');
  });

  it('revertir crea un lote nuevo y restaura el precio anterior (historia intacta)', () => {
    const { id } = crearBatchHandler(db, { lista_precio_id: listaId, origen: 'MARGIN_UPDATE', alcance: 'catalogo' });
    aprobarBatchHandler(db, id);
    publicarBatchHandler(db, id);
    expect(vigente(listaId, productoId)).toBe(7000);

    const { id: rollbackId } = revertirBatchHandler(db, id);
    aprobarBatchHandler(db, rollbackId);
    publicarBatchHandler(db, rollbackId);
    expect(vigente(listaId, productoId)).toBe(10000); // vuelve al valor previo

    // dos lotes en el historial; el original queda 'revertido'
    const batches = listarBatchesHandler(db, { soloActivos: false });
    expect(batches.length).toBeGreaterThanOrEqual(2);
    const original = db.select().from(schema.price_batch).where(eq(schema.price_batch.id, id)).get()!;
    expect(original.estado).toBe('revertido');
  });

  it('un lote con un error no se puede aprobar hasta excluir la fila', () => {
    // margen -50% => precio 2500 < costo 5000 => error
    setup(-50);
    const { id, estado } = crearBatchHandler(db, { lista_precio_id: listaId, origen: 'MARGIN_UPDATE', alcance: 'catalogo' });
    expect(estado).toBe('validacion_fallida');
    expect(() => aprobarBatchHandler(db, id)).toThrow(/ERRORES|APROBABLE/);
    excluirErroresHandler(db, id);
    const b = db.select().from(schema.price_batch).where(eq(schema.price_batch.id, id)).get()!;
    expect(b.estado).toBe('validado');
    expect(b.excluidas).toBe(1);
    aprobarBatchHandler(db, id); // ahora sí
  });

  it('crear exige config.fiscal; aprobar exige precio.aprobar', () => {
    clearSession();
    expect(() => crearBatchHandler(db, { lista_precio_id: listaId, origen: 'MARGIN_UPDATE', alcance: 'catalogo' })).toThrow();
  });

  it('obtener incluye el nombre de la lista (ADR-071)', () => {
    const { id } = crearBatchHandler(db, { lista_precio_id: listaId, origen: 'MARGIN_UPDATE', alcance: 'catalogo' });
    const { batch } = obtenerBatchHandler(db, id)!;
    expect(batch.lista_nombre).toBe('General');
  });
});

describe('price-batch — re-validar (ADR-070)', () => {
  function setupSinCosto() {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
    const cat = categoriaCreateHandler(db, { nombre: 'Herramientas' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod = productoCreateHandler(db, {
      nombre_corto: 'Taladro', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 100,
    });
    productoId = prod.id;
    const lista = listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
    listaId = lista.id;
    reglaPrecioUpsertHandler(db, { lista_precio_id: listaId, tipo: 'lista', objetivo_id: null, margen_pct: 40 });
  }

  function agregarProveedorPreferido(costoCentavos: number) {
    const prov = proveedorUpsertHandler(db, {
      tipo_documento: 'CUIT', numero_documento: '20111111112',
      razon_social: 'Bosch', condicion_fiscal: 'Responsable Inscripto',
    });
    const { id: ppId } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: prov.id, costo_centavos: costoCentavos,
    });
    productoProveedorSetPreferidoHandler(db, ppId);
  }

  it('rescata una fila en error cuando se cargó el costo después de crear el lote', () => {
    setupSinCosto();
    const { id, estado } = crearBatchHandler(db, { lista_precio_id: listaId, origen: 'PROVIDER_COST_UPDATE', alcance: 'catalogo' });
    expect(estado).toBe('validacion_fallida'); // sin proveedor/costo → error

    agregarProveedorPreferido(5000); // $50, sin bonif/flete → neto 5000
    const r = revalidarBatchHandler(db, id);
    expect(r.estado).toBe('validado');

    const { batch, detalle } = obtenerBatchHandler(db, id)!;
    expect(batch.errores).toBe(0);
    const fila = detalle.find(d => d.producto_id === productoId)!;
    expect(['ok', 'advertencia']).toContain(fila.estado_validacion);
    expect(fila.costo_neto_centavos).toBe(5000);
    expect(fila.precio_propuesto_centavos).toBe(7000); // 5000 × 1.40
  });

  it('respeta las filas excluidas manualmente (no las recalcula)', () => {
    setupSinCosto();
    const { id } = crearBatchHandler(db, { lista_precio_id: listaId, origen: 'PROVIDER_COST_UPDATE', alcance: 'catalogo' });
    excluirErroresHandler(db, id);       // la única fila (error) queda excluida
    agregarProveedorPreferido(5000);     // ahora sí hay costo
    revalidarBatchHandler(db, id);

    const { batch, detalle } = obtenerBatchHandler(db, id)!;
    expect(detalle[0].estado_validacion).toBe('excluida'); // sigue excluida
    expect(batch.excluidas).toBe(1);
    expect(batch.errores).toBe(0);
  });

  it('no re-valida un lote ya aprobado', () => {
    setupSinCosto();
    agregarProveedorPreferido(5000);
    const { id } = crearBatchHandler(db, { lista_precio_id: listaId, origen: 'MARGIN_UPDATE', alcance: 'catalogo' });
    aprobarBatchHandler(db, id);
    expect(() => revalidarBatchHandler(db, id)).toThrow(/REVALIDABLE/);
  });

  it('re-validar exige config.fiscal', () => {
    setupSinCosto();
    const { id } = crearBatchHandler(db, { lista_precio_id: listaId, origen: 'MARGIN_UPDATE', alcance: 'catalogo' });
    clearSession();
    expect(() => revalidarBatchHandler(db, id)).toThrow();
  });
});
