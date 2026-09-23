import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { productoQueryAll, productoCreateHandler } from '../producto';
import { stockQueryAll } from '../stock';
import { stockEntradaHandler } from '../stock';
import { ubicacionQueryAll, ubicacionCreateHandler } from '../ubicacion';
import { categoriaCreateHandler, categoriaQueryAll } from '../categoria';
import { marcaQueryAll, marcaCreateHandler } from '../marca';
import { unidadQueryAll, unidadCreateHandler } from '../unidad';
import { sinonimoQueryAll, sinonimoGrupoCreateHandler } from '../sinonimo';
import { transportistaQueryAll, transportistaUpsertHandler } from '../transportista';
import { remitoListarHandler } from '../remito';
import { presupuestoListarHandler } from '../presupuesto';
import { proveedorQueryAll, proveedorUpsertHandler } from '../proveedor';
import { clienteQueryAll, clienteUpsertHandler } from '@core/main';
import { ventaQueryAll, ventaDetalladoQueryAll, ventaConfirmarHandler } from '../venta';
import { cajaAbrirHandler, cajaCerrarHandler, cajaArqueosQueryAll } from '../caja';
import { runCatalogSeed } from '../../catalog/seed';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';

let db: ReturnType<typeof setupDb>;
beforeEach(() => {
  db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db);
});

describe('productoQueryAll', () => {
  it('devuelve todos los productos sin paginación', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Test' });
    const imp = db.select().from(schema.impuesto).get()!;
    for (let i = 0; i < 3; i++) {
      productoCreateHandler(db, {
        nombre_corto: `Prod ${i}`, categoria_id: cat.id,
        impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100,
      });
    }
    expect(productoQueryAll(db, {}).length).toBe(3);
  });
  it('incluye categoria_nombre e iva_alicuota', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Test' });
    const imp = db.select().from(schema.impuesto).get()!;
    productoCreateHandler(db, {
      nombre_corto: 'Tornillo', categoria_id: cat.id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100,
    });
    const row = productoQueryAll(db, {})[0];
    expect(row.categoria_nombre).toBe('Test');
    expect(typeof row.iva_alicuota).toBe('number');
  });
  it('filtra por activo', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Test' });
    const imp = db.select().from(schema.impuesto).get()!;
    const p = productoCreateHandler(db, {
      nombre_corto: 'Inactivo', categoria_id: cat.id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100,
    });
    db.update(schema.producto).set({ activo: false })
      .where(eq(schema.producto.id, p.id)).run();
    const rows = productoQueryAll(db, { activo: true });
    expect(rows.find(r => r.id === p.id)).toBeUndefined();
  });

  // ADR-066 review: la exportación debe ser consistente con el listado
  // (buildProductoWhereClause ya matchea gtin_barcode en busqueda).
  it('filtra por fragmento de EAN/GTIN (ADR-066 review)', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Test' });
    const imp = db.select().from(schema.impuesto).get()!;
    const p = productoCreateHandler(db, {
      nombre_corto: 'Cinta aisladora', categoria_id: cat.id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100,
      gtin_barcode: '7791234567890',
    });
    const rows = productoQueryAll(db, { busqueda: '123456' });
    expect(rows.some(r => r.id === p.id)).toBe(true);
  });
});

describe('stockQueryAll', () => {
  it('devuelve productos activos con datos de existencias', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Test' });
    const imp = db.select().from(schema.impuesto).get()!;
    productoCreateHandler(db, {
      nombre_corto: 'Producto A', categoria_id: cat.id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100,
    });
    const rows = stockQueryAll(db, {});
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty('stock_fisico');
    expect(rows[0]).toHaveProperty('precio_costo_promedio');
  });
});

describe('ubicacionQueryAll', () => {
  it('devuelve ubicaciones activas con cantidad_productos', () => {
    ubicacionCreateHandler(db, { sector: 'A', estante: '01', posicion: '01' });
    const rows = ubicacionQueryAll(db);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty('cantidad_productos');
    expect(typeof rows[0].cantidad_productos).toBe('number');
  });
});

describe('proveedorQueryAll', () => {
  it('devuelve proveedores activos con campos requeridos', () => {
    proveedorUpsertHandler(db, {
      tipo_documento: 'CUIT', numero_documento: '20123456789',
      razon_social: 'Prov SA', condicion_fiscal: 'Responsable Inscripto',
      telefono: '011-1234', email: 'prov@test.com',
    });
    const rows = proveedorQueryAll(db);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows.find(r => r.razon_social === 'Prov SA')!;
    expect(row.numero_documento).toBe('20123456789');
    expect(row.condicion_fiscal).toBe('Responsable Inscripto');
    expect(row.telefono).toBe('011-1234');
    expect(row.activo).toBe(true);
  });
});

describe('clienteQueryAll', () => {
  it('devuelve clientes activos con saldo_cuenta = 0 (R3)', () => {
    clienteUpsertHandler(db, {
      tipo_documento: 'DNI', numero_documento: '12345678',
      nombre: 'Juan', apellido: 'Test', condicion_fiscal: 'Consumidor Final',
    });
    const rows = clienteQueryAll(db);
    const row = rows.find(r => r.nombre === 'Juan' && r.apellido === 'Test')!;
    expect(row).toBeDefined();
    expect(row.saldo_cuenta).toBe(0);
  });
});

describe('ventaQueryAll', () => {
  function setup() {
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod = productoCreateHandler(db, {
      nombre_corto: 'Tornillo', categoria_id: cat.id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 1000,
    });
    stockEntradaHandler(db, { producto_id: prod.id, cantidad: 10 });
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CF_ID,
      lineas: [{ producto_id: prod.id, descripcion: 'Tornillo', cantidad: 1,
        precio_unitario: 1000, descuento_linea: 0, alicuota_iva: 21, subtotal: 1000 }],
      descuento_global: 0, subtotal: 1000, importe_iva: 165.29,
      total: 1000, ajuste_redondeo: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 100000 }],
    });
    return { prod, caja };
  }

  it('devuelve ventas con cliente_nombre y cajero_nombre', () => {
    setup();
    const rows = ventaQueryAll(db);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0];
    expect(row).toHaveProperty('numero_interno');
    expect(row).toHaveProperty('cliente_nombre');
    expect(row).toHaveProperty('cajero_nombre');
    expect(row).toHaveProperty('total');
    expect(row.estado).toBe('confirmada');
  });

  it('filtra por estado', () => {
    setup();
    const confirmadas = ventaQueryAll(db, { estado: 'confirmada' });
    const anuladas = ventaQueryAll(db, { estado: 'anulada' });
    expect(confirmadas.length).toBeGreaterThanOrEqual(1);
    expect(anuladas.length).toBe(0);
  });
});

describe('ventaDetalladoQueryAll', () => {
  it('devuelve una fila por línea de venta con sku y descripcion', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod = productoCreateHandler(db, {
      nombre_corto: 'Tornillo', categoria_id: cat.id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 1000,
    });
    stockEntradaHandler(db, { producto_id: prod.id, cantidad: 10 });
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CF_ID,
      lineas: [{ producto_id: prod.id, descripcion: 'Tornillo', cantidad: 2,
        precio_unitario: 1000, descuento_linea: 0, alicuota_iva: 21, subtotal: 2000 }],
      descuento_global: 0, subtotal: 2000, importe_iva: 330.58,
      total: 2000, ajuste_redondeo: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 200000 }],
    });
    const rows = ventaDetalladoQueryAll(db);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0];
    expect(typeof row.sku).toBe('string');
    expect(row.descripcion).toBe('Tornillo');
    expect(row.cantidad).toBe(2);
  });
});

describe('categoriaQueryAll', () => {
  it('devuelve categorías activas con el nombre de la categoría padre resuelto', () => {
    const padre = categoriaCreateHandler(db, { nombre: 'Herramientas' });
    categoriaCreateHandler(db, { nombre: 'Amoladoras', categoria_padre_id: padre.id });
    const rows = categoriaQueryAll(db);
    const hija = rows.find(r => r.nombre === 'Amoladoras')!;
    expect(hija.categoria_padre).toBe('Herramientas');
    const raiz = rows.find(r => r.nombre === 'Herramientas')!;
    expect(raiz.categoria_padre).toBeNull();
  });
});

describe('marcaQueryAll', () => {
  it('devuelve marcas activas con nombre y descripción', () => {
    marcaCreateHandler(db, { nombre: 'MarcaExportTest', descripcion: 'Herramientas eléctricas' });
    const row = marcaQueryAll(db).find(r => r.nombre === 'MarcaExportTest')!;
    expect(row).toBeDefined();
    expect(row.descripcion).toBe('Herramientas eléctricas');
    expect(row.activo).toBe(true);
  });
});

describe('unidadQueryAll', () => {
  it('devuelve unidades activas con abreviatura', () => {
    unidadCreateHandler(db, { nombre: 'UnidadExportTest', abreviatura: 'uxt' });
    const row = unidadQueryAll(db).find(r => r.nombre === 'UnidadExportTest')!;
    expect(row).toBeDefined();
    expect(row.abreviatura).toBe('uxt');
  });
});

describe('sinonimoQueryAll', () => {
  it('devuelve un renglón por término del grupo, con rubro y flags', () => {
    sinonimoGrupoCreateHandler(db, {
      canonico: 'alicate', sinonimos: ['pinza'], abreviaturas: ['alic.'], rubro: 'Herramientas',
    });
    const rows = sinonimoQueryAll(db);
    const canonico = rows.find(r => r.termino === 'alicate')!;
    expect(canonico).toBeDefined();
    expect(canonico.rubro).toBe('Herramientas');
    expect(canonico.es_canonico).toBe(true);
    expect(rows.some(r => r.es_abreviatura)).toBe(true);
  });
});

describe('transportistaQueryAll', () => {
  it('devuelve transportistas activos con contacto', () => {
    transportistaUpsertHandler(db, {
      razon_social: 'Transportes SA', telefono: '011-9999', email: 't@test.com', persona_contacto: 'Ana',
    });
    const row = transportistaQueryAll(db).find(r => r.razon_social === 'Transportes SA')!;
    expect(row).toBeDefined();
    expect(row.persona_contacto).toBe('Ana');
    expect(row.telefono).toBe('011-9999');
  });
});

describe('remitos / presupuestos queryAll (reusan el list handler)', () => {
  it('remitoListarHandler devuelve un array (vacío sin datos)', () => {
    expect(Array.isArray(remitoListarHandler(db))).toBe(true);
  });
  it('presupuestoListarHandler devuelve un array (vacío sin datos)', () => {
    expect(Array.isArray(presupuestoListarHandler(db))).toBe(true);
  });
});

describe('cajaArqueosQueryAll', () => {
  it('devuelve cajas con turno correlativo y cajero_nombre', () => {
    const caja1 = cajaAbrirHandler(db, { monto_inicial: 100 });
    cajaCerrarHandler(db, { caja_id: caja1.id, monto_contado: 100 });

    clearSession();
    loginAsAdmin(db);
    const caja2 = cajaAbrirHandler(db, { monto_inicial: 200 });
    cajaCerrarHandler(db, { caja_id: caja2.id, monto_contado: 200 });

    const rows = cajaArqueosQueryAll(db);
    expect(rows.length).toBe(2);
    expect(rows[0].turno).toBe(1);
    expect(rows[1].turno).toBe(2);
    expect(typeof rows[0].cajero_nombre).toBe('string');
    expect(rows[0].monto_inicial).toBe(100);
    expect(rows[1].monto_inicial).toBe(200);
  });
});
