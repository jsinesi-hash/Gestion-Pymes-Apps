import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatSku } from '@ferreteria/shared';
import { setSession, requirePermission } from '@core/main';
import { csvToRows, validarProductos, confirmarProductos, validarClientes, confirmarClientes, validarProveedores, confirmarProveedores, validarUbicaciones, confirmarUbicaciones, validarStockInicial, confirmarStockInicial, getPlantilla, validarFilaUnica, plantillaInfoHandler } from '../importar';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { marcaCreateHandler } from '../marca';
import { ubicacionCreateHandler } from '../ubicacion';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';

describe('csvToRows', () => {
  // Lector único (@ferreteria/shared `leerCsv`): antes no manejaba BOM ni saltos de línea en comillas.
  it('quita el BOM que agrega Excel (el encabezado de la primera columna debe coincidir)', () => {
    expect(csvToRows('\uFEFFnombre;precio\nTornillo;100')[0]).toEqual(['nombre', 'precio']);
  });
  it('un salto de línea dentro de comillas no parte la fila', () => {
    expect(csvToRows('n;d\nTornillo;"línea1\nlínea2"')).toEqual([['n', 'd'], ['Tornillo', 'línea1\nlínea2']]);
  });
  it('parsea CSV simple', () => {
    expect(csvToRows('nombre,precio\nTornillo,100')).toEqual([
      ['nombre', 'precio'], ['Tornillo', '100'],
    ]);
  });
  it('normaliza CRLF', () => {
    expect(csvToRows('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('soporta campos entre comillas con comas', () => {
    expect(csvToRows('n,d\n"Tornillo, galv",det')).toEqual([
      ['n', 'd'], ['Tornillo, galv', 'det'],
    ]);
  });
  it('omite líneas vacías', () => {
    expect(csvToRows('a,b\n\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('retorna [] para texto vacío', () => {
    expect(csvToRows('')).toEqual([]);
  });
  it('trim de espacios en valores', () => {
    expect(csvToRows('a, b\n 1 , 2 ')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('auto-detecta separador ; cuando el header usa ;', () => {
    expect(csvToRows('nombre;precio\nTornillo;100')).toEqual([
      ['nombre', 'precio'], ['Tornillo', '100'],
    ]);
  });
  it('parsea valores con ; entre comillas cuando separador es ,', () => {
    expect(csvToRows('nombre,descripcion\nTornillo,"Punta; galv"')).toEqual([
      ['nombre', 'descripcion'], ['Tornillo', 'Punta; galv'],
    ]);
  });
  it('parsea valores con , entre comillas cuando separador es ;', () => {
    expect(csvToRows('nombre;descripcion\nTornillo;"Rosca, galv"')).toEqual([
      ['nombre', 'descripcion'], ['Tornillo', 'Rosca, galv'],
    ]);
  });
});

describe('validarProductos', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
  });

  function catId() {
    return categoriaCreateHandler(db, { nombre: 'Herramientas' }).id;
  }

  function seedProducto(over: Partial<Record<string, unknown>> = {}) {
    const imp = db.select().from(schema.impuesto).get()!;
    const cat = db.select().from(schema.categoria).get()!;
    const now = new Date();
    const sync = { version: 1 as const, origin_id: 'C1', sync_state: 'pending' as const, updated_at: now };
    const id = (over.id as string) ?? 'prod-seed-1';
    db.insert(schema.producto).values({
      id, sku: (over.sku as string) ?? 'P-0000001-9', sku_secuencial: 1,
      gtin_barcode: (over.gtin_barcode as string | null) ?? null,
      nombre_corto: (over.nombre_corto as string) ?? 'Martillo',
      nombre_corto_norm: (over.nombre_corto_norm as string) ?? 'martillo',
      nombre_largo: 'Martillo', unidad_venta: 'u',
      precio_venta_lista: 1500, precio_costo_promedio: 0,
      impuesto_id: imp.id, categoria_id: cat.id,
      marca_id: (over.marca_id as string | null) ?? null,
      activo: true, moneda: 'ARS', factor_conversion: 1, permite_fraccion: false,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    db.insert(schema.existencias).values({
      id: `ex-${id}`, producto_id: id, stock_fisico: 0, ...sync,
    }).run();
    return id;
  }

  it('ADR-065: sku existente en la plantilla => update por SKU', () => {
    catId();
    seedProducto({ sku: 'P-0000001-9' });
    const csv = 'sku,nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nP-0000001-9,Martillo v2,u,1800,21,Herramientas';
    const preview = validarProductos(db, { csv });
    expect(preview.rows[0].status).toBe('update');
    expect(preview.rows[0].matchKey).toContain('SKU P-0000001-9');
  });

  it('ADR-065: sku inexistente => error SKU_INEXISTENTE (no alta silenciosa)', () => {
    catId();
    const csv = 'sku,nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nP-9999999-9,Martillo,u,1800,21,Herramientas';
    const preview = validarProductos(db, { csv });
    expect(preview.rows[0].status).toBe('error');
    expect(preview.rows[0].error).toMatch(/SKU_INEXISTENTE/);
  });

  it('ADR-065: fila sin EAN cuyo nombre ya existe en BD => POSIBLE_DUPLICADO', () => {
    catId();
    seedProducto({ nombre_corto: 'Martillo', nombre_corto_norm: 'martillo' });
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nMartillo,u,1500,21,Herramientas';
    const preview = validarProductos(db, { csv });
    expect(preview.rows[0].status).toBe('error');
    expect(preview.rows[0].error).toMatch(/POSIBLE_DUPLICADO/);
  });

  it('ADR-065: nombre repetido dentro del mismo archivo => segunda fila POSIBLE_DUPLICADO', () => {
    catId();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\n'
      + 'Taladro,u,5000,21,Herramientas\n'
      + 'Taladro,u,5000,21,Herramientas';
    const preview = validarProductos(db, { csv });
    expect(preview.rows[0].status).toBe('ok');
    expect(preview.rows[1].status).toBe('error');
    expect(preview.rows[1].error).toMatch(/POSIBLE_DUPLICADO/);
  });

  it('ADR-065: nombre nuevo, sin EAN, sin dup => ok (alta)', () => {
    catId();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nPinza,u,900,21,Herramientas';
    const preview = validarProductos(db, { csv });
    expect(preview.rows[0].status).toBe('ok');
    expect(preview.rows[0].skuPreview).toBe('auto');
  });

  it('marca fila nueva como ok y skuPreview=auto', () => {
    catId();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nMartillo,u,1500,21,Herramientas';
    const result = validarProductos(db, { csv });
    expect(result.stats).toEqual({ ok: 1, update: 0, error: 0 });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].skuPreview).toBe('auto');
  });

  it('marca fila como update cuando gtin_barcode existe', () => {
    catId();
    const imp = db.select().from(schema.impuesto).get()!;
    const cat = db.select().from(schema.categoria).get()!;
    const now = new Date();
    const sync = { version: 1 as const, origin_id: 'C1', sync_state: 'pending' as const, updated_at: now };
    db.insert(schema.producto).values({
      id: 'prod-1', sku: 'P-0000001-9', sku_secuencial: 1,
      gtin_barcode: '7891234560001',
      nombre_corto: 'Martillo', nombre_largo: 'Martillo',
      unidad_venta: 'u', precio_venta_lista: 1500, precio_costo_promedio: 0,
      impuesto_id: imp.id, categoria_id: cat.id,
      activo: true, moneda: 'ARS', factor_conversion: 1, permite_fraccion: false,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,codigo_barras\nMartillo v2,u,1800,21,Herramientas,7891234560001';
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('update');
    expect(result.rows[0].matchKey).toContain('EAN 7891234560001');
  });

  it('error si rubro no existe', () => {
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nMartillo,u,1500,21,Inexistente';
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/Rubro/);
  });

  it('error si nombre falta', () => {
    catId();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\n,u,1500,21,Herramientas';
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/nombre/);
  });

  it('error si precio no es número', () => {
    catId();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nMartillo,u,abc,21,Herramientas';
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
  });

  it('error si iva_alicuota es inválido', () => {
    catId();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nMartillo,u,1500,15,Herramientas';
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/iva_alicuota/);
  });

  it('error si codigo_barras duplicado dentro del archivo', () => {
    catId();
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,codigo_barras',
      'Tornillo,u,100,21,Herramientas,7891234560001',
      'Tuerca,u,200,21,Herramientas,7891234560001',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[1].status).toBe('error');
    expect(result.rows[1].error).toMatch(/duplicad/i);
  });

  it('importa filas válidas aunque otras fallen', () => {
    catId();
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro',
      'Buena,u,100,21,Herramientas',
      ',u,200,21,Herramientas',
      'Otra buena,u,300,21,Herramientas',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.stats).toEqual({ ok: 2, update: 0, error: 1 });
  });

  it('ADR-065: activo="si" marca el producto como ACTIVO (no invisible)', () => {
    catId();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,activo\nMartillo,u,1500,21,Herramientas,si';
    const preview = validarProductos(db, { csv });
    expect(preview.rows[0].status).toBe('ok');
    expect(preview.rows[0].data!.activo).toBe(true);
  });

  it('ADR-065: activo="no" marca el producto como inactivo', () => {
    catId();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,activo\nMartillo,u,1500,21,Herramientas,no';
    const preview = validarProductos(db, { csv });
    expect(preview.rows[0].data!.activo).toBe(false);
  });

  it('ADR-065: token booleano no reconocido en activo => error de fila', () => {
    catId();
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,activo\nMartillo,u,1500,21,Herramientas,tal vez';
    const preview = validarProductos(db, { csv });
    expect(preview.rows[0].status).toBe('error');
    expect(preview.rows[0].error).toMatch(/activo/);
  });
});

describe('confirmarProductos', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
  });

  function buildValidRow(overrides: Record<string, unknown> = {}): import('../importar').ImportRowResult {
    const cat = categoriaCreateHandler(db, { nombre: 'Test' });
    const imp = db.select().from(schema.impuesto).get()!;
    return {
      fila: 2, status: 'ok',
      data: { nombre: 'Tornillo', categoria_id: cat.id, impuesto_id: imp.id, precio_venta_lista: 500, unidad_venta: 'u', gtin_barcode: null, costo: 0, stock_minimo: 0, activo: true, ...overrides },
    };
  }

  it('crea producto con SKU autogenerado y Existencias (ADR-025)', () => {
    const result = confirmarProductos(db, { rows: [buildValidRow()] });
    expect(result.stats.created).toBe(1);
    const prods = db.select().from(schema.producto).all();
    expect(prods).toHaveLength(1);
    expect(prods[0].sku).toBe(formatSku(1));
    expect(prods[0].sku_secuencial).toBe(1);
    const exist = db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, prods[0].id)).get();
    expect(exist?.stock_fisico).toBe(0);
  });

  it('aplica stock_minimo y costo al crear', () => {
    const result = confirmarProductos(db, { rows: [buildValidRow({ stock_minimo: 5, costo: 200 })] });
    expect(result.stats.created).toBe(1);
    const prod = db.select().from(schema.producto).get()!;
    expect(prod.precio_costo_promedio).toBe(200);
    const exist = db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, prod.id)).get();
    expect(exist?.stock_minimo).toBe(5);
  });

  it('actualiza producto existente (update)', () => {
    const row = buildValidRow();
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).get()!;
    const updateRow: import('../importar').ImportRowResult = {
      fila: 2, status: 'update',
      data: { ...row.data, id: prod.id, precio_venta_lista: 999 },
      matchKey: `SKU ${prod.sku}`,
    };
    const result = confirmarProductos(db, { rows: [updateRow] });
    expect(result.stats.updated).toBe(1);
    const updated = db.select().from(schema.producto).get()!;
    expect(updated.precio_venta_lista).toBe(999);
  });

  it('continúa con siguientes filas si una falla en DB', () => {
    const good = buildValidRow({ nombre: 'Bueno' });
    const bad: import('../importar').ImportRowResult = { fila: 3, status: 'ok', data: { nombre: null } };
    const good2 = buildValidRow({ nombre: 'Bueno2' });
    const result = confirmarProductos(db, { rows: [good, bad, good2] });
    expect(result.stats.created).toBe(2);
    expect(result.stats.error).toBe(1);
  });
});

describe('validarClientes', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  const CSV_OK = 'tipo_documento,numero_documento,nombre,condicion_fiscal\nDNI,12345678,Juan,Consumidor Final';
  const CSV_UPD = 'tipo_documento,numero_documento,nombre,condicion_fiscal\nDNI,12345678,Juan Actualizado,Consumidor Final';

  it('marca como ok cuando numero_documento no existe', () => {
    const result = validarClientes(db, { csv: CSV_OK });
    expect(result.rows[0].status).toBe('ok');
  });

  it('marca como update cuando numero_documento ya existe', () => {
    confirmarClientes(db, { rows: validarClientes(db, { csv: CSV_OK }).rows });
    const result = validarClientes(db, { csv: CSV_UPD });
    expect(result.rows[0].status).toBe('update');
  });

  it('error si tipo_documento es inválido', () => {
    const csv = 'tipo_documento,numero_documento,nombre,condicion_fiscal\nPASAPORTE,12345678,Juan,Consumidor Final';
    const result = validarClientes(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/tipo_documento/);
  });

  it('error si faltan campos obligatorios (nombre)', () => {
    const csv = 'tipo_documento,numero_documento,nombre,condicion_fiscal\nDNI,12345678,,Consumidor Final';
    const result = validarClientes(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/nombre/);
  });

  it('error si falta numero_documento', () => {
    const csv = 'tipo_documento,numero_documento,nombre,condicion_fiscal\nDNI,,Juan,Consumidor Final';
    const result = validarClientes(db, { csv });
    expect(result.rows[0].status).toBe('error');
  });

  it('no exige apellido — columna ausente no genera error', () => {
    const result = validarClientes(db, { csv: CSV_OK });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.apellido).toBeNull();
  });

  it('data incluye apellido cuando la columna está presente y tiene valor', () => {
    const csv = 'tipo_documento,numero_documento,nombre,apellido,condicion_fiscal\nDNI,12345678,Juan,Perez,Consumidor Final';
    const result = validarClientes(db, { csv });
    expect(result.rows[0].data?.apellido).toBe('Perez');
  });

  it('data incluye campos de domicilio opcionales cuando están presentes', () => {
    const csv = [
      'tipo_documento,numero_documento,nombre,condicion_fiscal,telefono_adicional,calle,numero,aclaracion,codigo_postal,localidad,provincia',
      'DNI,12345678,Juan,Consumidor Final,11-4444-5555,Av. Siempreviva,742,Depto 4,5500,Godoy Cruz,Mendoza',
    ].join('\n');
    const result = validarClientes(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data).toMatchObject({
      telefono_adicional: '11-4444-5555',
      calle: 'Av. Siempreviva',
      numero: '742',
      aclaracion: 'Depto 4',
      codigo_postal: '5500',
      localidad: 'Godoy Cruz',
      provincia: 'Mendoza',
    });
  });
});

describe('confirmarClientes', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  it('crea cliente nuevo sin apellido en el CSV — usa el placeholder "(revisar)"', () => {
    const csv = 'tipo_documento,numero_documento,nombre,condicion_fiscal\nDNI,12345678,Juan Perez,Consumidor Final';
    const preview = validarClientes(db, { csv });
    const result = confirmarClientes(db, { rows: preview.rows });
    expect(result.stats.created).toBe(1);
    const cliente = db.select().from(schema.cliente)
      .where(eq(schema.cliente.numero_documento, '12345678')).get();
    expect(cliente).toBeDefined();
    expect(cliente!.nombre).toBe('Juan Perez');
    expect(cliente!.apellido).toBe('(revisar)');
  });

  it('crea cliente nuevo con apellido en el CSV — usa el valor provisto', () => {
    const csv = 'tipo_documento,numero_documento,nombre,apellido,condicion_fiscal\nDNI,87654321,Juan,Perez,Consumidor Final';
    const preview = validarClientes(db, { csv });
    confirmarClientes(db, { rows: preview.rows });
    const cliente = db.select().from(schema.cliente)
      .where(eq(schema.cliente.numero_documento, '87654321')).get();
    expect(cliente!.apellido).toBe('Perez');
  });

  it('UPDATE de cliente existente sin apellido en el CSV — NO pisa el apellido ya corregido a mano', () => {
    // Alta inicial sin apellido -> queda con el placeholder.
    const csvAlta = 'tipo_documento,numero_documento,nombre,condicion_fiscal\nDNI,11112222,Juan,Consumidor Final';
    confirmarClientes(db, { rows: validarClientes(db, { csv: csvAlta }).rows });
    // El usuario corrige el apellido a mano en la BD (simulado directamente).
    db.update(schema.cliente).set({ apellido: 'Fernandez' })
      .where(eq(schema.cliente.numero_documento, '11112222')).run();

    // Reimportación del mismo documento, CSV sin columna apellido.
    const csvReimport = 'tipo_documento,numero_documento,nombre,condicion_fiscal\nDNI,11112222,Juan Actualizado,Consumidor Final';
    const preview = validarClientes(db, { csv: csvReimport });
    expect(preview.rows[0].status).toBe('update');
    const result = confirmarClientes(db, { rows: preview.rows });
    expect(result.stats.updated).toBe(1);

    const cliente = db.select().from(schema.cliente)
      .where(eq(schema.cliente.numero_documento, '11112222')).get();
    expect(cliente!.nombre).toBe('Juan Actualizado');
    expect(cliente!.apellido).toBe('Fernandez');
  });

  it('UPDATE de cliente existente con apellido en el CSV — actualiza al nuevo valor', () => {
    const csvAlta = 'tipo_documento,numero_documento,nombre,apellido,condicion_fiscal\nDNI,33334444,Juan,Perez,Consumidor Final';
    confirmarClientes(db, { rows: validarClientes(db, { csv: csvAlta }).rows });

    const csvReimport = 'tipo_documento,numero_documento,nombre,apellido,condicion_fiscal\nDNI,33334444,Juan,Gonzalez,Consumidor Final';
    const preview = validarClientes(db, { csv: csvReimport });
    confirmarClientes(db, { rows: preview.rows });

    const cliente = db.select().from(schema.cliente)
      .where(eq(schema.cliente.numero_documento, '33334444')).get();
    expect(cliente!.apellido).toBe('Gonzalez');
  });

  it('persiste campos de domicilio y telefono_adicional', () => {
    const csv = [
      'tipo_documento,numero_documento,nombre,condicion_fiscal,telefono_adicional,calle,numero,aclaracion,codigo_postal,localidad,provincia',
      'DNI,55556666,Juan,Consumidor Final,11-4444-5555,Av. Siempreviva,742,Depto 4,5500,Godoy Cruz,Mendoza',
    ].join('\n');
    const preview = validarClientes(db, { csv });
    confirmarClientes(db, { rows: preview.rows });
    const cliente = db.select().from(schema.cliente)
      .where(eq(schema.cliente.numero_documento, '55556666')).get();
    expect(cliente).toMatchObject({
      telefono_adicional: '11-4444-5555',
      calle: 'Av. Siempreviva',
      numero: '742',
      aclaracion: 'Depto 4',
      codigo_postal: '5500',
      localidad: 'Godoy Cruz',
      provincia: 'Mendoza',
    });
  });

  it('UPDATE de cliente existente sin columnas de domicilio en el CSV — NO pisa el domicilio ya guardado', () => {
    const csvAlta = [
      'tipo_documento,numero_documento,nombre,condicion_fiscal,telefono_adicional,calle,numero,aclaracion,codigo_postal,localidad,provincia',
      'DNI,77778888,Juan,Consumidor Final,11-4444-5555,Av. Siempreviva,742,Depto 4,5500,Godoy Cruz,Mendoza',
    ].join('\n');
    confirmarClientes(db, { rows: validarClientes(db, { csv: csvAlta }).rows });

    // Reimportación con un CSV que NO trae ninguna columna de domicilio/contacto.
    const csvReimport = 'tipo_documento,numero_documento,nombre,condicion_fiscal\nDNI,77778888,Juan Actualizado,Consumidor Final';
    const preview = validarClientes(db, { csv: csvReimport });
    expect(preview.rows[0].status).toBe('update');
    confirmarClientes(db, { rows: preview.rows });

    const cliente = db.select().from(schema.cliente)
      .where(eq(schema.cliente.numero_documento, '77778888')).get();
    expect(cliente!.nombre).toBe('Juan Actualizado');
    expect(cliente).toMatchObject({
      telefono_adicional: '11-4444-5555',
      calle: 'Av. Siempreviva',
      numero: '742',
      aclaracion: 'Depto 4',
      codigo_postal: '5500',
      localidad: 'Godoy Cruz',
      provincia: 'Mendoza',
    });
  });
});

describe('validarProveedores', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  it('marca como ok cuando proveedor no existe', () => {
    const csv = 'tipo_documento,numero_documento,razon_social,condicion_fiscal\nCUIT,30712345678,Aceros SA,Responsable Inscripto';
    const result = validarProveedores(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.stats.ok).toBe(1);
  });

  it('marca como update cuando numero_documento ya existe', () => {
    const csv = 'tipo_documento,numero_documento,razon_social,condicion_fiscal\nCUIT,30712345678,Aceros SA,Responsable Inscripto';
    confirmarProveedores(db, { rows: validarProveedores(db, { csv }).rows });
    const result = validarProveedores(db, { csv });
    expect(result.rows[0].status).toBe('update');
  });

  it('error si tipo_documento inválido', () => {
    const csv = 'tipo_documento,numero_documento,razon_social,condicion_fiscal\nPASAPORTE,30712345678,Aceros SA,RI';
    expect(validarProveedores(db, { csv }).rows[0].status).toBe('error');
  });

  it('data incluye campos de domicilio opcionales cuando están presentes', () => {
    const csv = [
      'tipo_documento,numero_documento,razon_social,condicion_fiscal,telefono_adicional,calle,numero,aclaracion,codigo_postal,localidad,provincia',
      'CUIT,30712345678,Aceros SA,Responsable Inscripto,11-4444-5555,Av. Siempreviva,742,Depto 4,5500,Godoy Cruz,Mendoza',
    ].join('\n');
    const result = validarProveedores(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data).toMatchObject({
      telefono_adicional: '11-4444-5555',
      calle: 'Av. Siempreviva',
      numero: '742',
      aclaracion: 'Depto 4',
      codigo_postal: '5500',
      localidad: 'Godoy Cruz',
      provincia: 'Mendoza',
    });
  });

  it('ok con codigo provisto cuando no colisiona con otro proveedor', () => {
    const csv = 'tipo_documento,numero_documento,razon_social,condicion_fiscal,codigo\nCUIT,30712345678,Aceros SA,Responsable Inscripto,PROV-0099';
    const result = validarProveedores(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.codigo).toBe('PROV-0099');
  });

  it('error si codigo duplicado dentro del archivo', () => {
    const csv = [
      'tipo_documento,numero_documento,razon_social,condicion_fiscal,codigo',
      'CUIT,30712345678,Aceros SA,Responsable Inscripto,PROV-0099',
      'CUIT,30799999999,Otro SA,Responsable Inscripto,PROV-0099',
    ].join('\n');
    const result = validarProveedores(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[1].status).toBe('error');
    expect(result.rows[1].error).toMatch(/codigo.*duplicad/i);
  });

  it('error si codigo ya está en uso por otro proveedor existente en la BD', () => {
    const csvExistente = 'tipo_documento,numero_documento,razon_social,condicion_fiscal,codigo\nCUIT,30111111111,Existente SA,Responsable Inscripto,PROV-0050';
    confirmarProveedores(db, { rows: validarProveedores(db, { csv: csvExistente }).rows });

    const csvColision = 'tipo_documento,numero_documento,razon_social,condicion_fiscal,codigo\nCUIT,30222222222,Nuevo SA,Responsable Inscripto,PROV-0050';
    const result = validarProveedores(db, { csv: csvColision });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/codigo/i);
  });

  it('permite reimportar el mismo proveedor conservando su propio codigo (update, no colisión)', () => {
    const csv = 'tipo_documento,numero_documento,razon_social,condicion_fiscal,codigo\nCUIT,30333333333,Original SA,Responsable Inscripto,PROV-0077';
    confirmarProveedores(db, { rows: validarProveedores(db, { csv }).rows });

    const csvUpd = 'tipo_documento,numero_documento,razon_social,condicion_fiscal,codigo\nCUIT,30333333333,Original SA Actualizada,Responsable Inscripto,PROV-0077';
    const result = validarProveedores(db, { csv: csvUpd });
    expect(result.rows[0].status).toBe('update');
  });
});

describe('confirmarProveedores', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  it('crea proveedor nuevo', () => {
    const csv = 'tipo_documento,numero_documento,razon_social,condicion_fiscal\nCUIT,30712345678,Aceros SA,Responsable Inscripto';
    const preview = validarProveedores(db, { csv });
    const result = confirmarProveedores(db, { rows: preview.rows });
    expect(result.stats.created).toBe(1);
    const prov = db.select().from(schema.proveedor)
      .where(eq(schema.proveedor.numero_documento, '30712345678')).get();
    expect(prov).toBeDefined();
    expect(prov!.razon_social).toBe('Aceros SA');
  });

  it('persiste codigo y campos de domicilio', () => {
    const csv = [
      'tipo_documento,numero_documento,razon_social,condicion_fiscal,codigo,telefono_adicional,calle,numero,aclaracion,codigo_postal,localidad,provincia',
      'CUIT,30888888888,Aceros SA,Responsable Inscripto,PROV-0088,11-4444-5555,Av. Siempreviva,742,Depto 4,5500,Godoy Cruz,Mendoza',
    ].join('\n');
    const preview = validarProveedores(db, { csv });
    confirmarProveedores(db, { rows: preview.rows });
    const prov = db.select().from(schema.proveedor)
      .where(eq(schema.proveedor.numero_documento, '30888888888')).get();
    expect(prov).toMatchObject({
      codigo: 'PROV-0088',
      telefono_adicional: '11-4444-5555',
      calle: 'Av. Siempreviva',
      numero: '742',
      aclaracion: 'Depto 4',
      codigo_postal: '5500',
      localidad: 'Godoy Cruz',
      provincia: 'Mendoza',
    });
  });

  it('UPDATE de proveedor existente sin columnas de domicilio en el CSV — NO pisa el domicilio ya guardado', () => {
    const csvAlta = [
      'tipo_documento,numero_documento,razon_social,condicion_fiscal,codigo,telefono_adicional,calle,numero,aclaracion,codigo_postal,localidad,provincia',
      'CUIT,30999999999,Aceros SA,Responsable Inscripto,PROV-0099,11-4444-5555,Av. Siempreviva,742,Depto 4,5500,Godoy Cruz,Mendoza',
    ].join('\n');
    confirmarProveedores(db, { rows: validarProveedores(db, { csv: csvAlta }).rows });

    // Reimportación con un CSV que NO trae ninguna columna de domicilio/contacto ni codigo.
    const csvReimport = 'tipo_documento,numero_documento,razon_social,condicion_fiscal\nCUIT,30999999999,Aceros SA Actualizada,Responsable Inscripto';
    const preview = validarProveedores(db, { csv: csvReimport });
    expect(preview.rows[0].status).toBe('update');
    confirmarProveedores(db, { rows: preview.rows });

    const prov = db.select().from(schema.proveedor)
      .where(eq(schema.proveedor.numero_documento, '30999999999')).get();
    expect(prov!.razon_social).toBe('Aceros SA Actualizada');
    expect(prov).toMatchObject({
      codigo: 'PROV-0099',
      telefono_adicional: '11-4444-5555',
      calle: 'Av. Siempreviva',
      numero: '742',
      aclaracion: 'Depto 4',
      codigo_postal: '5500',
      localidad: 'Godoy Cruz',
      provincia: 'Mendoza',
    });
  });

  it('NO agrega los defaults comerciales (bonificacion/costo financiero/flete) via importación', () => {
    const csv = 'tipo_documento,numero_documento,razon_social,condicion_fiscal\nCUIT,30777777777,Aceros SA,Responsable Inscripto';
    const preview = validarProveedores(db, { csv });
    expect(preview.rows[0].data).not.toHaveProperty('bonificacion_pct_default');
    expect(preview.rows[0].data).not.toHaveProperty('costo_financiero_pct_default');
    expect(preview.rows[0].data).not.toHaveProperty('flete_pct_default');
    confirmarProveedores(db, { rows: preview.rows });
    const prov = db.select().from(schema.proveedor)
      .where(eq(schema.proveedor.numero_documento, '30777777777')).get();
    // Defaults del schema quedan en 0, la importación no los toca.
    expect(prov!.bonificacion_pct_default).toBe(0);
    expect(prov!.costo_financiero_pct_default).toBe(0);
    expect(prov!.flete_pct_default).toBe(0);
  });
});

describe('validarUbicaciones', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  it('marca como ok cuando sector+estante+posicion no existe', () => {
    const csv = 'sector,estante,posicion,descripcion\nA,04,22,Tornillos';
    expect(validarUbicaciones(db, { csv }).rows[0].status).toBe('ok');
  });

  it('marca como update cuando la ubicacion ya existe', () => {
    const csv = 'sector,estante,posicion,descripcion\nA,04,22,Tornillos';
    confirmarUbicaciones(db, { rows: validarUbicaciones(db, { csv }).rows });
    const result = validarUbicaciones(db, { csv: 'sector,estante,posicion,descripcion\nA,04,22,Tuercas' });
    expect(result.rows[0].status).toBe('update');
    // Forma canónica (ADR-064): estante '04' pierde el cero a la izquierda -> 'A-4-22'.
    expect(result.rows[0].matchKey).toBe('A-4-22');
  });

  it('error si falta sector', () => {
    const csv = 'sector,estante,posicion\n,04,22';
    expect(validarUbicaciones(db, { csv }).rows[0].status).toBe('error');
  });
});

describe('validarStockInicial', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  function crearProducto() {
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto).get()!;
    return productoCreateHandler(db, { nombre_corto: 'P', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100 });
  }

  it('ok cuando SKU existe y cantidad es positiva', () => {
    const prod = crearProducto();
    const csv = `sku,cantidad\n${prod.sku},10`;
    const result = validarStockInicial(db, { csv });
    expect(result.rows[0].status).toBe('ok');
  });

  it('error si SKU no existe', () => {
    const csv = 'sku,cantidad\n99999,10';
    expect(validarStockInicial(db, { csv }).rows[0].status).toBe('error');
  });

  it('error si cantidad no es número', () => {
    const prod = crearProducto();
    const csv = `sku,cantidad\n${prod.sku},abc`;
    expect(validarStockInicial(db, { csv }).rows[0].status).toBe('error');
  });
});

describe('confirmarStockInicial', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  it('crea MovimientoStock inicial y actualiza Existencias', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod = productoCreateHandler(db, { nombre_corto: 'P', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100 });
    const csv = `sku,cantidad\n${prod.sku},15`;
    const preview = validarStockInicial(db, { csv });
    const result = confirmarStockInicial(db, { rows: preview.rows });
    expect(result.stats.created).toBe(1);
    const exist = db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, prod.id)).get();
    expect(exist?.stock_fisico).toBe(15);
    const movs = db.select().from(schema.movimiento_stock).where(eq(schema.movimiento_stock.producto_id, prod.id)).all();
    // productoCreateHandler inserts an 'inicial' movement at stock 0; confirmarStockInicial adds another at stock 15
    const movImport = movs.find(m => m.stock_resultante === 15);
    expect(movImport).toBeDefined();
    expect(movImport!.motivo).toBe('inicial');
  });

  it('actualiza precio_costo_promedio con costo promedio ponderado', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod = productoCreateHandler(db, { nombre_corto: 'P', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100 });
    const csv = `sku,cantidad,costo_unitario\n${prod.sku},10,500`;
    const preview = validarStockInicial(db, { csv });
    confirmarStockInicial(db, { rows: preview.rows });
    const producto = db.select({ precio_costo_promedio: schema.producto.precio_costo_promedio }).from(schema.producto).where(eq(schema.producto.id, prod.id)).get();
    // CPP: (0 * 0 + 10 * 500) / 10 = 500
    expect(producto?.precio_costo_promedio).toBe(500);
  });
});


describe('Guard: import.masiva', () => {
  it('operador sin import.masiva recibe FORBIDDEN', async () => {
    clearSession();
    setSession(
      { userId: 'u2', rolId: 'operador', permisos: new Set([]) },
      { id: 'u2', nombreCompleto: 'Operador', rolId: 'operador', rolNombre: '', permisos: [], passwordDiasRestantes: 30, preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable', skin: 'actual', pantalla_inicio: null, favoritos: [] } },
    );
    const handler = requirePermission('import.masiva')(async () => 'ok');
    await expect(handler(null)).rejects.toMatchObject({ code: 'FORBIDDEN', permiso: 'import.masiva' });
  });
});

describe('validarProductos — marca y ubicación', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
    categoriaCreateHandler(db, { nombre: 'Herramientas' });
  });

  it('error si columna marca presente y marca no existe en BD', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,marca',
      'Martillo,u,1500,21,Herramientas,MarcaQueNoExisteEnSeed',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/Marca.*no existe/i);
  });

  it('ok si columna marca presente y marca existe en BD, data contiene marca_id', () => {
    // 'Stanley' ya está en la BD por el catalog seed — no hace falta crearla
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,marca',
      'Martillo,u,1500,21,Herramientas,Stanley',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.marca_id).toBeTruthy();
  });

  it('error si columna ubicacion presente y ubicacion no existe en BD', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,ubicacion',
      'Martillo,u,1500,21,Herramientas,A-01-01',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/Ubicaci[oó]n.*no existe/i);
  });

  it('ok si columna ubicacion presente y ubicacion existe en BD, data contiene ubicacion_id', () => {
    ubicacionCreateHandler(db, { sector: 'A', estante: '01', posicion: '01' });
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,ubicacion',
      // Forma canónica (ADR-064): sector A / estante 01 / posicion 01 -> 'A-1-1'.
      'Martillo,u,1500,21,Herramientas,A-1-1',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.ubicacion_id).toBeTruthy();
  });

  // ADR-075 — el match de ubicación en el import de productos canonicaliza ambos lados.
  it('matchea una ubicación legacy con código NO canónico (A-01-03) desde A-1-3', () => {
    // Fila legacy anterior a ADR-064: código guardado con ceros a la izquierda.
    // Se inserta directo (el handler de alta canonicaliza y no reproduciría el caso).
    const id = 'ubic-legacy-A-01-03';
    const admin = db.select({ id: schema.usuario.id }).from(schema.usuario)
      .where(eq(schema.usuario.nombre_usuario, 'admin')).get()!;
    db.insert(schema.ubicacion).values({
      id, codigo: 'A-01-03', sector: 'A', estante: '01', posicion: '03',
      activo: true, usuario_creacion_id: admin.id, fecha_creacion: new Date(),
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: new Date(),
    }).run();
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,ubicacion',
      'Martillo,u,1500,21,Herramientas,A-1-3',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.ubicacion_id).toBe(id);
  });

  it('matchea la ubicación sin distinguir mayúsculas/minúsculas (a-1-1 -> A-1-1)', () => {
    const ubic = ubicacionCreateHandler(db, { sector: 'A', estante: '01', posicion: '01' });
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,ubicacion',
      'Martillo,u,1500,21,Herramientas,a-1-1',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.ubicacion_id).toBe(ubic.id);
  });
});

describe('validarProductos — campos opcionales de stock y texto', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
    categoriaCreateHandler(db, { nombre: 'Herramientas' });
  });

  it('error si stock_inicial es negativo', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,stock_inicial',
      'Martillo,u,1500,21,Herramientas,-5',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/stock_inicial/);
  });

  it('error si stock_inicial no es número', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,stock_inicial',
      'Martillo,u,1500,21,Herramientas,abc',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/stock_inicial/);
  });

  it('error si stock_maximo no es número', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,stock_maximo',
      'Martillo,u,1500,21,Herramientas,xyz',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/stock_maximo/);
  });

  it('ok con stock_inicial y stock_maximo válidos, data los incluye', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,stock_inicial,stock_maximo',
      'Martillo,u,1500,21,Herramientas,10,100',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.stock_inicial).toBe(10);
    expect(result.rows[0].data?.stock_maximo).toBe(100);
  });

  it('data incluye nombre_largo, descripcion_tecnica y garantia_meses cuando las columnas están presentes', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,nombre_largo,descripcion_tecnica,garantia_meses',
      'Martillo,u,1500,21,Herramientas,Martillo carpintero 16oz,Mango fibra de vidrio,24',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.nombre_largo).toBe('Martillo carpintero 16oz');
    expect(result.rows[0].data?.descripcion_tecnica).toBe('Mango fibra de vidrio');
    expect(result.rows[0].data?.garantia_meses).toBe(24);
  });

  it('data incluye stock_actual en filas de update', () => {
    const imp = db.select().from(schema.impuesto).get()!;
    const cat = db.select().from(schema.categoria).get()!;
    const now = new Date();
    const sync = { version: 1 as const, origin_id: 'C1', sync_state: 'pending' as const, updated_at: now };
    db.insert(schema.producto).values({
      id: 'prod-upd', sku: 'P-0000001-9', sku_secuencial: 1,
      gtin_barcode: '7890000000001',
      nombre_corto: 'Martillo', nombre_largo: 'Martillo',
      unidad_venta: 'u', precio_venta_lista: 1500, precio_costo_promedio: 0,
      impuesto_id: imp.id, categoria_id: cat.id,
      activo: true, moneda: 'ARS', factor_conversion: 1, permite_fraccion: false,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    db.insert(schema.existencias).values({
      id: 'exist-upd', producto_id: 'prod-upd', stock_fisico: 30, stock_minimo: 0,
      ...sync,
    }).run();
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,codigo_barras',
      'Martillo v2,u,2000,21,Herramientas,7890000000001',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('update');
    expect(result.rows[0].data?.stock_actual).toBe(30);
  });
});

describe('confirmarProductos — nuevos campos en INSERT', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
  });

  function buildRowConCampos(
    overrides: Record<string, unknown> = {},
  ): import('../importar').ImportRowResult {
    const cat = categoriaCreateHandler(db, { nombre: 'Test' });
    const imp = db.select().from(schema.impuesto).get()!;
    return {
      fila: 2,
      status: 'ok',
      data: {
        nombre: 'Tornillo',
        categoria_id: cat.id,
        impuesto_id: imp.id,
        precio_venta_lista: 500,
        unidad_venta: 'u',
        gtin_barcode: null,
        costo: 0,
        stock_minimo: 0,
        activo: true,
        stock_inicial: 0,
        ...overrides,
      },
    };
  }

  it('crea producto con marca_id y ubicacion_id cuando se proveen en data', () => {
    const marca = marcaCreateHandler(db, { nombre: 'MarcaTestA' });
    const ubic = ubicacionCreateHandler(db, { sector: 'B', estante: '02', posicion: '05' });
    const row = buildRowConCampos({ marca_id: marca.id, ubicacion_id: ubic.id });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).get()!;
    expect(prod.marca_id).toBe(marca.id);
    expect(prod.ubicacion_id).toBe(ubic.id);
  });

  it('crea producto con nombre_largo, descripcion_tecnica y garantia_meses', () => {
    const row = buildRowConCampos({
      nombre_largo: 'Tornillo hexagonal M6 x 40mm',
      descripcion_tecnica: 'Acero inoxidable 316',
      garantia_meses: 12,
    });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).get()!;
    expect(prod.nombre_largo).toBe('Tornillo hexagonal M6 x 40mm');
    expect(prod.descripcion_tecnica).toBe('Acero inoxidable 316');
    expect(prod.garantia_meses).toBe(12);
  });

  it('nombre_largo default a nombre si no se provee en data', () => {
    const row = buildRowConCampos({ nombre: 'Tuerca M6' });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).get()!;
    expect(prod.nombre_largo).toBe('Tuerca M6');
  });

  it('crea producto con stock_maximo en existencias', () => {
    const row = buildRowConCampos({ stock_maximo: 200 });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).get()!;
    const exist = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prod.id)).get()!;
    expect(exist.stock_maximo).toBe(200);
  });

  it('crea MovimientoStock inicial y actualiza existencias cuando stock_inicial > 0', () => {
    const row = buildRowConCampos({ stock_inicial: 50, costo: 0 });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).get()!;
    const exist = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prod.id)).get()!;
    expect(exist.stock_fisico).toBe(50);
    const movs = db.select().from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.producto_id, prod.id)).all();
    const movInicial = movs.find(m => m.motivo === 'inicial' && m.stock_resultante === 50);
    expect(movInicial).toBeDefined();
    expect(movInicial!.tipo).toBe('entrada');
  });

  it('CPP es igual al costo cuando stock_inicial > 0 y costo > 0', () => {
    const row = buildRowConCampos({ stock_inicial: 20, costo: 350 });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).get()!;
    expect(prod.precio_costo_promedio).toBe(350);
  });

  it('mensaje de resumen incluye info de stock cuando stock_inicial > 0', () => {
    const row = buildRowConCampos({ stock_inicial: 10 });
    const result = confirmarProductos(db, { rows: [row] });
    expect(result.rows[0].mensaje).toMatch(/\+10/);
  });
});

describe('confirmarProductos — UPDATE con nuevos campos y stock condicional', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
  });

  function crearProductoBase(gtin: string) {
    const cat = categoriaCreateHandler(db, { nombre: 'TestUpdate' });
    const imp = db.select().from(schema.impuesto).get()!;
    const now = new Date();
    const sync = { version: 1 as const, origin_id: 'C1', sync_state: 'pending' as const, updated_at: now };
    const id = 'prod-base-' + gtin;
    db.insert(schema.producto).values({
      id, sku: 'P-0000010-5', sku_secuencial: 10,
      gtin_barcode: gtin,
      nombre_corto: 'Original', nombre_largo: 'Original',
      unidad_venta: 'u', precio_venta_lista: 100, precio_costo_promedio: 0,
      impuesto_id: imp.id, categoria_id: cat.id,
      activo: true, moneda: 'ARS', factor_conversion: 1, permite_fraccion: false,
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    db.insert(schema.existencias).values({
      id: 'exist-base-' + gtin, producto_id: id,
      stock_fisico: 0, stock_minimo: 0, ...sync,
    }).run();
    return id;
  }

  function buildUpdateRow(
    prodId: string,
    overrides: Record<string, unknown> = {},
  ): import('../importar').ImportRowResult {
    const cat = db.select().from(schema.categoria).get()!;
    const imp = db.select().from(schema.impuesto).get()!;
    return {
      fila: 2,
      status: 'update',
      matchKey: 'EAN test',
      data: {
        id: prodId,
        nombre: 'Actualizado',
        categoria_id: cat.id,
        impuesto_id: imp.id,
        precio_venta_lista: 200,
        unidad_venta: 'u',
        gtin_barcode: null,
        costo: 0,
        stock_minimo: 0,
        activo: true,
        stock_inicial: 0,
        stock_actual: 0,
        ...overrides,
      },
    };
  }

  it('actualiza marca_id y ubicacion_id en update cuando se proveen en data', () => {
    const prodId = crearProductoBase('8880000000001');
    const marca = marcaCreateHandler(db, { nombre: 'MarcaTestB' });
    const ubic = ubicacionCreateHandler(db, { sector: 'C', estante: '03', posicion: '07' });
    const row = buildUpdateRow(prodId, { marca_id: marca.id, ubicacion_id: ubic.id });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).where(eq(schema.producto.id, prodId)).get()!;
    expect(prod.marca_id).toBe(marca.id);
    expect(prod.ubicacion_id).toBe(ubic.id);
  });

  it('actualiza nombre_largo y descripcion_tecnica en update', () => {
    const prodId = crearProductoBase('8880000000002');
    const row = buildUpdateRow(prodId, {
      nombre_largo: 'Nombre largo nuevo',
      descripcion_tecnica: 'Descripcion nueva',
    });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).where(eq(schema.producto.id, prodId)).get()!;
    expect(prod.nombre_largo).toBe('Nombre largo nuevo');
    expect(prod.descripcion_tecnica).toBe('Descripcion nueva');
  });

  it('actualiza stock_minimo y stock_maximo en existencias en update', () => {
    const prodId = crearProductoBase('8880000000003');
    const row = buildUpdateRow(prodId, { stock_minimo: 5, stock_maximo: 150 });
    confirmarProductos(db, { rows: [row] });
    const exist = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prodId)).get()!;
    expect(exist.stock_minimo).toBe(5);
    expect(exist.stock_maximo).toBe(150);
  });

  it('carga stock si stock_actual=0 y stock_inicial>0', () => {
    const prodId = crearProductoBase('8880000000004');
    const row = buildUpdateRow(prodId, { stock_inicial: 25, stock_actual: 0 });
    confirmarProductos(db, { rows: [row] });
    const exist = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prodId)).get()!;
    expect(exist.stock_fisico).toBe(25);
    const movs = db.select().from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.producto_id, prodId)).all();
    expect(movs.find(m => m.stock_resultante === 25)).toBeDefined();
  });

  it('NO carga stock si stock_actual>0 aunque stock_inicial>0', () => {
    const prodId = crearProductoBase('8880000000005');
    const sync = { version: 1 as const, origin_id: 'C1', sync_state: 'pending' as const, updated_at: new Date() };
    db.update(schema.existencias)
      .set({ stock_fisico: 30, ...sync })
      .where(eq(schema.existencias.producto_id, prodId)).run();
    const row = buildUpdateRow(prodId, { stock_inicial: 20, stock_actual: 30 });
    confirmarProductos(db, { rows: [row] });
    const exist = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prodId)).get()!;
    expect(exist.stock_fisico).toBe(30);
    const movs = db.select().from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.producto_id, prodId)).all();
    expect(movs.length).toBe(0);
  });

  it('mensaje update con stock ignorado menciona cantidad actual', () => {
    const prodId = crearProductoBase('8880000000006');
    const sync = { version: 1 as const, origin_id: 'C1', sync_state: 'pending' as const, updated_at: new Date() };
    db.update(schema.existencias)
      .set({ stock_fisico: 15, ...sync })
      .where(eq(schema.existencias.producto_id, prodId)).run();
    const row = buildUpdateRow(prodId, { stock_inicial: 20, stock_actual: 15 });
    const result = confirmarProductos(db, { rows: [row] });
    expect(result.rows[0].mensaje).toMatch(/stock ignorado/i);
    expect(result.rows[0].mensaje).toMatch(/15/);
  });

  it('actualiza CPP cuando stock_actual=0 y stock_inicial>0 y costo>0', () => {
    const prodId = crearProductoBase('8880000000007');
    const row = buildUpdateRow(prodId, { stock_inicial: 10, stock_actual: 0, costo: 400 });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).where(eq(schema.producto.id, prodId)).get()!;
    expect(prod.precio_costo_promedio).toBe(400);
  });
});

describe('validarProductos — unidad_compra, factor_conversion, permite_fraccion', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
    categoriaCreateHandler(db, { nombre: 'Herramientas' });
  });

  it('data incluye unidad_compra cuando la columna está presente', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,unidad_compra',
      'Martillo,u,1500,21,Herramientas,caja',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.unidad_compra).toBe('caja');
  });

  it('data incluye factor_conversion cuando la columna está presente y es válida', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,factor_conversion',
      'Martillo,u,1500,21,Herramientas,12',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.factor_conversion).toBe(12);
  });

  it('error si factor_conversion no es número', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,factor_conversion',
      'Martillo,u,1500,21,Herramientas,abc',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/factor_conversion/);
  });

  it('error si factor_conversion es 0 o negativo', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,factor_conversion',
      'Martillo,u,1500,21,Herramientas,0',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('error');
    expect(result.rows[0].error).toMatch(/factor_conversion/);
  });

  it('data incluye permite_fraccion=true cuando la columna está presente con valor true', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,permite_fraccion',
      'Cable,u,1500,21,Herramientas,true',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].status).toBe('ok');
    expect(result.rows[0].data?.permite_fraccion).toBe(true);
  });

  it('permite_fraccion default false cuando la columna está ausente', () => {
    const csv = [
      'nombre,unidad_medida,precio_venta,iva_alicuota,rubro',
      'Martillo,u,1500,21,Herramientas',
    ].join('\n');
    const result = validarProductos(db, { csv });
    expect(result.rows[0].data).not.toHaveProperty('permite_fraccion');
  });
});

describe('confirmarProductos — unidad_compra, factor_conversion, permite_fraccion', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
  });

  function buildRow(overrides: Record<string, unknown> = {}): import('../importar').ImportRowResult {
    const cat = categoriaCreateHandler(db, { nombre: 'Test' });
    const imp = db.select().from(schema.impuesto).get()!;
    return {
      fila: 2, status: 'ok',
      data: { nombre: 'Tornillo', categoria_id: cat.id, impuesto_id: imp.id, precio_venta_lista: 500, unidad_venta: 'u', gtin_barcode: null, costo: 0, stock_minimo: 0, activo: true, ...overrides },
    };
  }

  it('crea producto con unidad_compra, factor_conversion y permite_fraccion', () => {
    const row = buildRow({ unidad_compra: 'caja', factor_conversion: 12, permite_fraccion: true });
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).get()!;
    expect(prod.unidad_compra).toBe('caja');
    expect(prod.factor_conversion).toBe(12);
    expect(prod.permite_fraccion).toBe(true);
  });

  it('factor_conversion default 1 y permite_fraccion default false cuando no se proveen', () => {
    const row = buildRow();
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).get()!;
    expect(prod.factor_conversion).toBe(1);
    expect(prod.permite_fraccion).toBe(false);
  });

  it('actualiza unidad_compra, factor_conversion y permite_fraccion en UPDATE', () => {
    const cat = categoriaCreateHandler(db, { nombre: 'TestUpd' });
    const imp = db.select().from(schema.impuesto).get()!;
    const now = new Date();
    const sync = { version: 1 as const, origin_id: 'C1', sync_state: 'pending' as const, updated_at: now };
    const id = 'prod-uc-1';
    db.insert(schema.producto).values({
      id, sku: 'P-0000020-1', sku_secuencial: 20,
      nombre_corto: 'Original', nombre_largo: 'Original',
      unidad_venta: 'u', unidad_compra: null, factor_conversion: 1, permite_fraccion: false,
      precio_venta_lista: 100, precio_costo_promedio: 0,
      impuesto_id: imp.id, categoria_id: cat.id,
      activo: true, moneda: 'ARS',
      usuario_creacion_id: 'admin', fecha_creacion: now, ...sync,
    }).run();
    db.insert(schema.existencias).values({
      id: 'exist-uc-1', producto_id: id, stock_fisico: 0, stock_minimo: 0, ...sync,
    }).run();

    const row: import('../importar').ImportRowResult = {
      fila: 2, status: 'update', matchKey: 'test',
      data: {
        id, nombre: 'Actualizado', categoria_id: cat.id, impuesto_id: imp.id,
        precio_venta_lista: 200, unidad_venta: 'u', gtin_barcode: null,
        costo: 0, stock_minimo: 0, activo: true, stock_inicial: 0, stock_actual: 0,
        unidad_compra: 'bulto', factor_conversion: 6, permite_fraccion: true,
      },
    };
    confirmarProductos(db, { rows: [row] });
    const prod = db.select().from(schema.producto).where(eq(schema.producto.id, id)).get()!;
    expect(prod.unidad_compra).toBe('bulto');
    expect(prod.factor_conversion).toBe(6);
    expect(prod.permite_fraccion).toBe(true);
  });
});

describe('getPlantilla', () => {
  it('la plantilla de clientes usa nombre/apellido, no razon_social', () => {
    const csv = getPlantilla('clientes');
    const header = csv.split('\n')[0];
    expect(header).toMatch(/\bnombre\b/);
    expect(header).toMatch(/\bapellido\b/);
    expect(header).not.toMatch(/razon_social/);
  });

  it('la plantilla de clientes incluye los campos de domicilio nuevos', () => {
    const header = getPlantilla('clientes').split('\n')[0];
    for (const col of ['telefono_adicional', 'calle', 'numero', 'aclaracion', 'codigo_postal', 'localidad', 'provincia']) {
      expect(header.split(';')).toContain(col);
    }
  });

  it('la plantilla de proveedores conserva razon_social y suma codigo + domicilio', () => {
    const header = getPlantilla('proveedores').split('\n')[0];
    expect(header).toMatch(/razon_social/);
    for (const col of ['codigo', 'telefono_adicional', 'calle', 'numero', 'aclaracion', 'codigo_postal', 'localidad', 'provincia']) {
      expect(header.split(';')).toContain(col);
    }
    // Los defaults comerciales (ADR-049) quedan fuera de la importación a propósito.
    expect(header).not.toMatch(/bonificacion_pct_default/);
    expect(header).not.toMatch(/costo_financiero_pct_default/);
    expect(header).not.toMatch(/flete_pct_default/);
  });

  it('la plantilla de productos suma unidad_compra, factor_conversion y permite_fraccion', () => {
    const header = getPlantilla('productos').split('\n')[0];
    for (const col of ['unidad_compra', 'factor_conversion', 'permite_fraccion']) {
      expect(header.split(';')).toContain(col);
    }
    // producto_proveedor queda explícitamente fuera de esta importación.
    expect(header).not.toMatch(/proveedor/);
  });
});

describe('ADR-051 C.2 — hard-stop de header incompleto', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  it('validarProductos: falta precio_venta en el header → error de archivo, cero filas procesadas', () => {
    const csv = 'nombre,unidad_medida,iva_alicuota,rubro\nMartillo,u,21,Herramientas\n';
    const result = validarProductos(db, { csv });
    expect(result.rows).toHaveLength(0);
    expect(result.errorArchivo).toMatch(/precio_venta/);
  });

  it('validarProductos: header completo procesa filas normalmente (sin regresión)', () => {
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nMartillo,u,3200,21,Ferretería\n';
    categoriaCreateHandler(db, { nombre: 'Ferretería' });
    const result = validarProductos(db, { csv });
    expect(result.errorArchivo).toBeUndefined();
    expect(result.rows).toHaveLength(1);
  });

  it('validarClientes: falta condicion_fiscal → error de archivo', () => {
    const csv = 'tipo_documento,numero_documento,nombre\nDNI,123,Juan\n';
    const result = validarClientes(db, { csv });
    expect(result.rows).toHaveLength(0);
    expect(result.errorArchivo).toMatch(/condicion_fiscal/);
  });

  it('validarProveedores: falta razon_social → error de archivo', () => {
    const csv = 'tipo_documento,numero_documento,condicion_fiscal\nCUIT,123,Responsable Inscripto\n';
    const result = validarProveedores(db, { csv });
    expect(result.errorArchivo).toMatch(/razon_social/);
  });

  it('validarUbicaciones: falta estante → error de archivo', () => {
    const csv = 'sector,posicion\nA,22\n';
    const result = validarUbicaciones(db, { csv });
    expect(result.errorArchivo).toMatch(/estante/);
  });

  it('validarStockInicial: sin sku NI gtin_barcode en el header → error de archivo (caso OR)', () => {
    const csv = 'cantidad,costo_unitario\n50,120\n';
    const result = validarStockInicial(db, { csv });
    expect(result.errorArchivo).toMatch(/sku.*gtin_barcode|gtin_barcode.*sku/i);
  });

  it('validarStockInicial: con solo sku (sin gtin_barcode) sigue funcionando igual que hoy', () => {
    const csv = 'sku,cantidad\n00001,50\n';
    const result = validarStockInicial(db, { csv });
    expect(result.errorArchivo).toBeUndefined();
  });

  it('validarStockInicial: con solo gtin_barcode (sin sku) sigue funcionando igual que hoy', () => {
    const csv = 'gtin_barcode,cantidad\n7791234567890,50\n';
    const result = validarStockInicial(db, { csv });
    expect(result.errorArchivo).toBeUndefined();
  });

  it('validarStockInicial: falta cantidad (aunque haya sku) → error de archivo', () => {
    const csv = 'sku,costo_unitario\n00001,120\n';
    const result = validarStockInicial(db, { csv });
    expect(result.errorArchivo).toMatch(/cantidad/);
  });
});

describe('ADR-051 C.3 — captura de columnas crudas (raw)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  it('validarProductos: cada fila guarda raw con todas las columnas del archivo, en su orden', () => {
    categoriaCreateHandler(db, { nombre: 'Ferretería' });
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nMartillo,u,3200,21,Ferretería\n';
    const result = validarProductos(db, { csv });
    expect(result.rows[0].raw).toEqual({
      nombre: 'Martillo', unidad_medida: 'u', precio_venta: '3200', iva_alicuota: '21', rubro: 'Ferretería',
    });
  });
});

describe('ADR-051 C.3 — validarFilaUnica (re-validación inline)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  it('productos: corregir un rubro inexistente por uno válido vuelve la fila a ok/update', () => {
    categoriaCreateHandler(db, { nombre: 'Ferretería' });
    const raw = { nombre: 'Martillo', unidad_medida: 'u', precio_venta: '3200', iva_alicuota: '21', rubro: 'Ferretería' };
    const result = validarFilaUnica(db, 'productos', raw, 5);
    expect(result.status).toBe('ok');
    expect(result.fila).toBe(5);
  });

  it('productos: rubro inexistente da error puntual de esa fila', () => {
    const raw = { nombre: 'Martillo', unidad_medida: 'u', precio_venta: '3200', iva_alicuota: '21', rubro: 'Inexistente' };
    const result = validarFilaUnica(db, 'productos', raw, 5);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/Rubro/);
  });

  it('clientes: condicion_fiscal inválida da error puntual', () => {
    const raw = { tipo_documento: 'DNI', numero_documento: '111', nombre: 'Juan', condicion_fiscal: 'Particular' };
    const result = validarFilaUnica(db, 'clientes', raw, 3);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/condicion_fiscal/);
  });

  it('proveedores: documento válido da ok', () => {
    const raw = { tipo_documento: 'CUIT', numero_documento: '30712345678', razon_social: 'Aceros SA', condicion_fiscal: 'Responsable Inscripto' };
    const result = validarFilaUnica(db, 'proveedores', raw, 2);
    expect(result.status).toBe('ok');
  });

  it('ubicaciones: sector/estante/posicion completos da ok', () => {
    const raw = { sector: 'A', estante: '04', posicion: '22' };
    const result = validarFilaUnica(db, 'ubicaciones', raw, 2);
    expect(result.status).toBe('ok');
  });

  it('stockInicial: sku inexistente da error puntual', () => {
    const raw = { sku: '99999', cantidad: '10' };
    const result = validarFilaUnica(db, 'stockInicial', raw, 2);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/no encontrado/);
  });
});

describe('ADR-051 C.1 — importar:plantilla enriquecido', () => {
  it('devuelve columnas, ejemplo y obligatorias para productos', () => {
    const info = plantillaInfoHandler('productos');
    expect(info.columnas).toEqual(['sku','nombre','unidad_medida','precio_venta','iva_alicuota','rubro','codigo_barras','costo','stock_minimo','activo','marca','ubicacion','stock_inicial','stock_maximo','nombre_largo','descripcion_tecnica','garantia_meses','unidad_compra','factor_conversion','permite_fraccion']);
    expect(info.obligatorias).toEqual(['nombre', 'unidad_medida', 'precio_venta', 'iva_alicuota', 'rubro']);
    expect(info.csv).toContain('nombre;unidad_medida');
  });

  it('stock-inicial trae orNote en vez de una lista plana de obligatorias', () => {
    const info = plantillaInfoHandler('stock-inicial');
    expect(info.obligatorias).toEqual(['cantidad']);
    expect(info.orNote).toMatch(/sku.*gtin_barcode/i);
  });

  it('todas las plantillas de muestra usan punto y coma como delimitador', () => {
    for (const entidad of ['productos', 'clientes', 'proveedores', 'ubicaciones', 'stock-inicial']) {
      const info = plantillaInfoHandler(entidad);
      expect(info.csv.split('\n')[0]).not.toContain(',');
      expect(info.columnas.length).toBeGreaterThan(1);
    }
  });
});

describe('ADR-051 C.4 — confirmarX propaga raw a SummaryRowResult', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); loginAsAdmin(db); });

  it('confirmarClientes: la fila creada conserva el raw original', () => {
    const preview = validarClientes(db, { csv: 'tipo_documento,numero_documento,nombre,condicion_fiscal\nDNI,111,Juan,Consumidor Final\n' });
    const summary = confirmarClientes(db, { rows: preview.rows });
    expect(summary.rows[0].raw).toEqual({ tipo_documento: 'DNI', numero_documento: '111', nombre: 'Juan', condicion_fiscal: 'Consumidor Final' });
  });
});

describe('importar ubicaciones — canónica (ADR-064)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); clearSession(); loginAsAdmin(db); });

  it('A-0-1 y A-0-01 colapsan: la 2da fila matchea la existente (update)', () => {
    const csv = ['sector;estante;posicion;descripcion',
                 'A;0;1;primera',
                 'A;0;01;segunda'].join('\n');
    const preview = validarUbicaciones(db, { csv });
    expect(preview.stats.ok).toBe(1);
    expect(preview.stats.update).toBe(1);
    expect(preview.stats.error).toBe(0);
    confirmarUbicaciones(db, { rows: preview.rows });
    const filas = db.select().from(schema.ubicacion).all();
    expect(filas).toHaveLength(1);
    expect(filas[0].codigo).toBe('A-0-1');
    expect(filas[0].descripcion).toBe('segunda'); // la 2da fila (última) gana
  });
});

describe('ADR-065 — golden ida-y-vuelta de productos', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
    categoriaCreateHandler(db, { nombre: 'Herramientas' });
    // 'Stanley' ya está sembrada por runCatalogSeed (ver comentario idéntico más arriba
    // en este archivo, describe 'validarProductos — marca y ubicación') — crearla de
    // nuevo viola la unicidad de marca.nombre.
    ubicacionCreateHandler(db, { sector: 'A', estante: '1', posicion: '3', descripcion: 'Estante A' });
  });

  it('alta: todos los campos de la plantilla llegan a producto + existencias', () => {
    const header = 'sku;nombre;unidad_medida;precio_venta;iva_alicuota;rubro;codigo_barras;costo;stock_minimo;activo;marca;ubicacion;stock_inicial;stock_maximo;nombre_largo;descripcion_tecnica;garantia_meses;unidad_compra;factor_conversion;permite_fraccion';
    const fila = ';Taladro;u;5000;21;Herramientas;7790001112223;3000;5;si;Stanley;A-1-3;12;60;Taladro percutor 650W;Mandril 13mm;24;caja;6;no';
    const csv = `${header}\n${fila}`;

    const preview = validarProductos(db, { csv });
    expect(preview.stats).toEqual({ ok: 1, update: 0, error: 0 });

    const summary = confirmarProductos(db, { rows: preview.rows });
    expect(summary.stats.created).toBe(1);

    const prod = db.select().from(schema.producto).where(eq(schema.producto.gtin_barcode, '7790001112223')).get()!;
    const marca = db.select().from(schema.marca).where(eq(schema.marca.nombre, 'Stanley')).get()!;
    const ubic = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.codigo, 'A-1-3')).get()!;
    const imp21 = db.select().from(schema.impuesto).where(eq(schema.impuesto.alicuota, 21)).get()!;

    expect(prod.nombre_corto).toBe('Taladro');
    expect(prod.nombre_largo).toBe('Taladro percutor 650W');
    expect(prod.descripcion_tecnica).toBe('Mandril 13mm');
    expect(prod.garantia_meses).toBe(24);
    expect(prod.unidad_venta).toBe('u');
    expect(prod.unidad_compra).toBe('caja');
    expect(prod.factor_conversion).toBe(6);
    expect(prod.permite_fraccion).toBe(false);
    expect(prod.activo).toBe(true);
    expect(prod.precio_venta_lista).toBe(5000);
    expect(prod.precio_costo_promedio).toBe(3000);
    expect(prod.marca_id).toBe(marca.id);
    expect(prod.ubicacion_id).toBe(ubic.id);
    expect(prod.impuesto_id).toBe(imp21.id);

    const ex = db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, prod.id)).get()!;
    expect(ex.stock_minimo).toBe(5);
    expect(ex.stock_maximo).toBe(60);
    expect(ex.stock_fisico).toBe(12); // stock_inicial

    const mov = db.select().from(schema.movimiento_stock).where(eq(schema.movimiento_stock.producto_id, prod.id)).get()!;
    expect(mov.motivo).toBe('inicial');
    expect(mov.cantidad).toBe(12);

    const pres = db.select().from(schema.producto_presentacion).where(eq(schema.producto_presentacion.producto_id, prod.id)).get();
    expect(pres).toBeTruthy();
  });

  it('update por SKU: reimportar con el SKU asignado actualiza sin duplicar', () => {
    const header = 'sku;nombre;unidad_medida;precio_venta;iva_alicuota;rubro;stock_maximo';
    // 1) Alta.
    const alta = validarProductos(db, { csv: `${header}\n;Pinza;u;900;21;Herramientas;40` });
    confirmarProductos(db, { rows: alta.rows });
    const prod = db.select().from(schema.producto).where(eq(schema.producto.nombre_corto, 'Pinza')).get()!;

    // 2) Reimport con el SKU asignado + cambios.
    const reimport = validarProductos(db, { csv: `${header}\n${prod.sku};Pinza reforzada;u;1100;21;Herramientas;80` });
    expect(reimport.rows[0].status).toBe('update');
    const sum = confirmarProductos(db, { rows: reimport.rows });
    expect(sum.stats).toEqual({ created: 0, updated: 1, error: 0 });

    const total = db.select().from(schema.producto).where(eq(schema.producto.nombre_corto, 'Pinza reforzada')).all();
    expect(total).toHaveLength(1); // no duplicó
    expect(total[0].nombre_corto_norm).toBe('pinza reforzada'); // norm en sync tras rename (ADR-065)
    const ex = db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, prod.id)).get()!;
    expect(ex.stock_maximo).toBe(80);
  });
});
