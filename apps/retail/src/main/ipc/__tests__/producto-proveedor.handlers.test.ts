import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { proveedorUpsertHandler } from '../proveedor';
import {
  productoProveedorListHandler,
  productoProveedorUpsertHandler,
  productoProveedorSetPreferidoHandler,
  productoProveedorRemoveHandler,
  productoProveedorSetOverridesHandler,
  proveedorProductosListarHandler,
  proveedorProductosAsociarHandler,
  proveedorProductosDesasociarHandler,
  proveedorProductosActualizarHandler,
  proveedorProductosAsociarLoteHandler,
} from '../producto-proveedor';
import { costoNeto } from '@ferreteria/shared';
import { listaPrecioCreateHandler } from '../lista-precio';
import { reglaPrecioUpsertHandler } from '../regla-precio';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let productoId: string;
let proveedorAId: string;
let proveedorBId: string;

beforeEach(() => {
  db = setupDb();
  runCatalogSeed(db);
  clearSession();
  loginAsAdmin(db);

  const cat = categoriaCreateHandler(db, { nombre: 'Test' });
  const imp = db.select().from(schema.impuesto).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: 'Tornillo',
    categoria_id: cat.id,
    impuesto_id: imp.id,
    unidad_venta: 'u',
    precio_venta_lista: 100,
  });
  productoId = prod.id;

  const provA = proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT', numero_documento: '20111111112',
    razon_social: 'Distribuidora Alfa', condicion_fiscal: 'Responsable Inscripto',
  });
  proveedorAId = provA.id;

  const provB = proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT', numero_documento: '20222222223',
    razon_social: 'Proveedora Beta', condicion_fiscal: 'Responsable Inscripto',
  });
  proveedorBId = provB.id;
});

// ── productoProveedorListHandler ──────────────────────────────────────────────

describe('productoProveedorListHandler', () => {
  it('devuelve lista vacía cuando no hay proveedores asignados', () => {
    expect(productoProveedorListHandler(db, productoId)).toHaveLength(0);
  });

  it('devuelve proveedor asignado con razon_social y campos del vínculo', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId,
      proveedor_id: proveedorAId,
      costo_centavos: 5000,
      codigo_proveedor: 'DIST-001',
    });
    const rows = productoProveedorListHandler(db, productoId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].razon_social).toBe('Distribuidora Alfa');
    expect(rows[0].costo_centavos).toBe(5000);
    expect(rows[0].codigo_proveedor).toBe('DIST-001');
    expect(rows[0].preferido).toBe(false);
  });

  it('devuelve múltiples proveedores del mismo producto', () => {
    productoProveedorUpsertHandler(db, { producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 1000 });
    productoProveedorUpsertHandler(db, { producto_id: productoId, proveedor_id: proveedorBId, costo_centavos: 2000 });
    expect(productoProveedorListHandler(db, productoId)).toHaveLength(2);
  });

  it('no devuelve registros soft-deleted', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 1000,
    });
    proveedorProductosDesasociarHandler(db, id);
    expect(productoProveedorListHandler(db, productoId)).toHaveLength(0);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => productoProveedorListHandler(db, productoId)).toThrow('UNAUTHENTICATED');
  });
});

// ── ADR-049 §1: overrides comerciales y costo neto ────────────────────────────

describe('costo neto — overrides por producto + defaults del proveedor', () => {
  it('la lista devuelve overrides nullable y los defaults del proveedor', () => {
    // Proveedor con defaults comerciales cargados
    proveedorUpsertHandler(db, {
      id: proveedorAId,
      tipo_documento: 'CUIT', numero_documento: '20111111112',
      razon_social: 'Distribuidora Alfa', condicion_fiscal: 'Responsable Inscripto',
      bonificacion_pct_default: 10, costo_financiero_pct_default: 2, flete_pct_default: 1,
    });
    productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 10000,
    });
    const rows = productoProveedorListHandler(db, productoId);
    expect(rows).toHaveLength(1);
    // overrides sin cargar => null (hereda)
    expect(rows[0].bonificacion_pct).toBeNull();
    expect(rows[0].costo_financiero_pct).toBeNull();
    expect(rows[0].flete_pct).toBeNull();
    expect(rows[0].flete_centavos).toBeNull();
    expect(rows[0].otros_costos_centavos).toBeNull();
    // defaults del proveedor viajan en la fila para calcular el costo neto en el renderer
    expect(rows[0].bonificacion_pct_default).toBe(10);
    expect(rows[0].costo_financiero_pct_default).toBe(2);
    expect(rows[0].flete_pct_default).toBe(1);
  });

  it('setOverrides persiste los overrides por producto', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 10000,
    });
    productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: 12,
      costo_financiero_pct: null,
      flete_pct: null,
      flete_centavos: 1200,
      otros_costos_centavos: null,
    });
    const rows = productoProveedorListHandler(db, productoId);
    expect(rows[0].bonificacion_pct).toBe(12);
    expect(rows[0].flete_centavos).toBe(1200);
    expect(rows[0].costo_financiero_pct).toBeNull();
  });

  it('setOverrides también actualiza el costo bruto y bumpea el sync', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 10000,
    });
    productoProveedorSetOverridesHandler(db, id, {
      costo_centavos: 12500,
      bonificacion_pct: null,
      costo_financiero_pct: null,
      flete_pct: null,
      flete_centavos: null,
      otros_costos_centavos: null,
    });
    const row = db.select().from(schema.producto_proveedor)
      .where(eq(schema.producto_proveedor.id, id)).get()!;
    expect(row.costo_centavos).toBe(12500);
    expect(row.sync_state).toBe('pending');
  });

  it('setOverrides sin costo_centavos NO toca el costo bruto (retrocompat)', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 9000,
    });
    productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: 5,
      costo_financiero_pct: null,
      flete_pct: null,
      flete_centavos: null,
      otros_costos_centavos: null,
    });
    const row = db.select().from(schema.producto_proveedor)
      .where(eq(schema.producto_proveedor.id, id)).get()!;
    expect(row.costo_centavos).toBe(9000);
  });

  it('setOverrides puede limpiar un override a null (volver a heredar)', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 10000,
    });
    productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: 12, costo_financiero_pct: null, flete_pct: null, flete_centavos: null, otros_costos_centavos: null,
    });
    productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: null, costo_financiero_pct: null, flete_pct: null, flete_centavos: null, otros_costos_centavos: null,
    });
    const rows = productoProveedorListHandler(db, productoId);
    expect(rows[0].bonificacion_pct).toBeNull();
  });

  it('override del producto pisa al default del proveedor (verificado con shared)', () => {
    proveedorUpsertHandler(db, {
      id: proveedorAId,
      tipo_documento: 'CUIT', numero_documento: '20111111112',
      razon_social: 'Distribuidora Alfa', condicion_fiscal: 'Responsable Inscripto',
      bonificacion_pct_default: 10,
    });
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 10000,
    });
    productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: 12, costo_financiero_pct: null, flete_pct: null, flete_centavos: 1200, otros_costos_centavos: null,
    });
    const row = productoProveedorListHandler(db, productoId)[0];
    // (82.000 estilo Bosch, acá 10.000): (10000·0,88 + 1200) · 1,0 = 10000
    const neto = costoNeto(
      row.costo_centavos,
      {
        bonificacionPct: row.bonificacion_pct,
        costoFinancieroPct: row.costo_financiero_pct,
        fletePct: row.flete_pct,
        fleteCentavos: row.flete_centavos,
        otrosCostosCentavos: row.otros_costos_centavos,
      },
      {
        bonificacionPctDefault: row.bonificacion_pct_default,
        costoFinancieroPctDefault: row.costo_financiero_pct_default,
        fletePctDefault: row.flete_pct_default,
      },
    );
    // bonif 12% (override) pisa el 10% del proveedor: 10000·0,88 = 8800 + 1200 = 10000
    expect(neto.bonificacionCentavos).toBe(1200);
    expect(neto.netoCentavos).toBe(10000);
  });

  it('setOverrides lanza UNAUTHENTICATED sin sesión', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 100,
    });
    clearSession();
    expect(() =>
      productoProveedorSetOverridesHandler(db, id, {
        bonificacion_pct: 1, costo_financiero_pct: null, flete_pct: null, flete_centavos: null, otros_costos_centavos: null,
      }),
    ).toThrow('UNAUTHENTICATED');
  });
});

// ── productoProveedorUpsertHandler ────────────────────────────────────────────

describe('productoProveedorUpsertHandler', () => {
  it('crea vínculo y retorna id', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId,
      proveedor_id: proveedorAId,
      costo_centavos: 3500,
      codigo_proveedor: 'A-123',
    });
    expect(id).toBeTruthy();
    const rows = productoProveedorListHandler(db, productoId);
    expect(rows).toHaveLength(1);
    expect(rows[0].costo_centavos).toBe(3500);
  });

  it('actualiza costo y código si el par (producto, proveedor) ya existe', () => {
    productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 1000, codigo_proveedor: 'OLD',
    });
    productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 2500, codigo_proveedor: 'NEW',
    });
    const rows = productoProveedorListHandler(db, productoId);
    expect(rows).toHaveLength(1);
    expect(rows[0].costo_centavos).toBe(2500);
    expect(rows[0].codigo_proveedor).toBe('NEW');
  });

  it('no duplica el par (producto, proveedor)', () => {
    productoProveedorUpsertHandler(db, { producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 100 });
    productoProveedorUpsertHandler(db, { producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 200 });
    expect(productoProveedorListHandler(db, productoId)).toHaveLength(1);
  });

  it('reactiva vínculo soft-deleted del mismo par', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 1000,
    });
    productoProveedorRemoveHandler(db, id); // soft-delete
    expect(productoProveedorListHandler(db, productoId)).toHaveLength(0);

    const { id: id2 } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 2000,
    });
    expect(id2).toBe(id); // mismo registro
    expect(productoProveedorListHandler(db, productoId)).toHaveLength(1);
    expect(productoProveedorListHandler(db, productoId)[0].costo_centavos).toBe(2000);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 100,
    })).toThrow('UNAUTHENTICATED');
  });
});

// ── productoProveedorSetPreferidoHandler ──────────────────────────────────────

describe('productoProveedorSetPreferidoHandler', () => {
  it('marca un vínculo como preferido', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 100,
    });
    productoProveedorSetPreferidoHandler(db, id);
    const rows = productoProveedorListHandler(db, productoId);
    expect(rows[0].preferido).toBe(true);
  });

  it('al marcar uno como preferido, el otro queda como no preferido', () => {
    const { id: idA } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 100,
    });
    const { id: idB } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorBId, costo_centavos: 200,
    });
    productoProveedorSetPreferidoHandler(db, idA);
    productoProveedorSetPreferidoHandler(db, idB);
    const rows = productoProveedorListHandler(db, productoId);
    const a = rows.find(r => r.id === idA)!;
    const b = rows.find(r => r.id === idB)!;
    expect(a.preferido).toBe(false);
    expect(b.preferido).toBe(true);
  });

  it('mantiene un único preferido activo tras alternar varias veces (invariante ADR-036)', () => {
    const { id: idA } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 100,
    });
    const { id: idB } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorBId, costo_centavos: 200,
    });
    // Alternar A → B → A: el índice único parcial no debe violarse y siempre
    // queda exactamente uno preferido (la limpieza + set van en una transacción).
    productoProveedorSetPreferidoHandler(db, idA);
    productoProveedorSetPreferidoHandler(db, idB);
    productoProveedorSetPreferidoHandler(db, idA);
    const rows = productoProveedorListHandler(db, productoId);
    expect(rows.filter(r => r.preferido)).toHaveLength(1);
    expect(rows.find(r => r.id === idA)!.preferido).toBe(true);
  });

  it('no toca registros soft-deleted al cambiar preferido', () => {
    const { id: idA } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 1000,
    });
    productoProveedorSetPreferidoHandler(db, idA);
    productoProveedorRemoveHandler(db, idA); // soft-delete (clears preferido, sets deleted_at)

    const { id: idB } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorBId, costo_centavos: 2000,
    });
    productoProveedorSetPreferidoHandler(db, idB);
    // Must not fail with unique index violation (soft-deleted record is not active)
    const rows = productoProveedorListHandler(db, productoId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(idB);
    expect(rows[0].preferido).toBe(true);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 100,
    });
    clearSession();
    expect(() => productoProveedorSetPreferidoHandler(db, id)).toThrow('UNAUTHENTICATED');
  });
});

// ── productoProveedorRemoveHandler ────────────────────────────────────────────

describe('productoProveedorRemoveHandler', () => {
  it('hace soft-delete del vínculo (sigue en BD pero no aparece en list)', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 100,
    });
    productoProveedorRemoveHandler(db, id);
    expect(productoProveedorListHandler(db, productoId)).toHaveLength(0);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 100,
    });
    clearSession();
    expect(() => productoProveedorRemoveHandler(db, id)).toThrow('UNAUTHENTICATED');
  });
});

// ── proveedorProductosListarHandler ──────────────────────────────────────────

describe('proveedorProductosListarHandler', () => {
  it('devuelve lista vacía cuando el proveedor no tiene productos asociados', () => {
    expect(proveedorProductosListarHandler(db, proveedorAId)).toHaveLength(0);
  });

  it('devuelve productos del proveedor con nombre_corto, sku y campos del vínculo', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId,
      producto_id: productoId,
      costo_centavos: 5000,
      codigo_proveedor: 'PROV-001',
    });
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].producto_id).toBe(productoId);
    expect(rows[0].nombre_corto).toBe('Tornillo');
    expect(rows[0].costo_centavos).toBe(5000);
    expect(rows[0].codigo_proveedor).toBe('PROV-001');
    expect(rows[0].preferido).toBe(false);
  });

  it('no devuelve registros con deleted_at', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId,
      producto_id: productoId,
      costo_centavos: 1000,
    });
    proveedorProductosDesasociarHandler(db, id);
    expect(proveedorProductosListarHandler(db, proveedorAId)).toHaveLength(0);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => proveedorProductosListarHandler(db, proveedorAId)).toThrow('UNAUTHENTICATED');
  });
});

// ── proveedorProductosAsociarHandler ─────────────────────────────────────────

describe('proveedorProductosAsociarHandler', () => {
  it('crea nuevo vínculo y retorna id', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId,
      producto_id: productoId,
      costo_centavos: 3500,
      codigo_proveedor: 'A-123',
    });
    expect(id).toBeTruthy();
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows).toHaveLength(1);
    expect(rows[0].costo_centavos).toBe(3500);
  });

  it('actualiza vínculo activo existente para el mismo par (proveedor, producto)', () => {
    proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 1000,
    });
    proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 2500, codigo_proveedor: 'NUEVO',
    });
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows).toHaveLength(1);
    expect(rows[0].costo_centavos).toBe(2500);
    expect(rows[0].codigo_proveedor).toBe('NUEVO');
  });

  it('reactiva vínculo soft-deleted del mismo par', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 1000,
    });
    proveedorProductosDesasociarHandler(db, id);
    expect(proveedorProductosListarHandler(db, proveedorAId)).toHaveLength(0);

    const { id: id2 } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 2000,
    });
    expect(id2).toBe(id); // mismo registro reactivado
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows).toHaveLength(1);
    expect(rows[0].costo_centavos).toBe(2000);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    clearSession();
    expect(() => proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 100,
    })).toThrow('UNAUTHENTICATED');
  });
});

// ── proveedorProductosDesasociarHandler ──────────────────────────────────────

describe('proveedorProductosDesasociarHandler', () => {
  it('hace soft-delete del vínculo (no aparece en listar)', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 1000,
    });
    proveedorProductosDesasociarHandler(db, id);
    expect(proveedorProductosListarHandler(db, proveedorAId)).toHaveLength(0);
  });

  it('limpia el flag preferido al desasociar el vínculo preferido', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 1000,
    });
    proveedorProductosActualizarHandler(db, id, { preferido: true });
    proveedorProductosDesasociarHandler(db, id);
    // Reactivar para verificar que preferido quedó en false
    proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 1000,
    });
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows[0].preferido).toBe(false);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 100,
    });
    clearSession();
    expect(() => proveedorProductosDesasociarHandler(db, id)).toThrow('UNAUTHENTICATED');
  });
});

// ── proveedorProductosActualizarHandler ──────────────────────────────────────

describe('proveedorProductosActualizarHandler', () => {
  it('actualiza costo_centavos', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 1000,
    });
    proveedorProductosActualizarHandler(db, id, { costo_centavos: 2500 });
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows[0].costo_centavos).toBe(2500);
  });

  it('actualiza codigo_proveedor', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 1000,
    });
    proveedorProductosActualizarHandler(db, id, { codigo_proveedor: 'NUEVO' });
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows[0].codigo_proveedor).toBe('NUEVO');
  });

  it('marca como preferido y desmarca el anterior (atómico por producto)', () => {
    const { id: idA } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 1000,
    });
    const { id: idB } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorBId, producto_id: productoId, costo_centavos: 2000,
    });

    proveedorProductosActualizarHandler(db, idA, { preferido: true });
    proveedorProductosActualizarHandler(db, idB, { preferido: true });

    const rowsA = proveedorProductosListarHandler(db, proveedorAId);
    const rowsB = proveedorProductosListarHandler(db, proveedorBId);
    expect(rowsA[0].preferido).toBe(false);
    expect(rowsB[0].preferido).toBe(true);
  });

  it('no toca registros soft-deleted al cambiar preferido', () => {
    const { id: idA } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 1000,
    });
    proveedorProductosActualizarHandler(db, idA, { preferido: true });
    proveedorProductosDesasociarHandler(db, idA);

    const { id: idB } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorBId, producto_id: productoId, costo_centavos: 2000,
    });
    proveedorProductosActualizarHandler(db, idB, { preferido: true });

    expect(proveedorProductosListarHandler(db, proveedorBId)[0].preferido).toBe(true);
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 100,
    });
    clearSession();
    expect(() => proveedorProductosActualizarHandler(db, id, { costo_centavos: 200 })).toThrow('UNAUTHENTICATED');
  });
});

// ── ADR-049 §7: cierre del circuito de costo — cambio de preferido ───────────

describe('cambio de preferido dispara batch de costo (solo listas en modo margen_costo)', () => {
  it('crea un batch SUPPLIER_CHANGE al marcar un nuevo preferido, si hay una lista en margen_costo', () => {
    const lista = listaPrecioCreateHandler(db, { nombre: 'MC', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
    reglaPrecioUpsertHandler(db, { lista_precio_id: lista.id, tipo: 'lista', objetivo_id: null, margen_pct: 40 });
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 5000,
    });

    productoProveedorSetPreferidoHandler(db, id);

    const batches = db.select().from(schema.price_batch)
      .where(eq(schema.price_batch.lista_precio_id, lista.id)).all();
    expect(batches).toHaveLength(1);
    expect(batches[0].origen).toBe('SUPPLIER_CHANGE');
    expect(batches[0].proveedor_id).toBe(proveedorAId);
  });

  it('no crea ningún batch si todas las listas están en modo pct_sobre_lista (default)', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorAId, costo_centavos: 5000,
    });
    productoProveedorSetPreferidoHandler(db, id);
    expect(db.select().from(schema.price_batch).all()).toHaveLength(0);
  });
});

// ── ADR-083 — proveedorProductosAsociarLoteHandler ───────────────────────────

describe('ADR-083 — proveedorProductosAsociarLoteHandler', () => {
  it('asocia varios productos en una sola llamada', () => {
    const cat2 = categoriaCreateHandler(db, { nombre: 'Test2' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod2 = productoCreateHandler(db, {
      nombre_corto: 'Bulon',
      categoria_id: cat2.id,
      impuesto_id: imp.id,
      unidad_venta: 'u',
      precio_venta_lista: 200,
    });

    const { asociados } = proveedorProductosAsociarLoteHandler(db, {
      proveedor_id: proveedorAId,
      items: [
        { producto_id: productoId, costo_centavos: 5000, codigo_proveedor: 'A-1' },
        { producto_id: prod2.id, costo_centavos: 8000, codigo_proveedor: 'A-2' },
      ],
    });
    expect(asociados).toBe(2);
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows).toHaveLength(2);
    const row1 = rows.find((r) => r.producto_id === productoId);
    const row2 = rows.find((r) => r.producto_id === prod2.id);
    expect(row1).toMatchObject({ producto_id: productoId, costo_centavos: 5000, codigo_proveedor: 'A-1', preferido: false });
    expect(row2).toMatchObject({ producto_id: prod2.id, costo_centavos: 8000, codigo_proveedor: 'A-2', preferido: false });
  });

  it('mezcla nuevo + existente en el mismo lote', () => {
    const cat2 = categoriaCreateHandler(db, { nombre: 'Test2' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod2 = productoCreateHandler(db, {
      nombre_corto: 'Bulon',
      categoria_id: cat2.id,
      impuesto_id: imp.id,
      unidad_venta: 'u',
      precio_venta_lista: 200,
    });

    proveedorProductosAsociarHandler(db, { proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 100 });

    const { asociados } = proveedorProductosAsociarLoteHandler(db, {
      proveedor_id: proveedorAId,
      items: [
        { producto_id: productoId, costo_centavos: 9999 },
        { producto_id: prod2.id, costo_centavos: 200 },
      ],
    });
    expect(asociados).toBe(2);
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows).toHaveLength(2);
    const rowExistente = rows.find((r) => r.producto_id === productoId);
    expect(rowExistente?.costo_centavos).toBe(9999);
  });

  it('es idempotente: revive un vínculo soft-deleted sin duplicar', () => {
    const first = proveedorProductosAsociarHandler(db, { proveedor_id: proveedorAId, producto_id: productoId, costo_centavos: 100 });
    proveedorProductosDesasociarHandler(db, first.id);
    const { asociados } = proveedorProductosAsociarLoteHandler(db, {
      proveedor_id: proveedorAId,
      items: [{ producto_id: productoId, costo_centavos: 7000 }],
    });
    expect(asociados).toBe(1);
    const rows = proveedorProductosListarHandler(db, proveedorAId);
    expect(rows).toHaveLength(1);
    expect(rows[0].costo_centavos).toBe(7000);
  });

  it('items vacío no rompe y asocia 0', () => {
    expect(proveedorProductosAsociarLoteHandler(db, { proveedor_id: proveedorAId, items: [] }).asociados).toBe(0);
  });
});
