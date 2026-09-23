import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and } from 'drizzle-orm';
import { generateId, formatSku, canonicalizarUbicacion, canonicalizarCodigoUbicacion, parseBooleanoImport } from '@ferreteria/shared';
import { getOriginId, getSession, requirePermission } from '@core/main';
import * as schema from '../db/schema';
import { clienteUpsertHandler } from '@core/main';
import { proveedorUpsertHandler } from './proveedor';
import { crearPresentacionDefault } from './presentacion';
import { normalizarTermino } from '../sinonimos/normalizar';

export type Db = BetterSQLite3Database<typeof schema>;

export type RowStatus = 'ok' | 'update' | 'error';

export type ImportRowResult = {
  fila: number;
  status: RowStatus;
  data?: Record<string, unknown>;
  raw?: Record<string, string>;
  matchKey?: string;
  skuPreview?: string;
  error?: string;
};

export type ImportPreviewResult = {
  rows: ImportRowResult[];
  stats: { ok: number; update: number; error: number };
  errorArchivo?: string;
};

export type SummaryRowResult = {
  fila: number;
  status: 'created' | 'updated' | 'error';
  mensaje: string;
  raw: Record<string, string> | undefined;
};

export type ImportSummaryResult = {
  rows: SummaryRowResult[];
  stats: { created: number; updated: number; error: number };
};

export function csvToRows(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];

  const header = lines[0];
  const sepChar = (header.split(';').length - 1) >= (header.split(',').length - 1) ? ';' : ',';

  return lines.map(line => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === sepChar && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  });
}

function buildRaw(headers: string[], row: string[]): Record<string, string> {
  const raw: Record<string, string> = {};
  headers.forEach((h, i) => { raw[h] = row[i] ?? ''; });
  return raw;
}

export function syncFields(now: Date) {
  return { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
}

function parseNum(s: string, def = 0): number {
  const n = Number.parseFloat(s.replaceAll(',', '.'));
  return Number.isNaN(n) ? def : n;
}

// ADR-075 — Mapa de ubicaciones activas para el match del import de productos,
// keyeado por la FORMA CANÓNICA del código (no por el código crudo guardado). Así
// 'A-1-3' del CSV matchea una fila legacy guardada como 'A-01-03' (anterior a
// ADR-064) y también variantes de mayúsculas/minúsculas. Ante duplicados legacy
// (una vieja 'A-01-03' conviviendo con una nueva 'A-1-3'), se prefiere la fila cuyo
// código ya está en forma canónica.
function buildUbicacionMap(db: Db): Map<string, string> {
  const ubicaciones = db.select({ id: schema.ubicacion.id, codigo: schema.ubicacion.codigo })
    .from(schema.ubicacion).where(eq(schema.ubicacion.activo, true)).all();
  const map = new Map<string, string>();
  for (const u of ubicaciones) {
    const key = canonicalizarCodigoUbicacion(u.codigo);
    if (!map.has(key) || u.codigo === key) map.set(key, u.id);
  }
  return map;
}

const IVA_ALICUOTAS_VALIDAS = [21, 10.5, 27, 0] as const;

function validarFilaProducto(
  fila: number,
  get: (name: string) => string,
  has: (name: string) => boolean,
  impByAlicuota: Map<number, string>,
  catMap: Map<string, string>,
  marcaMap: Map<string, string>,
  ubicacionMap: Map<string, string>,
  seenGtins: Set<string>,
  seenSkus: Set<string>,
  seenNombres: Set<string>,
  db: Db,
): ImportRowResult {
  const nombre = get('nombre');
  const rubroVal = get('rubro');
  const precioStr = get('precio_venta');
  const ivaStr = get('iva_alicuota');
  const unidadMedida = get('unidad_medida');

  if (!nombre)       return { fila, status: 'error', error: 'nombre es obligatorio' };
  if (!rubroVal)     return { fila, status: 'error', error: 'rubro es obligatorio' };
  if (!precioStr)    return { fila, status: 'error', error: 'precio_venta es obligatorio' };
  if (!ivaStr)       return { fila, status: 'error', error: 'iva_alicuota es obligatorio' };
  if (!unidadMedida) return { fila, status: 'error', error: 'unidad_medida es obligatorio' };

  const precio = Number.parseFloat(precioStr.replaceAll(',', '.'));
  if (Number.isNaN(precio) || precio < 0) return { fila, status: 'error', error: 'precio_venta debe ser un número ≥ 0' };

  const ivaNum = Number.parseFloat(ivaStr.replaceAll(',', '.'));
  if (!IVA_ALICUOTAS_VALIDAS.includes(ivaNum as typeof IVA_ALICUOTAS_VALIDAS[number])) {
    return { fila, status: 'error', error: `iva_alicuota inválido: "${ivaStr}". Valores aceptados: 21, 10.5, 27, 0` };
  }
  const impuesto_id = impByAlicuota.get(ivaNum);
  if (!impuesto_id) return { fila, status: 'error', error: `No existe impuesto con alícuota ${ivaNum}%` };

  const categoria_id = catMap.get(rubroVal.toLowerCase());
  if (!categoria_id) return { fila, status: 'error', error: `Rubro "${rubroVal}" no existe` };

  // Resolver marca (opcional; error si no existe cuando se provee)
  const marcaVal = get('marca');
  let marca_id: string | undefined;
  if (has('marca') && marcaVal) {
    const found = marcaMap.get(marcaVal.toLowerCase());
    if (!found) return { fila, status: 'error', error: `Marca "${marcaVal}" no existe` };
    marca_id = found;
  }

  // Resolver ubicacion por código (opcional; error si no existe cuando se provee).
  // ADR-075: se matchea por forma canónica del código (ceros a la izquierda +
  // mayúsculas), igual que el mapa — así 'A-1-3' resuelve a la legacy 'A-01-03'.
  const ubicacionVal = get('ubicacion');
  let ubicacion_id: string | undefined;
  if (has('ubicacion') && ubicacionVal) {
    const found = ubicacionMap.get(canonicalizarCodigoUbicacion(ubicacionVal));
    if (!found) return { fila, status: 'error', error: `Ubicación "${ubicacionVal}" no existe` };
    ubicacion_id = found;
  }

  // stock_inicial: opcional, debe ser número ≥ 0
  let stock_inicial = 0;
  if (has('stock_inicial')) {
    const raw = get('stock_inicial');
    if (raw) {
      const parsed = Number.parseFloat(raw.replaceAll(',', '.'));
      if (Number.isNaN(parsed) || parsed < 0)
        return { fila, status: 'error', error: 'stock_inicial debe ser un número ≥ 0' };
      stock_inicial = parsed;
    }
  }

  // stock_maximo: opcional, debe ser número ≥ 0
  let stock_maximo: number | null = null;
  if (has('stock_maximo')) {
    const raw = get('stock_maximo');
    if (raw) {
      const parsed = Number.parseFloat(raw.replaceAll(',', '.'));
      if (Number.isNaN(parsed) || parsed < 0)
        return { fila, status: 'error', error: 'stock_maximo debe ser un número ≥ 0' };
      stock_maximo = parsed;
    }
  }

  // Campos de texto opcionales
  const nombre_largo = has('nombre_largo') ? (get('nombre_largo') || null) : null;
  const descripcion_tecnica = has('descripcion_tecnica') ? (get('descripcion_tecnica') || null) : null;
  let garantia_meses: number | null = null;
  if (has('garantia_meses')) {
    const raw = get('garantia_meses');
    if (raw) {
      const parsed = Number.parseInt(raw, 10);
      garantia_meses = Number.isNaN(parsed) ? null : parsed;
    }
  }

  // unidad_compra: opcional, texto libre (igual que unidad_venta, sin catálogo).
  const unidad_compra = has('unidad_compra') ? (get('unidad_compra') || null) : null;

  // factor_conversion: opcional, debe ser un número > 0 (mismo mínimo que ProductoForm).
  let factor_conversion: number | null = null;
  if (has('factor_conversion')) {
    const raw = get('factor_conversion');
    if (raw) {
      const parsed = Number.parseFloat(raw.replaceAll(',', '.'));
      if (Number.isNaN(parsed) || parsed <= 0)
        return { fila, status: 'error', error: 'factor_conversion debe ser un número mayor a 0' };
      factor_conversion = parsed;
    }
  }

  // permite_fraccion: opcional, booleano canónico (ADR-065).
  let permite_fraccion: boolean | undefined;
  if (has('permite_fraccion')) {
    const pf = parseBooleanoImport(get('permite_fraccion'), { default: false });
    if (!pf.ok) return { fila, status: 'error', error: `permite_fraccion inválido: "${get('permite_fraccion')}". Use si/no.` };
    permite_fraccion = pf.value;
  }

  // activo: booleano canónico; vacío = true (catálogo vendible por default). ADR-065.
  const activoParse = parseBooleanoImport(get('activo'), { default: true });
  if (!activoParse.ok) return { fila, status: 'error', error: `activo inválido: "${get('activo')}". Use si/no.` };

  const codigoBarras = get('codigo_barras');
  const skuVal = has('sku') ? get('sku') : '';
  const data: Record<string, unknown> = {
    nombre, categoria_id, impuesto_id,
    precio_venta_lista: precio,
    unidad_venta: unidadMedida,
    gtin_barcode: codigoBarras || null,
    costo: parseNum(get('costo')),
    stock_minimo: parseNum(get('stock_minimo')),
    activo: activoParse.value,
    ...(marca_id !== undefined ? { marca_id } : {}),
    ...(ubicacion_id !== undefined ? { ubicacion_id } : {}),
    stock_inicial,
    ...(has('stock_maximo') ? { stock_maximo } : {}),
    ...(has('nombre_largo') ? { nombre_largo } : {}),
    ...(has('descripcion_tecnica') ? { descripcion_tecnica } : {}),
    ...(has('garantia_meses') ? { garantia_meses } : {}),
    ...(has('unidad_compra') ? { unidad_compra } : {}),
    ...(has('factor_conversion') && factor_conversion !== null ? { factor_conversion } : {}),
    ...(permite_fraccion !== undefined ? { permite_fraccion } : {}),
  };

  // ADR-065 — Cascada de identidad: SKU (columna opcional) → EAN → detección blanda por nombre.
  // 1) SKU: clave canónica (ADR-025), precede a todo. Presente+existe = UPDATE;
  //    presente+no existe = error (nunca alta con un SKU ajeno).
  if (skuVal) {
    if (seenSkus.has(skuVal)) {
      return { fila, status: 'error', error: `sku duplicado en el archivo: "${skuVal}"` };
    }
    seenSkus.add(skuVal);
    const existente = db.select({ id: schema.producto.id, sku: schema.producto.sku, gtin_barcode: schema.producto.gtin_barcode })
      .from(schema.producto).where(eq(schema.producto.sku, skuVal)).get();
    if (!existente) {
      return { fila, status: 'error', error: `SKU_INEXISTENTE: "${skuVal}" no corresponde a ningún producto` };
    }
    data['id'] = existente.id;
    const existExist = db.select({ stock_fisico: schema.existencias.stock_fisico })
      .from(schema.existencias).where(eq(schema.existencias.producto_id, existente.id)).get();
    data['stock_actual'] = existExist?.stock_fisico ?? 0;
    let matchKey = `SKU ${skuVal}`;
    // Aviso de inconsistencia: el archivo trae un EAN distinto del guardado (no se pisa).
    if (codigoBarras && existente.gtin_barcode && codigoBarras !== existente.gtin_barcode) {
      matchKey += ` ⚠ EAN del archivo (${codigoBarras}) ≠ guardado (${existente.gtin_barcode})`;
    }
    return { fila, status: 'update', matchKey, data };
  }

  // 2) EAN (comportamiento previo).
  if (codigoBarras) {
    if (seenGtins.has(codigoBarras)) {
      return { fila, status: 'error', error: `codigo_barras duplicado en el archivo: "${codigoBarras}"` };
    }
    seenGtins.add(codigoBarras);
    // Buscar existente por gtin_barcode (único identificador estable que el usuario conoce).
    const existente = db.select({ id: schema.producto.id, sku: schema.producto.sku }).from(schema.producto)
      .where(eq(schema.producto.gtin_barcode, codigoBarras)).get();
    if (existente) {
      data['id'] = existente.id;
      const existExist = db.select({ stock_fisico: schema.existencias.stock_fisico })
        .from(schema.existencias)
        .where(eq(schema.existencias.producto_id, existente.id))
        .get();
      data['stock_actual'] = existExist?.stock_fisico ?? 0;
      return { fila, status: 'update', matchKey: `EAN ${codigoBarras} (SKU ${existente.sku})`, data };
    }
  }

  // 3) Detección blanda por nombre (+marca) — sin SKU ni EAN match. Rechaza para revisión
  //    humana (ADR-063: la similitud sugiere, no fusiona). Cubre intra-archivo y contra BD.
  const nombreNorm = normalizarTermino(nombre);
  const nombreKey = `${nombreNorm}||${marca_id ?? ''}`;
  if (seenNombres.has(nombreKey)) {
    return { fila, status: 'error', error: `POSIBLE_DUPLICADO: otra fila del archivo tiene el mismo nombre${marca_id ? '+marca' : ''}. Distinguí el nombre o cargá el SKU.` };
  }
  const condDupe = marca_id !== undefined
    ? and(eq(schema.producto.nombre_corto_norm, nombreNorm), eq(schema.producto.marca_id, marca_id))
    : eq(schema.producto.nombre_corto_norm, nombreNorm);
  const dupe = db.select({ sku: schema.producto.sku }).from(schema.producto).where(condDupe).get();
  if (dupe) {
    return { fila, status: 'error', error: `POSIBLE_DUPLICADO: coincide con SKU ${dupe.sku} por nombre${marca_id ? '+marca' : ''}. Agregá la columna sku para actualizarlo o distinguí el nombre.` };
  }
  seenNombres.add(nombreKey);

  return { fila, status: 'ok', data, skuPreview: 'auto' };
}

const PRODUCTOS_OBLIGATORIAS = ['nombre', 'unidad_medida', 'precio_venta', 'iva_alicuota', 'rubro'];

export function validarProductos(db: Db, payload: { csv: string }): ImportPreviewResult {
  const allRows = csvToRows(payload.csv);
  if (allRows.length < 2) return { rows: [], stats: { ok: 0, update: 0, error: 0 } };
  const [headers, ...dataRows] = allRows;

  const faltantes = PRODUCTOS_OBLIGATORIAS.filter(c => !headers.includes(c));
  if (faltantes.length > 0) {
    return { rows: [], stats: { ok: 0, update: 0, error: 0 }, errorArchivo: `Faltan columnas obligatorias: ${faltantes.join(', ')}` };
  }

  const col = (name: string) => headers.indexOf(name);

  const categorias = db.select({ id: schema.categoria.id, nombre: schema.categoria.nombre })
    .from(schema.categoria).where(eq(schema.categoria.activo, true)).all();
  const catMap = new Map(categorias.map(c => [c.nombre.toLowerCase(), c.id]));

  const impuestos = db.select({ id: schema.impuesto.id, alicuota: schema.impuesto.alicuota })
    .from(schema.impuesto).where(eq(schema.impuesto.activo, true)).all();
  const impByAlicuota = new Map(impuestos.map(i => [i.alicuota, i.id]));

  const marcas = db.select({ id: schema.marca.id, nombre: schema.marca.nombre })
    .from(schema.marca).where(eq(schema.marca.activo, true)).all();
  const marcaMap = new Map(marcas.map(m => [m.nombre.toLowerCase(), m.id]));

  const ubicacionMap = buildUbicacionMap(db);

  const seenGtins = new Set<string>();
  const seenSkus = new Set<string>();
  const seenNombres = new Set<string>();
  const rows: ImportRowResult[] = [];
  const stats = { ok: 0, update: 0, error: 0 };

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const fila = i + 2;
    const get = (name: string) => (r[col(name)] ?? '').trim();
    const has = (name: string) => headers.includes(name);
    const result = validarFilaProducto(fila, get, has, impByAlicuota, catMap, marcaMap, ubicacionMap, seenGtins, seenSkus, seenNombres, db);
    result.raw = buildRaw(headers, r);
    rows.push(result);
    if (result.status === 'error') stats.error++;
    else if (result.status === 'update') stats.update++;
    else stats.ok++;
  }
  return { rows, stats };
}

const CLIENTES_OBLIGATORIAS = ['tipo_documento', 'numero_documento', 'nombre', 'condicion_fiscal'];

// ADR-058 — nombre/apellido reemplazan a razon_social (ADR-050 ya separó la columna en
// el schema); apellido es opcional acá (ver resolverApellido en confirmarClientes).
// Domicilio como texto libre, igual que ClienteForm (ADR-024).
function validarFilaCliente(
  fila: number,
  get: (name: string) => string,
  seenDocs: Set<string>,
  db: Db,
): ImportRowResult {
  const tipo_documento = get('tipo_documento');
  const numero_documento = get('numero_documento');
  const nombre = get('nombre');
  const condicion_fiscal = get('condicion_fiscal');

  if (!tipo_documento || !numero_documento || !nombre || !condicion_fiscal) {
    return { fila, status: 'error', error: 'tipo_documento, numero_documento, nombre y condicion_fiscal son obligatorios' };
  }
  if (!TIPO_DOC_VALID.includes(tipo_documento as typeof TIPO_DOC_VALID[number])) {
    return { fila, status: 'error', error: `tipo_documento inválido: "${tipo_documento}". Use DNI, CUIT o CUIL` };
  }
  if (!COND_FISCAL_VALID.includes(condicion_fiscal as typeof COND_FISCAL_VALID[number])) {
    return { fila, status: 'error', error: `condicion_fiscal inválida: "${condicion_fiscal}"` };
  }
  if (seenDocs.has(numero_documento)) {
    return { fila, status: 'error', error: `Documento duplicado en archivo: "${numero_documento}"` };
  }
  seenDocs.add(numero_documento);

  const existente = db.select({ id: schema.cliente.id }).from(schema.cliente)
    .where(eq(schema.cliente.numero_documento, numero_documento)).get();

  const hcc = parseBooleanoImport(get('habilita_cuenta_corriente'), { default: false });
  if (!hcc.ok) return { fila, status: 'error', error: `habilita_cuenta_corriente inválido: "${get('habilita_cuenta_corriente')}". Use si/no.` };

  // apellido: opcional en el CSV. NOT NULL en la BD (ADR-050) — el placeholder
  // "(revisar)" (INSERT) o la preservación del valor existente (UPDATE) se
  // resuelven en confirmarClientes, no acá, porque acá no se toca la BD todavía.
  const data: Record<string, unknown> = {
    tipo_documento, numero_documento, nombre, condicion_fiscal,
    apellido: get('apellido') || null,
    nombre_fantasia: get('nombre_fantasia') || null,
    telefono: get('telefono') || null,
    telefono_adicional: get('telefono_adicional') || null,
    calle: get('calle') || null,
    numero: get('numero') || null,
    aclaracion: get('aclaracion') || null,
    codigo_postal: get('codigo_postal') || null,
    localidad: get('localidad') || null,
    provincia: get('provincia') || null,
    email: get('email') || null,
    habilita_cuenta_corriente: hcc.value,
  };
  if (existente) { data['id'] = existente.id; return { fila, status: 'update', matchKey: `Doc ${numero_documento}`, data }; }
  return { fila, status: 'ok', data };
}

export function validarClientes(db: Db, payload: { csv: string }): ImportPreviewResult {
  const allRows = csvToRows(payload.csv);
  if (allRows.length < 2) return { rows: [], stats: { ok: 0, update: 0, error: 0 } };
  const [headers, ...dataRows] = allRows;

  const faltantes = CLIENTES_OBLIGATORIAS.filter(c => !headers.includes(c));
  if (faltantes.length > 0) {
    return { rows: [], stats: { ok: 0, update: 0, error: 0 }, errorArchivo: `Faltan columnas obligatorias: ${faltantes.join(', ')}` };
  }

  const col = (name: string) => headers.indexOf(name);
  const seenDocs = new Set<string>();
  const rows: ImportRowResult[] = [];
  const stats = { ok: 0, update: 0, error: 0 };

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const fila = i + 2;
    const raw = buildRaw(headers, r);
    const get = (name: string) => r[col(name)]?.trim() ?? '';
    const result = validarFilaCliente(fila, get, seenDocs, db);
    result.raw = raw;
    rows.push(result);
    if (result.status === 'error') stats.error++; else if (result.status === 'update') stats.update++; else stats.ok++;
  }
  return { rows, stats };
}

// Fase 2 (fix post-revisión de calidad) — columnas de domicilio/contacto opcionales
// compartidas por cliente y proveedor. clienteUpsertHandler/proveedorUpsertHandler no
// distinguen "el CSV no trajo este campo" de "el form lo vació a propósito": en su rama
// UPDATE escriben siempre `payload.x ?? null`, pensado para un form que manda el estado
// completo. El importador tiene que resolver el valor correcto ANTES de armar el
// payload — no se puede arreglar generalizando el `?? null` de los handlers sin romper
// esa semántica del alta/edición manual (que sí necesita poder vaciar un campo).
const CAMPOS_OPCIONALES_DOMICILIO = [
  'telefono_adicional', 'calle', 'numero', 'aclaracion', 'codigo_postal', 'localidad', 'provincia',
] as const;

// En un UPDATE, si el CSV no trae valor para uno de estos campos (columna ausente o
// celda vacía — `data[campo] == null`, mismo criterio que ya usa `resolverApellido`),
// se completa `data` con el valor ya guardado en la BD para que el payload de upsert
// termine mandando ese mismo valor en vez de null.
function completarCamposAusentes(
  data: Record<string, unknown>,
  existente: Record<string, unknown> | undefined,
  campos: readonly string[],
): void {
  if (!existente) return;
  for (const campo of campos) {
    if (data[campo] == null) data[campo] = existente[campo] ?? null;
  }
}

// ADR-050/Fase 2 — resuelve el apellido a persistir:
// - INSERT sin apellido en el CSV: placeholder "(revisar)" (mismo texto que la
//   migración 0031 usa para razon_social histórica sin apellido real).
// - UPDATE sin apellido en el CSV: preserva el apellido ya guardado en la BD
//   (puede haber sido corregido a mano) — NO lo pisa con el placeholder.
// - Con apellido presente en el CSV (INSERT o UPDATE): usa el valor provisto.
function resolverApellido(apellidoCsv: unknown, apellidoExistente: string | undefined): string {
  if (typeof apellidoCsv === 'string' && apellidoCsv) return apellidoCsv;
  if (apellidoExistente != null) return apellidoExistente;
  return '(revisar)';
}

function clienteUpsertInternal(db: Db, row: ImportRowResult) {
  const data = row.data!;

  let existente: (Record<string, unknown> & { apellido: string }) | undefined;
  if (row.status === 'update') {
    existente = db.select({
      apellido: schema.cliente.apellido,
      telefono_adicional: schema.cliente.telefono_adicional,
      calle: schema.cliente.calle,
      numero: schema.cliente.numero,
      aclaracion: schema.cliente.aclaracion,
      codigo_postal: schema.cliente.codigo_postal,
      localidad: schema.cliente.localidad,
      provincia: schema.cliente.provincia,
    }).from(schema.cliente).where(eq(schema.cliente.id, data['id'] as string)).get();
  }
  completarCamposAusentes(data, existente, CAMPOS_OPCIONALES_DOMICILIO);

  clienteUpsertHandler(db, {
    ...(data['id'] != null ? { id: data['id'] as string } : {}),
    tipo_documento: data['tipo_documento'] as 'DNI' | 'CUIT' | 'CUIL',
    numero_documento: data['numero_documento'] as string,
    nombre: data['nombre'] as string,
    apellido: resolverApellido(data['apellido'], existente?.apellido),
    condicion_fiscal: data['condicion_fiscal'] as 'Responsable Inscripto' | 'Monotributo' | 'Consumidor Final' | 'Exento',
    ...(data['nombre_fantasia'] != null ? { nombre_fantasia: data['nombre_fantasia'] as string } : {}),
    ...(data['telefono'] != null ? { telefono: data['telefono'] as string } : {}),
    ...(data['telefono_adicional'] != null ? { telefono_adicional: data['telefono_adicional'] as string } : {}),
    ...(data['calle'] != null ? { calle: data['calle'] as string } : {}),
    ...(data['numero'] != null ? { numero: data['numero'] as string } : {}),
    ...(data['aclaracion'] != null ? { aclaracion: data['aclaracion'] as string } : {}),
    ...(data['codigo_postal'] != null ? { codigo_postal: data['codigo_postal'] as string } : {}),
    ...(data['localidad'] != null ? { localidad: data['localidad'] as string } : {}),
    ...(data['provincia'] != null ? { provincia: data['provincia'] as string } : {}),
    ...(data['email'] != null ? { email: data['email'] as string } : {}),
    ...(data['habilita_cuenta_corriente'] != null ? { habilita_cuenta_corriente: data['habilita_cuenta_corriente'] as boolean } : {}),
  });
}

export function confirmarClientes(db: Db, payload: { rows: ImportRowResult[] }): ImportSummaryResult {
  const rows: SummaryRowResult[] = [];
  const stats = { created: 0, updated: 0, error: 0 };
  for (const row of payload.rows) {
    if (row.status === 'error' || !row.data) continue;
    try {
      db.transaction(() => {
        clienteUpsertInternal(db, row);
      });
      if (row.status === 'ok') {
        rows.push({ fila: row.fila, status: 'created', mensaje: `${row.data['nombre']} creado`, raw: row.raw });
        stats.created++;
      } else {
        rows.push({ fila: row.fila, status: 'updated', mensaje: `${row.data['nombre']} actualizado`, raw: row.raw });
        stats.updated++;
      }
    } catch (e: unknown) {
      rows.push({ fila: row.fila, status: 'error', mensaje: toErrMsg(e), raw: row.raw });
      stats.error++;
    }
  }
  return { rows, stats };
}

export const TIPO_DOC_VALID = ['DNI', 'CUIT', 'CUIL'] as const;
export const COND_FISCAL_VALID = ['Responsable Inscripto', 'Monotributo', 'Consumidor Final', 'Exento'] as const;

const PROVEEDORES_OBLIGATORIAS = ['tipo_documento', 'numero_documento', 'razon_social', 'condicion_fiscal'];

// ADR-058 — razon_social NO cambia (proveedor no fue tocado por ADR-050). Se suma
// codigo (único, igual que el alta manual) y domicilio como texto libre. Los defaults
// comerciales de ADR-049 quedan fuera de esta importación a propósito.
function validarFilaProveedor(
  fila: number,
  get: (name: string) => string,
  seenDocs: Set<string>,
  db: Db,
  seenCodigos: Set<string>,
): ImportRowResult {
  const tipo_documento = get('tipo_documento');
  const numero_documento = get('numero_documento');
  const razon_social = get('razon_social');
  const condicion_fiscal = get('condicion_fiscal');

  if (!tipo_documento || !numero_documento || !razon_social || !condicion_fiscal) {
    return { fila, status: 'error', error: 'Campos obligatorios faltantes' };
  }
  if (!TIPO_DOC_VALID.includes(tipo_documento as typeof TIPO_DOC_VALID[number])) {
    return { fila, status: 'error', error: `tipo_documento inválido: "${tipo_documento}"` };
  }
  if (!COND_FISCAL_VALID.includes(condicion_fiscal as typeof COND_FISCAL_VALID[number])) {
    return { fila, status: 'error', error: `condicion_fiscal inválida: "${condicion_fiscal}"` };
  }
  if (seenDocs.has(numero_documento)) {
    return { fila, status: 'error', error: `Documento duplicado: "${numero_documento}"` };
  }
  seenDocs.add(numero_documento);

  const existente = db.select({ id: schema.proveedor.id }).from(schema.proveedor)
    .where(eq(schema.proveedor.numero_documento, numero_documento)).get();

  // codigo: opcional, único (mismo criterio que el alta manual — columna unique en el
  // schema). Se valida acá en preview, además de la unicidad dentro del propio archivo,
  // para no depender del error crudo de SQLite en confirmarProveedores.
  const codigoVal = get('codigo');
  if (codigoVal) {
    if (seenCodigos.has(codigoVal)) {
      return { fila, status: 'error', error: `codigo duplicado en el archivo: "${codigoVal}"` };
    }
    seenCodigos.add(codigoVal);

    const codigoExistente = db.select({ id: schema.proveedor.id }).from(schema.proveedor)
      .where(eq(schema.proveedor.codigo, codigoVal)).get();
    if (codigoExistente && codigoExistente.id !== existente?.id) {
      return { fila, status: 'error', error: `codigo "${codigoVal}" ya está en uso por otro proveedor` };
    }
  }

  const data: Record<string, unknown> = {
    tipo_documento, numero_documento, razon_social, condicion_fiscal,
    nombre_fantasia: get('nombre_fantasia') || null,
    telefono: get('telefono') || null,
    telefono_adicional: get('telefono_adicional') || null,
    calle: get('calle') || null,
    numero: get('numero') || null,
    aclaracion: get('aclaracion') || null,
    codigo_postal: get('codigo_postal') || null,
    localidad: get('localidad') || null,
    provincia: get('provincia') || null,
    email: get('email') || null,
    persona_contacto: get('persona_contacto') || null,
    observaciones: get('observaciones') || null,
    codigo: codigoVal || null,
  };
  if (existente) { data['id'] = existente.id; return { fila, status: 'update', matchKey: `Doc ${numero_documento}`, data }; }
  return { fila, status: 'ok', data };
}

export function validarProveedores(db: Db, payload: { csv: string }): ImportPreviewResult {
  const allRows = csvToRows(payload.csv);
  if (allRows.length < 2) return { rows: [], stats: { ok: 0, update: 0, error: 0 } };
  const [headers, ...dataRows] = allRows;

  const faltantes = PROVEEDORES_OBLIGATORIAS.filter(c => !headers.includes(c));
  if (faltantes.length > 0) {
    return { rows: [], stats: { ok: 0, update: 0, error: 0 }, errorArchivo: `Faltan columnas obligatorias: ${faltantes.join(', ')}` };
  }

  const col = (name: string) => headers.indexOf(name);
  const seenDocs = new Set<string>();
  const seenCodigos = new Set<string>();
  const rows: ImportRowResult[] = [];
  const stats = { ok: 0, update: 0, error: 0 };

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const fila = i + 2;
    const raw = buildRaw(headers, r);
    const get = (name: string) => r[col(name)]?.trim() ?? '';
    const result = validarFilaProveedor(fila, get, seenDocs, db, seenCodigos);
    result.raw = raw;
    rows.push(result);
    if (result.status === 'error') stats.error++; else if (result.status === 'update') stats.update++; else stats.ok++;
  }
  return { rows, stats };
}

function proveedorUpsertInternal(db: Db, row: ImportRowResult) {
  const data = row.data!;

  let existente: Record<string, unknown> | undefined;
  if (row.status === 'update') {
    existente = db.select({
      telefono_adicional: schema.proveedor.telefono_adicional,
      calle: schema.proveedor.calle,
      numero: schema.proveedor.numero,
      aclaracion: schema.proveedor.aclaracion,
      codigo_postal: schema.proveedor.codigo_postal,
      localidad: schema.proveedor.localidad,
      provincia: schema.proveedor.provincia,
    }).from(schema.proveedor).where(eq(schema.proveedor.id, data['id'] as string)).get();
  }
  completarCamposAusentes(data, existente, CAMPOS_OPCIONALES_DOMICILIO);

  proveedorUpsertHandler(db, {
    ...(data['id'] != null ? { id: data['id'] as string } : {}),
    tipo_documento: data['tipo_documento'] as 'DNI' | 'CUIT' | 'CUIL',
    numero_documento: data['numero_documento'] as string,
    razon_social: data['razon_social'] as string,
    condicion_fiscal: data['condicion_fiscal'] as 'Responsable Inscripto' | 'Monotributo' | 'Consumidor Final' | 'Exento',
    ...(data['nombre_fantasia'] != null ? { nombre_fantasia: data['nombre_fantasia'] as string } : {}),
    ...(data['telefono'] != null ? { telefono: data['telefono'] as string } : {}),
    ...(data['telefono_adicional'] != null ? { telefono_adicional: data['telefono_adicional'] as string } : {}),
    ...(data['calle'] != null ? { calle: data['calle'] as string } : {}),
    ...(data['numero'] != null ? { numero: data['numero'] as string } : {}),
    ...(data['aclaracion'] != null ? { aclaracion: data['aclaracion'] as string } : {}),
    ...(data['codigo_postal'] != null ? { codigo_postal: data['codigo_postal'] as string } : {}),
    ...(data['localidad'] != null ? { localidad: data['localidad'] as string } : {}),
    ...(data['provincia'] != null ? { provincia: data['provincia'] as string } : {}),
    ...(data['email'] != null ? { email: data['email'] as string } : {}),
    ...(data['persona_contacto'] != null ? { persona_contacto: data['persona_contacto'] as string } : {}),
    ...(data['observaciones'] != null ? { observaciones: data['observaciones'] as string } : {}),
    ...(data['codigo'] != null ? { codigo: data['codigo'] as string } : {}),
  });
}

export function confirmarProveedores(db: Db, payload: { rows: ImportRowResult[] }): ImportSummaryResult {
  const rows: SummaryRowResult[] = [];
  const stats = { created: 0, updated: 0, error: 0 };
  for (const row of payload.rows) {
    if (row.status === 'error' || !row.data) continue;
    try {
      db.transaction(() => {
        proveedorUpsertInternal(db, row);
      });
      if (row.status === 'ok') {
        rows.push({ fila: row.fila, status: 'created', mensaje: `${row.data['razon_social']} creado`, raw: row.raw });
        stats.created++;
      } else {
        rows.push({ fila: row.fila, status: 'updated', mensaje: `${row.data['razon_social']} actualizado`, raw: row.raw });
        stats.updated++;
      }
    } catch (e: unknown) {
      rows.push({ fila: row.fila, status: 'error', mensaje: toErrMsg(e), raw: row.raw });
      stats.error++;
    }
  }
  return { rows, stats };
}

const UBICACIONES_OBLIGATORIAS = ['sector', 'estante', 'posicion'];

function validarFilaUbicacion(
  fila: number,
  get: (name: string) => string,
  seenCodigos: Set<string>,
  db: Db,
): ImportRowResult {
  const rawSector = get('sector'); const rawEstante = get('estante'); const rawPosicion = get('posicion');
  if (!rawSector || !rawEstante || !rawPosicion) {
    return { fila, status: 'error', error: 'sector, estante y posicion son obligatorios' };
  }
  const { sector, estante, posicion, codigo } = canonicalizarUbicacion(rawSector, rawEstante, rawPosicion);
  if (seenCodigos.has(codigo)) {
    // Ya vista en este mismo archivo -> matchea a la existente (o a la recién insertada): update idempotente.
    const existenteEnArchivo = db.select({ id: schema.ubicacion.id }).from(schema.ubicacion)
      .where(eq(schema.ubicacion.codigo, codigo)).get();
    const data: Record<string, unknown> = { sector, estante, posicion, codigo, descripcion: get('descripcion') || null };
    if (existenteEnArchivo) { data['id'] = existenteEnArchivo.id; return { fila, status: 'update', matchKey: codigo, data }; }
    return { fila, status: 'update', matchKey: codigo, data };
  }
  seenCodigos.add(codigo);

  const existente = db.select({ id: schema.ubicacion.id }).from(schema.ubicacion)
    .where(eq(schema.ubicacion.codigo, codigo)).get();
  const data: Record<string, unknown> = { sector, estante, posicion, codigo, descripcion: get('descripcion') || null };
  if (existente) { data['id'] = existente.id; return { fila, status: 'update', matchKey: codigo, data }; }
  return { fila, status: 'ok', data };
}

export function validarUbicaciones(db: Db, payload: { csv: string }): ImportPreviewResult {
  const allRows = csvToRows(payload.csv);
  if (allRows.length < 2) return { rows: [], stats: { ok: 0, update: 0, error: 0 } };
  const [headers, ...dataRows] = allRows;

  const faltantes = UBICACIONES_OBLIGATORIAS.filter(c => !headers.includes(c));
  if (faltantes.length > 0) {
    return { rows: [], stats: { ok: 0, update: 0, error: 0 }, errorArchivo: `Faltan columnas obligatorias: ${faltantes.join(', ')}` };
  }

  const col = (name: string) => headers.indexOf(name);
  const seenCodigos = new Set<string>();
  const rows: ImportRowResult[] = [];
  const stats = { ok: 0, update: 0, error: 0 };

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const fila = i + 2;
    const raw = buildRaw(headers, r);
    const get = (name: string) => r[col(name)]?.trim() ?? '';
    const result = validarFilaUbicacion(fila, get, seenCodigos, db);
    result.raw = raw;
    rows.push(result);
    if (result.status === 'error') stats.error++; else if (result.status === 'update') stats.update++; else stats.ok++;
  }
  return { rows, stats };
}

function toErrMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error';
}

export function confirmarUbicaciones(db: Db, payload: { rows: ImportRowResult[] }): ImportSummaryResult {
  const session = getSession()!;
  const rows: SummaryRowResult[] = [];
  const stats = { created: 0, updated: 0, error: 0 };
  for (const row of payload.rows) {
    if (row.status === 'error' || !row.data) continue;
    try {
      const now = new Date();
      const sync = syncFields(now);
      db.transaction(tx => {
        if (row.status === 'ok') {
          tx.insert(schema.ubicacion).values({
            id: generateId(), codigo: row.data!['codigo'] as string,
            sector: row.data!['sector'] as string, estante: row.data!['estante'] as string,
            posicion: row.data!['posicion'] as string, descripcion: row.data!['descripcion'] as string | null,
            activo: true, usuario_creacion_id: session.userId, fecha_creacion: now, ...sync,
          }).run();
        } else {
          const targetId = (row.data!['id'] as string | undefined)
            ?? tx.select({ id: schema.ubicacion.id }).from(schema.ubicacion)
                 .where(eq(schema.ubicacion.codigo, row.data!['codigo'] as string)).get()?.id;
          if (!targetId) throw new Error(`NO_MATCH:${row.data!['codigo'] as string}`);
          tx.update(schema.ubicacion).set({
            descripcion: row.data!['descripcion'] as string | null,
            usuario_modificacion_id: session.userId, fecha_actualizacion: now, ...sync,
          }).where(eq(schema.ubicacion.id, targetId)).run();
        }
      });
      if (row.status === 'ok') { rows.push({ fila: row.fila, status: 'created', mensaje: `${row.data['codigo']} creada`, raw: row.raw }); stats.created++; }
      else { rows.push({ fila: row.fila, status: 'updated', mensaje: `${row.data['codigo']} actualizada`, raw: row.raw }); stats.updated++; }
    } catch (e: unknown) {
      rows.push({ fila: row.fila, status: 'error', mensaje: toErrMsg(e), raw: row.raw }); stats.error++;
    }
  }
  return { rows, stats };
}

function resolveProducto(db: Db, sku: string, gtin: string): { id: string; sku: string } | undefined {
  if (sku) {
    const found = db.select({ id: schema.producto.id, sku: schema.producto.sku }).from(schema.producto)
      .where(eq(schema.producto.sku, sku)).get();
    if (found) return found;
  }
  if (gtin) {
    return db.select({ id: schema.producto.id, sku: schema.producto.sku }).from(schema.producto)
      .where(eq(schema.producto.gtin_barcode, gtin)).get();
  }
  return undefined;
}

function validarFilaStockInicial(fila: number, get: (name: string) => string, db: Db): ImportRowResult {
  const sku = get('sku');
  const gtin = get('gtin_barcode');
  const cantStr = get('cantidad');

  if (!(sku || gtin)) return { fila, status: 'error', error: 'Se requiere sku o gtin_barcode' };
  const cantidad = Number.parseFloat(cantStr.replaceAll(',', '.'));
  if (Number.isNaN(cantidad) || cantidad <= 0) return { fila, status: 'error', error: 'cantidad debe ser un número positivo' };

  const prod = resolveProducto(db, sku, gtin);
  if (!prod) return { fila, status: 'error', error: `Producto no encontrado: sku="${sku}" gtin="${gtin}"` };

  return {
    fila, status: 'ok',
    data: { producto_id: prod.id, cantidad, costo_unitario: parseNum(get('costo_unitario')), observaciones: get('observaciones') || null },
    matchKey: `SKU ${prod.sku}`,
  };
}

export function validarStockInicial(db: Db, payload: { csv: string }): ImportPreviewResult {
  const allRows = csvToRows(payload.csv);
  if (allRows.length < 2) return { rows: [], stats: { ok: 0, update: 0, error: 0 } };
  const [headers, ...dataRows] = allRows;

  const tieneSku = headers.includes('sku');
  const tieneGtin = headers.includes('gtin_barcode');
  const tieneCantidad = headers.includes('cantidad');
  if (!(tieneSku || tieneGtin) || !tieneCantidad) {
    const faltan: string[] = [];
    if (!(tieneSku || tieneGtin)) faltan.push('sku o gtin_barcode (al menos una)');
    if (!tieneCantidad) faltan.push('cantidad');
    return { rows: [], stats: { ok: 0, update: 0, error: 0 }, errorArchivo: `Faltan columnas obligatorias: ${faltan.join(', ')}` };
  }

  const col = (name: string) => headers.indexOf(name);
  const rows: ImportRowResult[] = [];
  const stats = { ok: 0, update: 0, error: 0 };

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const fila = i + 2;
    const raw = buildRaw(headers, r);
    const get = (name: string) => (r[col(name)] ?? '').trim();
    const result = validarFilaStockInicial(fila, get, db);
    result.raw = raw;
    rows.push(result);
    if (result.status === 'error') stats.error++; else stats.ok++;
  }
  return { rows, stats };
}

export function confirmarStockInicial(db: Db, payload: { rows: ImportRowResult[] }): ImportSummaryResult {
  const session = getSession()!;
  const rows: SummaryRowResult[] = [];
  const stats = { created: 0, updated: 0, error: 0 };
  const now = new Date();

  for (const row of payload.rows) {
    if (row.status === 'error' || !row.data) continue;
    try {
      const { producto_id, cantidad, costo_unitario, observaciones } = row.data as { producto_id: string; cantidad: number; costo_unitario: number; observaciones: string | null };
      db.transaction(tx => {
        const exist = tx.select({ stock_fisico: schema.existencias.stock_fisico })
          .from(schema.existencias).where(eq(schema.existencias.producto_id, producto_id)).get();
        const stockPrev = exist?.stock_fisico ?? 0;
        const stockResultante = stockPrev + cantidad;
        tx.update(schema.existencias).set({ stock_fisico: stockResultante, ultima_fecha_movimiento: now, ...syncFields(now) })
          .where(eq(schema.existencias.producto_id, producto_id)).run();
        tx.insert(schema.movimiento_stock).values({
          id: generateId(), producto_id, tipo: 'entrada', motivo: 'inicial',
          cantidad, stock_resultante: stockResultante,
          costo_unitario: costo_unitario || null,
          referencia_tipo: 'importacion', referencia_id: 'importacion-masiva',
          usuario_id: session.userId, fecha: now,
          observaciones: observaciones ?? null,
          ...syncFields(now),
        }).run();
        if (costo_unitario && costo_unitario > 0) {
          const prod = tx.select({ precio_costo_promedio: schema.producto.precio_costo_promedio })
            .from(schema.producto).where(eq(schema.producto.id, producto_id)).get();
          const costoActual = prod?.precio_costo_promedio ?? 0;
          const nuevoCpp = (stockPrev * costoActual + cantidad * costo_unitario) / stockResultante;
          tx.update(schema.producto).set({ precio_costo_promedio: nuevoCpp, ...syncFields(now) })
            .where(eq(schema.producto.id, producto_id)).run();
        }
      });
      rows.push({ fila: row.fila, status: 'created', mensaje: `Stock inicial +${cantidad} (${row.matchKey})`, raw: row.raw });
      stats.created++;
    } catch (e: unknown) {
      rows.push({ fila: row.fila, status: 'error', mensaje: toErrMsg(e), raw: row.raw }); stats.error++;
    }
  }
  return { rows, stats };
}


const PLANTILLAS: Record<string, string> = {
  productos: [
    'sku;nombre;unidad_medida;precio_venta;iva_alicuota;rubro;codigo_barras;costo;stock_minimo;activo;marca;ubicacion;stock_inicial;stock_maximo;nombre_largo;descripcion_tecnica;garantia_meses;unidad_compra;factor_conversion;permite_fraccion',
    ';Martillo carpintero;u;3200;21;Herramientas manuales;;;;;Stanley;A-01-03;10;50;Martillo carpintero 16oz;;;;;',
  ].join('\n'),
  // ADR-058 — nombre/apellido reemplazan a razon_social (ADR-050 ya separó la
  // columna en el schema); apellido es opcional acá (ver resolverApellido en
  // confirmarClientes). Domicilio como texto libre, igual que ClienteForm (ADR-024).
  clientes: [
    'tipo_documento;numero_documento;nombre;apellido;condicion_fiscal;nombre_fantasia;telefono;telefono_adicional;calle;numero;aclaracion;codigo_postal;localidad;provincia;email;habilita_cuenta_corriente',
    'DNI;12345678;Juan;Perez;Consumidor Final;;;;;;;;;;;',
  ].join('\n'),
  // ADR-058 — razon_social NO cambia (proveedor no fue tocado por ADR-050). Se suma
  // codigo (único, igual que el alta manual) y domicilio como texto libre. Los
  // defaults comerciales de ADR-049 quedan fuera de esta importación a propósito.
  proveedores: [
    'tipo_documento;numero_documento;razon_social;condicion_fiscal;nombre_fantasia;telefono;telefono_adicional;calle;numero;aclaracion;codigo_postal;localidad;provincia;email;persona_contacto;observaciones;codigo',
    'CUIT;30712345678;Aceros SA;Responsable Inscripto;;;;;;;;;;;;;',
  ].join('\n'),
  ubicaciones: [
    'sector;estante;posicion;descripcion',
    'A;04;22;Tornillos y fijaciones',
  ].join('\n'),
  'stock-inicial': [
    'sku;gtin_barcode;cantidad;costo_unitario;observaciones',
    '00001;;50;120;Stock inicial apertura',
  ].join('\n'),
};

export function getPlantilla(entidad: string): string {
  return PLANTILLAS[entidad] ?? '';
}

export type PlantillaInfo = {
  csv: string;
  columnas: string[];
  ejemplo: string[];
  obligatorias: string[];
  orNote?: string;
};

const PLANTILLAS_OBLIGATORIAS: Record<string, { obligatorias: string[]; orNote?: string }> = {
  productos:       { obligatorias: PRODUCTOS_OBLIGATORIAS },
  clientes:        { obligatorias: CLIENTES_OBLIGATORIAS },
  proveedores:     { obligatorias: PROVEEDORES_OBLIGATORIAS },
  ubicaciones:     { obligatorias: UBICACIONES_OBLIGATORIAS },
  'stock-inicial': { obligatorias: ['cantidad'], orNote: 'sku o gtin_barcode (al menos una)' },
};

export function plantillaInfoHandler(entidad: string): PlantillaInfo {
  const csv = PLANTILLAS[entidad] ?? '';
  const [headerLine, ejemploLine] = csv.split('\n');
  const meta = PLANTILLAS_OBLIGATORIAS[entidad] ?? { obligatorias: [] };
  return {
    csv,
    columnas: headerLine ? headerLine.split(';') : [],
    ejemplo: ejemploLine ? ejemploLine.split(';') : [],
    obligatorias: meta.obligatorias,
    ...(meta.orNote !== undefined ? { orNote: meta.orNote } : {}),
  };
}

export type Entidad = 'productos' | 'clientes' | 'proveedores' | 'ubicaciones' | 'stockInicial';

// ADR-051 C.3: re-valida UNA fila editada en el preview, sin re-subir el archivo ni
// re-procesar las demás. Reconstruye el contexto de lookups en cada llamado (costo
// aceptable: es una edición manual puntual, no un loop de miles de filas) y usa
// Sets vacíos para los chequeos de "duplicado en el archivo" — no aplican fuera del
// contexto de un archivo completo.
export function validarFilaUnica(db: Db, entidad: Entidad, raw: Record<string, string>, fila: number): ImportRowResult {
  const get = (name: string) => (raw[name] ?? '').trim();
  const has = (name: string) => name in raw;

  switch (entidad) {
    case 'productos': {
      const categorias = db.select({ id: schema.categoria.id, nombre: schema.categoria.nombre })
        .from(schema.categoria).where(eq(schema.categoria.activo, true)).all();
      const catMap = new Map(categorias.map(c => [c.nombre.toLowerCase(), c.id]));
      const impuestos = db.select({ id: schema.impuesto.id, alicuota: schema.impuesto.alicuota })
        .from(schema.impuesto).where(eq(schema.impuesto.activo, true)).all();
      const impByAlicuota = new Map(impuestos.map(i => [i.alicuota, i.id]));
      const marcas = db.select({ id: schema.marca.id, nombre: schema.marca.nombre })
        .from(schema.marca).where(eq(schema.marca.activo, true)).all();
      const marcaMap = new Map(marcas.map(m => [m.nombre.toLowerCase(), m.id]));
      const ubicacionMap = buildUbicacionMap(db);
      return validarFilaProducto(fila, get, has, impByAlicuota, catMap, marcaMap, ubicacionMap, new Set(), new Set(), new Set(), db);
    }
    case 'clientes':
      return validarFilaCliente(fila, get, new Set(), db);
    case 'proveedores':
      return validarFilaProveedor(fila, get, new Set(), db, new Set());
    case 'ubicaciones':
      return validarFilaUbicacion(fila, get, new Set(), db);
    case 'stockInicial':
      return validarFilaStockInicial(fila, get, db);
  }
}

export function registerImportarHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('import.masiva');

  ipcMain.handle('importar:validarFila', guard(async (_, p) => {
    const { entidad, raw, fila } = p as { entidad: Entidad; raw: Record<string, string>; fila: number };
    const result = validarFilaUnica(db, entidad, raw, fila);
    result.raw = raw;
    return result;
  }));
  ipcMain.handle('importar:productos:validar',     guard(async (_, p) => validarProductos(db, p as { csv: string })));
  ipcMain.handle('importar:productos:confirmar',   guard(async (_, p) => confirmarProductos(db, p as { rows: ImportRowResult[] })));
  ipcMain.handle('importar:clientes:validar',      guard(async (_, p) => validarClientes(db, p as { csv: string })));
  ipcMain.handle('importar:clientes:confirmar',    guard(async (_, p) => confirmarClientes(db, p as { rows: ImportRowResult[] })));
  ipcMain.handle('importar:proveedores:validar',   guard(async (_, p) => validarProveedores(db, p as { csv: string })));
  ipcMain.handle('importar:proveedores:confirmar', guard(async (_, p) => confirmarProveedores(db, p as { rows: ImportRowResult[] })));
  ipcMain.handle('importar:ubicaciones:validar',   guard(async (_, p) => validarUbicaciones(db, p as { csv: string })));
  ipcMain.handle('importar:ubicaciones:confirmar', guard(async (_, p) => confirmarUbicaciones(db, p as { rows: ImportRowResult[] })));
  ipcMain.handle('importar:stock-inicial:validar',   guard(async (_, p) => validarStockInicial(db, p as { csv: string })));
  ipcMain.handle('importar:stock-inicial:confirmar', guard(async (_, p) => confirmarStockInicial(db, p as { rows: ImportRowResult[] })));
  ipcMain.handle('importar:plantilla',             guard(async (_, p) => {
    const { entidad } = p as { entidad: string };
    return plantillaInfoHandler(entidad);
  }));
}

export function confirmarProductos(db: Db, payload: { rows: ImportRowResult[] }): ImportSummaryResult {
  const session = getSession()!;
  const rows: SummaryRowResult[] = [];
  const stats = { created: 0, updated: 0, error: 0 };
  const now = new Date();

  for (const row of payload.rows) {
    if (row.status === 'error' || !row.data) continue;
    try {
      if (row.status === 'ok') {
        const id = generateId();
        const sync = syncFields(now);
        const costo = (row.data!['costo'] as number) || 0;
        let skuAsignado = '';
        let stockInicial = (row.data!['stock_inicial'] as number) || 0;

        db.transaction(tx => {
          // Leer y actualizar el contador de SKU atómicamente.
          const param = tx.select().from(schema.parametros_sistema)
            .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).get();
          if (!param) throw new Error('sku_proximo_secuencial no encontrado');
          const secuencial = Number.parseInt(param.valor, 10);
          skuAsignado = formatSku(secuencial);
          tx.update(schema.parametros_sistema)
            .set({ valor: String(secuencial + 1), actualizado_en: now })
            .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).run();

          tx.insert(schema.producto).values({
            id,
            sku: skuAsignado,
            sku_secuencial: secuencial,
            nombre_corto: row.data!['nombre'] as string,
            nombre_corto_norm: normalizarTermino(row.data!['nombre'] as string),
            nombre_largo: (row.data!['nombre_largo'] as string | null) ?? (row.data!['nombre'] as string),
            descripcion_tecnica: (row.data!['descripcion_tecnica'] as string | null) ?? null,
            garantia_meses: (row.data!['garantia_meses'] as number | null) ?? null,
            categoria_id: row.data!['categoria_id'] as string,
            impuesto_id: row.data!['impuesto_id'] as string,
            precio_venta_lista: row.data!['precio_venta_lista'] as number,
            unidad_venta: row.data!['unidad_venta'] as string,
            gtin_barcode: (row.data!['gtin_barcode'] as string | null) ?? null,
            precio_costo_promedio: costo,
            marca_id: (row.data!['marca_id'] as string | undefined) ?? null,
            ubicacion_id: (row.data!['ubicacion_id'] as string | undefined) ?? null,
            unidad_compra: (row.data!['unidad_compra'] as string | null | undefined) ?? null,
            factor_conversion: (row.data!['factor_conversion'] as number | null | undefined) ?? 1,
            permite_fraccion: (row.data!['permite_fraccion'] as boolean | undefined) ?? false,
            activo: (row.data!['activo'] as boolean) ?? true,
            moneda: 'ARS',
            usuario_creacion_id: session.userId,
            fecha_creacion: now,
            ...sync,
          }).run();
          tx.insert(schema.existencias).values({
            id: generateId(),
            producto_id: id,
            stock_fisico: 0,
            stock_minimo: (row.data!['stock_minimo'] as number) || 0,
            stock_maximo: (row.data!['stock_maximo'] as number | null | undefined) ?? null,
            ...sync,
          }).run();
          crearPresentacionDefault(
            tx as Db,
            id,
            row.data!['unidad_venta'] as string,
            session.userId,
            sync.origin_id,
          );
          if (stockInicial > 0) {
            tx.update(schema.existencias)
              .set({ stock_fisico: stockInicial, ultima_fecha_movimiento: now, ...sync })
              .where(eq(schema.existencias.producto_id, id)).run();
            tx.insert(schema.movimiento_stock).values({
              id: generateId(),
              producto_id: id,
              tipo: 'entrada',
              motivo: 'inicial',
              cantidad: stockInicial,
              stock_resultante: stockInicial,
              costo_unitario: costo || null,
              referencia_tipo: 'importacion',
              referencia_id: 'importacion-masiva',
              usuario_id: session.userId,
              fecha: now,
              observaciones: null,
              ...sync,
            }).run();
          }
        });
        const stockMsg = stockInicial > 0 ? ` (+${stockInicial} uds stock inicial)` : '';
        rows.push({ fila: row.fila, status: 'created', mensaje: `${row.data['nombre']} — SKU ${skuAsignado}${stockMsg}`, raw: row.raw });
        stats.created++;
      } else {
        const id = row.data['id'] as string;
        const stockInicial = (row.data!['stock_inicial'] as number) || 0;
        const stockActual = (row.data!['stock_actual'] as number) ?? 0;

        db.transaction(tx => {
          tx.update(schema.producto).set({
            nombre_corto: row.data!['nombre'] as string,
            // ADR-065: mantener el norm en sync con el nombre — si no, tras un rename por
            // SKU la detección de POSIBLE_DUPLICADO por nombre queda contra un norm viejo.
            nombre_corto_norm: normalizarTermino(row.data!['nombre'] as string),
            nombre_largo: 'nombre_largo' in row.data!
              ? ((row.data!['nombre_largo'] as string | null) ?? (row.data!['nombre'] as string))
              : (row.data!['nombre'] as string),
            precio_venta_lista: row.data!['precio_venta_lista'] as number,
            activo: (row.data!['activo'] as boolean) ?? true,
            ...('marca_id' in row.data! ? { marca_id: row.data!['marca_id'] as string | null } : {}),
            ...('ubicacion_id' in row.data! ? { ubicacion_id: row.data!['ubicacion_id'] as string | null } : {}),
            ...('descripcion_tecnica' in row.data! ? { descripcion_tecnica: row.data!['descripcion_tecnica'] as string | null } : {}),
            ...('garantia_meses' in row.data! ? { garantia_meses: row.data!['garantia_meses'] as number | null } : {}),
            ...('unidad_compra' in row.data! ? { unidad_compra: row.data!['unidad_compra'] as string | null } : {}),
            ...('factor_conversion' in row.data! ? { factor_conversion: row.data!['factor_conversion'] as number } : {}),
            ...('permite_fraccion' in row.data! ? { permite_fraccion: row.data!['permite_fraccion'] as boolean } : {}),
            usuario_modificacion_id: session.userId,
            fecha_actualizacion: now,
            ...syncFields(now),
          }).where(eq(schema.producto.id, id)).run();

          // Update existencias if stock_minimo or stock_maximo provided
          let hasExistUpdate = false;
          const existUpdate: Record<string, unknown> = { ...syncFields(now) };
          if ('stock_minimo' in row.data!) { existUpdate['stock_minimo'] = (row.data!['stock_minimo'] as number) || 0; hasExistUpdate = true; }
          if ('stock_maximo' in row.data!) { existUpdate['stock_maximo'] = row.data!['stock_maximo'] as number | null; hasExistUpdate = true; }
          if (hasExistUpdate) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tx.update(schema.existencias).set(existUpdate as any)
              .where(eq(schema.existencias.producto_id, id)).run();
          }

          // Stock inicial: only if stock_actual===0 and stock_inicial>0
          if (stockInicial > 0 && stockActual === 0) {
            const costo = (row.data!['costo'] as number) || 0;
            tx.update(schema.existencias)
              .set({ stock_fisico: stockInicial, ultima_fecha_movimiento: now, ...syncFields(now) })
              .where(eq(schema.existencias.producto_id, id)).run();
            tx.insert(schema.movimiento_stock).values({
              id: generateId(),
              producto_id: id,
              tipo: 'entrada',
              motivo: 'inicial',
              cantidad: stockInicial,
              stock_resultante: stockInicial,
              costo_unitario: costo || null,
              referencia_tipo: 'importacion',
              referencia_id: 'importacion-masiva',
              usuario_id: session.userId,
              fecha: now,
              observaciones: null,
              ...syncFields(now),
            }).run();
            // Update CPP if costo > 0
            if (costo > 0) {
              tx.update(schema.producto)
                .set({ precio_costo_promedio: costo, ...syncFields(now) })
                .where(eq(schema.producto.id, id)).run();
            }
          }
        });

        const stockMsg = stockInicial > 0
          ? stockActual === 0
            ? ` (+${stockInicial} uds stock inicial)`
            : ` [stock ignorado: ya tenía ${stockActual} uds]`
          : '';
        rows.push({ fila: row.fila, status: 'updated', mensaje: `${row.data['nombre']} actualizado (${row.matchKey})${stockMsg}`, raw: row.raw });
        stats.updated++;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al persistir';
      rows.push({ fila: row.fila, status: 'error', mensaje: msg, raw: row.raw });
      stats.error++;
    }
  }
  return { rows, stats };
}
