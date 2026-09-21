import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { proveedorUpsertHandler } from '../proveedor';
import {
  productoProveedorUpsertHandler,
  productoProveedorSetOverridesHandler,
  productoProveedorSetPreferidoHandler,
  productoProveedorRemoveHandler,
  proveedorProductosAsociarHandler,
  proveedorProductosActualizarHandler,
  proveedorProductosDesasociarHandler,
} from '../producto-proveedor';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;
let db: Db;
let productoId: string;
let proveedorId: string;

beforeEach(() => {
  db = setupDb();
  runCatalogSeed(db);
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

  const prov = proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT', numero_documento: '20111111112',
    razon_social: 'Distribuidora Alfa', condicion_fiscal: 'Responsable Inscripto',
  });
  proveedorId = prov.id;
});
afterEach(() => { clearSession(); });

describe('productoProveedorUpsertHandler — validación de payload (ADR-085)', () => {
  it('rechaza producto_id vacío', () => {
    expect(() => productoProveedorUpsertHandler(db, {
      producto_id: '', proveedor_id: proveedorId, costo_centavos: 1000,
    } as any)).toThrow('VALIDATION:producto_id:REQUERIDO');
  });

  it('rechaza producto_id omitido', () => {
    expect(() => productoProveedorUpsertHandler(db, {
      proveedor_id: proveedorId, costo_centavos: 1000,
    } as any)).toThrow('VALIDATION:producto_id:TIPO');
  });

  it('rechaza proveedor_id vacío', () => {
    expect(() => productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: '', costo_centavos: 1000,
    } as any)).toThrow('VALIDATION:proveedor_id:REQUERIDO');
  });

  it('rechaza costo_centavos negativo', () => {
    expect(() => productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: -5,
    } as any)).toThrow('VALIDATION:costo_centavos:NEGATIVO');
  });

  it('rechaza costo_centavos no entero', () => {
    expect(() => productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 10.5,
    } as any)).toThrow('VALIDATION:costo_centavos:NO_ENTERO');
  });

  it('rechaza costo_centavos omitido', () => {
    expect(() => productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId,
    } as any)).toThrow('VALIDATION:costo_centavos:TIPO');
  });

  it('rechaza codigo_proveedor demasiado largo', () => {
    expect(() => productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 1000,
      codigo_proveedor: 'x'.repeat(101),
    } as any)).toThrow('VALIDATION:codigo_proveedor:MAX:100');
  });

  it('acepta payload válido sin codigo_proveedor', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 5000,
    } as any);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('proveedorProductosAsociarHandler — validación de payload (ADR-085)', () => {
  it('rechaza proveedor_id vacío', () => {
    expect(() => proveedorProductosAsociarHandler(db, {
      proveedor_id: '', producto_id: productoId, costo_centavos: 1000,
    } as any)).toThrow('VALIDATION:proveedor_id:REQUERIDO');
  });

  it('rechaza producto_id de tipo inválido', () => {
    expect(() => proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorId, producto_id: 123, costo_centavos: 1000,
    } as any)).toThrow('VALIDATION:producto_id:TIPO');
  });

  it('rechaza costo_centavos negativo', () => {
    expect(() => proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorId, producto_id: productoId, costo_centavos: -1,
    } as any)).toThrow('VALIDATION:costo_centavos:NEGATIVO');
  });

  it('acepta payload válido con codigo_proveedor', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorId, producto_id: productoId, costo_centavos: 3000, codigo_proveedor: 'A-1',
    } as any);
    expect(typeof id).toBe('string');
  });
});

describe('productoProveedorSetOverridesHandler — validación de payload (ADR-085)', () => {
  it('rechaza id vacío', () => {
    expect(() => productoProveedorSetOverridesHandler(db, '' as any, {
      bonificacion_pct: null, costo_financiero_pct: null, flete_pct: null, flete_centavos: null, otros_costos_centavos: null,
    } as any)).toThrow('VALIDATION:id:REQUERIDO');
  });

  it('rechaza bonificacion_pct de tipo inválido cuando no es null', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 1000,
    });
    expect(() => productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: 'x', costo_financiero_pct: null, flete_pct: null, flete_centavos: null, otros_costos_centavos: null,
    } as any)).toThrow('VALIDATION:bonificacion_pct:TIPO');
  });

  it('rechaza flete_centavos negativo', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 1000,
    });
    expect(() => productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: null, costo_financiero_pct: null, flete_pct: null, flete_centavos: -100, otros_costos_centavos: null,
    } as any)).toThrow('VALIDATION:flete_centavos:NEGATIVO');
  });

  it('rechaza otros_costos_centavos no entero', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 1000,
    });
    expect(() => productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: null, costo_financiero_pct: null, flete_pct: null, flete_centavos: null, otros_costos_centavos: 1.5,
    } as any)).toThrow('VALIDATION:otros_costos_centavos:NO_ENTERO');
  });

  it('rechaza costo_centavos negativo cuando viene presente', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 1000,
    });
    expect(() => productoProveedorSetOverridesHandler(db, id, {
      costo_centavos: -1,
      bonificacion_pct: null, costo_financiero_pct: null, flete_pct: null, flete_centavos: null, otros_costos_centavos: null,
    } as any)).toThrow('VALIDATION:costo_centavos:NEGATIVO');
  });

  it('acepta overrides válidos con valores null explícitos (limpiar = heredar)', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 1000,
    });
    const r = productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: null, costo_financiero_pct: null, flete_pct: null, flete_centavos: null, otros_costos_centavos: null,
    } as any);
    expect(r.id).toBe(id);
  });

  it('acepta overrides numéricos válidos', () => {
    const { id } = productoProveedorUpsertHandler(db, {
      producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 1000,
    });
    const r = productoProveedorSetOverridesHandler(db, id, {
      bonificacion_pct: 12, costo_financiero_pct: 2, flete_pct: 1, flete_centavos: 500, otros_costos_centavos: 0,
    } as any);
    expect(r.id).toBe(id);
  });
});

describe('productoProveedorSetPreferidoHandler / RemoveHandler — validación de id (ADR-085)', () => {
  it('setPreferido rechaza id vacío', () => {
    expect(() => productoProveedorSetPreferidoHandler(db, '' as any)).toThrow('VALIDATION:id:REQUERIDO');
  });

  it('setPreferido rechaza id de tipo inválido', () => {
    expect(() => productoProveedorSetPreferidoHandler(db, 123 as any)).toThrow('VALIDATION:id:TIPO');
  });

  it('remove rechaza id vacío', () => {
    expect(() => productoProveedorRemoveHandler(db, '' as any)).toThrow('VALIDATION:id:REQUERIDO');
  });
});

describe('proveedorProductosDesasociarHandler — validación de id (ADR-085)', () => {
  it('rechaza id vacío', () => {
    expect(() => proveedorProductosDesasociarHandler(db, '' as any)).toThrow('VALIDATION:id:REQUERIDO');
  });
});

describe('proveedorProductosActualizarHandler — validación de payload (ADR-085)', () => {
  it('rechaza id vacío', () => {
    expect(() => proveedorProductosActualizarHandler(db, '' as any, { costo_centavos: 100 } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('rechaza costo_centavos negativo cuando viene presente en el patch', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorId, producto_id: productoId, costo_centavos: 1000,
    });
    expect(() => proveedorProductosActualizarHandler(db, id, { costo_centavos: -5 } as any))
      .toThrow('VALIDATION:costo_centavos:NEGATIVO');
  });

  it('rechaza costo_centavos no entero cuando viene presente en el patch', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorId, producto_id: productoId, costo_centavos: 1000,
    });
    expect(() => proveedorProductosActualizarHandler(db, id, { costo_centavos: 10.1 } as any))
      .toThrow('VALIDATION:costo_centavos:NO_ENTERO');
  });

  it('rechaza codigo_proveedor demasiado largo', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorId, producto_id: productoId, costo_centavos: 1000,
    });
    expect(() => proveedorProductosActualizarHandler(db, id, { codigo_proveedor: 'y'.repeat(101) } as any))
      .toThrow('VALIDATION:codigo_proveedor:MAX:100');
  });

  it('rechaza preferido de tipo inválido', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorId, producto_id: productoId, costo_centavos: 1000,
    });
    expect(() => proveedorProductosActualizarHandler(db, id, { preferido: 'si' } as any))
      .toThrow('VALIDATION:preferido:TIPO');
  });

  it('acepta patch parcial con solo costo_centavos', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorId, producto_id: productoId, costo_centavos: 1000,
    });
    const r = proveedorProductosActualizarHandler(db, id, { costo_centavos: 2500 } as any);
    expect(r.id).toBe(id);
  });

  it('acepta codigo_proveedor null explícito (limpiar)', () => {
    const { id } = proveedorProductosAsociarHandler(db, {
      proveedor_id: proveedorId, producto_id: productoId, costo_centavos: 1000, codigo_proveedor: 'OLD',
    });
    const r = proveedorProductosActualizarHandler(db, id, { codigo_proveedor: null } as any);
    expect(r.id).toBe(id);
    const row = db.select().from(schema.producto_proveedor).where(eq(schema.producto_proveedor.id, id)).get()!;
    expect(row.codigo_proveedor).toBeNull();
  });
});
