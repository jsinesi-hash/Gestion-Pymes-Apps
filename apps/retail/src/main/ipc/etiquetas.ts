import { eq, and, or, like, gt, sql, asc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { requireSession } from '@core/main';
import type { PerfilEtiqueta, EtiquetaItem } from '@ferreteria/shared';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BrowserWindow, dialog, app, shell } from 'electron';
import { generarLayoutHoja } from '@ferreteria/shared';
import type { CeldaLayout } from '@ferreteria/shared';
import QRCode from 'qrcode';

type Db = BetterSQLite3Database<typeof schema>;

export type ListarProductosParams = {
  q?: string;
  categoriaId?: string;
  ubicacionId?: string;
  stockStatus?: 'con' | 'sin';
};

export type GenerarPdfParams = {
  items: EtiquetaItem[];
  perfil: PerfilEtiqueta;
  celdaInicio: number;
};

const PERFILES_CLAVE = 'etiquetas_perfiles';

export function etiquetasListarProductosHandler(db: Db, params: ListarProductosParams): EtiquetaItem[] {
  requireSession();
  const { q, categoriaId, ubicacionId, stockStatus } = params;

  const rows = db.select({
    producto_id:        schema.producto.id,
    sku:                schema.producto.sku,
    nombre:             schema.producto.nombre_corto,
    precio_venta_lista: schema.producto.precio_venta_lista,
    gtin_barcode:       schema.producto.gtin_barcode,
  })
    .from(schema.producto)
    .leftJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .where(and(
      eq(schema.producto.activo, true),
      q ? or(
        like(schema.producto.nombre_corto, `%${q}%`),
        like(schema.producto.sku,          `%${q}%`),
      ) : undefined,
      categoriaId ? eq(schema.producto.categoria_id, categoriaId) : undefined,
      ubicacionId ? eq(schema.producto.ubicacion_id, ubicacionId) : undefined,
      stockStatus === 'con' ? gt(schema.existencias.stock_fisico, 0) : undefined,
      stockStatus === 'sin'
        ? sql`(${schema.existencias.stock_fisico} IS NULL OR ${schema.existencias.stock_fisico} = 0)`
        : undefined,
    ))
    .orderBy(asc(schema.producto.nombre_corto))
    .all();

  return rows.map(r => ({
    producto_id: r.producto_id,
    sku:         r.sku,
    nombre:      r.nombre,
    precio_venta_lista_centavos: Math.round(r.precio_venta_lista * 100),
    gtin_barcode: r.gtin_barcode ?? null,
  }));
}

export function etiquetasListarPerfilesHandler(db: Db): PerfilEtiqueta[] {
  requireSession();
  const row = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, PERFILES_CLAVE))
    .get();
  if (!row) return [];
  return JSON.parse(row.valor) as PerfilEtiqueta[];
}

export function etiquetasGuardarPerfilHandler(db: Db, perfil: PerfilEtiqueta): PerfilEtiqueta[] {
  const session = requireSession();
  const existing = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, PERFILES_CLAVE))
    .get();

  const perfiles: PerfilEtiqueta[] = existing ? JSON.parse(existing.valor) : [];
  const idx = perfiles.findIndex(p => p.id === perfil.id);
  if (idx >= 0) perfiles[idx] = perfil;
  else perfiles.push(perfil);

  const valor = JSON.stringify(perfiles);
  const ahora = new Date();

  if (existing) {
    db.update(schema.parametros_sistema)
      .set({ valor, actualizado_en: ahora, actualizado_por: session.userId })
      .where(eq(schema.parametros_sistema.clave, PERFILES_CLAVE))
      .run();
  } else {
    db.insert(schema.parametros_sistema)
      .values({
        clave:           PERFILES_CLAVE,
        valor,
        tipo:            'string',
        descripcion:     'Perfiles de etiqueta de góndola',
        actualizado_en:  ahora,
        actualizado_por: session.userId,
      })
      .run();
  }

  return perfiles;
}

// CODE128B encoding table: values 0–105 are data/special codes, START_B=104
const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312',
  '132212','221213','221312','231212','112232','122132','122231','113222',
  '123122','123221','223211','221132','221231','213212','223112','312131',
  '311222','321122','321221','312212','322112','322211','212123','212321',
  '232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321',
  '331121','312113','312311','332111','314111','221411','431111','111224',
  '111422','121124','121421','141122','141221','112214','112412','122114',
  '122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112',
  '421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412',
  '211214','211232',
];
const CODE128_STOP = '2331112';

function generateCode128Svg(text: string): string {
  const codes: number[] = [104]; // START_B
  for (const ch of text) {
    const v = ch.charCodeAt(0) - 32;
    if (v < 0 || v > 95) throw new Error(`Caracter no soportado en CODE128B: ${ch}`);
    codes.push(v);
  }
  let check = 104;
  for (let i = 1; i < codes.length; i++) check += i * codes[i];
  codes.push(check % 103);

  const patterns = [...codes.map(c => CODE128_PATTERNS[c]), CODE128_STOP];

  let total = 20; // quiet zones 10+10
  for (const p of patterns) for (const c of p) total += +c;

  const H = 40;
  let x = 10;
  const rects: string[] = [];
  for (const p of patterns) {
    let bar = true;
    for (const c of p) {
      if (bar) rects.push(`<rect x="${x}" y="0" width="${+c}" height="${H}"/>`);
      x += +c;
      bar = !bar;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${H}" style="width:100%;height:auto;display:block;">${rects.join('')}</svg>`;
}

async function generateQrSvg(text: string): Promise<string> {
  const raw = await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  // Remove fixed pixel dimensions so CSS controls scaling
  return raw.replace(/ width="\d+(\.\d+)?(px)?"/, '').replace(/ height="\d+(\.\d+)?(px)?"/, '');
}

function formatPrecio(centavos: number): string {
  const pesos = centavos / 100;
  return `$ ${pesos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function generarHtmlEtiquetas(layouts: CeldaLayout[], perfil: PerfilEtiqueta): Promise<string> {
  const svgs = await Promise.all(
    layouts.map(c => {
      const value = c.item.gtin_barcode ?? c.item.sku;
      return perfil.barcode_tipo === 'code128'
        ? Promise.resolve(generateCode128Svg(value))
        : generateQrSvg(value);
    }),
  );

  const layoutIdx = new Map(layouts.map((l, i) => [l, i]));
  const paginas = new Map<number, CeldaLayout[]>();
  for (const celda of layouts) {
    if (!paginas.has(celda.pagina)) paginas.set(celda.pagina, []);
    paginas.get(celda.pagina)!.push(celda);
  }

  const pageSize = perfil.tipo === 'hoja' ? 'A4' : `${perfil.ancho_mm}mm ${perfil.alto_mm}mm`;

  const paginasHtml = [...paginas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, celdas]) => {
      const celdasHtml = celdas.map(c => {
        const i = layoutIdx.get(c) ?? 0;
        const eanLine = c.item.gtin_barcode
          ? `EAN: ${c.item.gtin_barcode}  ·  ${c.item.sku}`
          : c.item.sku;
        return `<div class="celda" style="left:${c.x_mm}mm;top:${c.y_mm}mm;width:${c.ancho_mm}mm;height:${c.alto_mm}mm;">
            <div class="cn">${c.item.nombre}</div>
            <div class="cp">${formatPrecio(c.item.precio_venta_lista_centavos)}</div>
            <div class="bc">${svgs[i]}</div>
            <div class="ean">${eanLine}</div>
          </div>`;
      }).join('');
      return `<div class="page">${celdasHtml}</div>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#fff;}
  @page{size:${pageSize};margin:0;}
  .page{width:${perfil.ancho_mm}mm;height:${perfil.alto_mm}mm;position:relative;page-break-after:always;overflow:hidden;}
  .celda{position:absolute;overflow:hidden;display:flex;flex-direction:column;align-items:center;padding:1mm;}
  .cn{font-size:8pt;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:center;width:100%;}
  .cp{font-size:12pt;font-weight:800;text-align:center;width:100%;margin:1mm 0;}
  .bc{width:100%;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}
  .bc svg{max-width:100%;max-height:100%;display:block;}
  .ean{font-family:monospace;font-size:5.5pt;text-align:center;color:#333;width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin-top:0.5mm;}
</style>
</head><body>
${paginasHtml}
</body></html>`;
}

// HTML is static (pre-rendered barcodes) – no nodeIntegration required
async function generarPdfConWindow(htmlContent: string): Promise<{ buffer: Buffer; win: BrowserWindow }> {
  const tmpPath = path.join(os.tmpdir(), `etiquetas-${Date.now()}.html`);
  fs.writeFileSync(tmpPath, htmlContent, 'utf-8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await win.loadFile(tmpPath);
    // `marginsType: 1` era la API vieja de Electron para "sin márgenes"; ya no existe y
    // se ignoraba en silencio (las etiquetas salían con el margen por defecto).
    const buffer = await win.webContents.printToPDF({ margins: { marginType: 'none' }, printBackground: true });
    fs.unlinkSync(tmpPath);
    return { buffer, win };
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    win.destroy();
    throw e;
  }
}

export async function etiquetasGenerarPdfHandler(db: Db, params: GenerarPdfParams): Promise<Buffer> {
  requireSession();
  const layouts = generarLayoutHoja(params.perfil, params.items, params.celdaInicio);
  const html = await generarHtmlEtiquetas(layouts, params.perfil);
  const { buffer, win } = await generarPdfConWindow(html);
  win.close();
  return buffer;
}

// Vista previa: generates PDF, saves to temp file, opens with system PDF viewer.
// Using window.open(blob_url) doesn't work in Electron (blob URLs are process-local).
export async function etiquetasVistaPreviewHandler(db: Db, params: GenerarPdfParams): Promise<{ ok: boolean }> {
  requireSession();
  const layouts = generarLayoutHoja(params.perfil, params.items, params.celdaInicio);
  const html = await generarHtmlEtiquetas(layouts, params.perfil);
  const { buffer, win } = await generarPdfConWindow(html);
  win.close();
  const tmpPdf = path.join(os.tmpdir(), `etiquetas-preview-${Date.now()}.pdf`);
  fs.writeFileSync(tmpPdf, buffer);
  await shell.openPath(tmpPdf);
  return { ok: true };
}

export async function etiquetasImprimirHandler(db: Db, params: GenerarPdfParams): Promise<void> {
  requireSession();
  const layouts = generarLayoutHoja(params.perfil, params.items, params.celdaInicio);
  const html    = await generarHtmlEtiquetas(layouts, params.perfil);

  const tmpPath = path.join(os.tmpdir(), `etiquetas-print-${Date.now()}.html`);
  fs.writeFileSync(tmpPath, html, 'utf-8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await win.loadFile(tmpPath);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('print() timeout')), 60_000);
      win.webContents.print({ silent: false, printBackground: true }, () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    win.destroy();
  }
}

export async function etiquetasExportarPdfHandler(
  db: Db,
  params: GenerarPdfParams,
): Promise<{ guardado: boolean; ruta?: string }> {
  requireSession();

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Exportar etiquetas a PDF',
    defaultPath: path.join(app.getPath('documents'), 'etiquetas.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (canceled || !filePath) return { guardado: false };

  const layouts = generarLayoutHoja(params.perfil, params.items, params.celdaInicio);
  const html    = await generarHtmlEtiquetas(layouts, params.perfil);
  const { buffer, win } = await generarPdfConWindow(html);
  win.close();

  fs.writeFileSync(filePath, buffer);
  return { guardado: true, ruta: filePath };
}

export function registerEtiquetasHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('etiquetas:listar-productos', async (_e, p) => etiquetasListarProductosHandler(db, p ?? {}));
  ipcMain.handle('etiquetas:listar-perfiles',  async ()     => etiquetasListarPerfilesHandler(db));
  ipcMain.handle('etiquetas:guardar-perfil',   async (_e, p) => etiquetasGuardarPerfilHandler(db, p));
  ipcMain.handle('etiquetas:generar-pdf',      async (_e, p) => etiquetasGenerarPdfHandler(db, p));
  ipcMain.handle('etiquetas:vista-previa',     async (_e, p) => etiquetasVistaPreviewHandler(db, p));
  ipcMain.handle('etiquetas:imprimir',         async (_e, p) => etiquetasImprimirHandler(db, p));
  ipcMain.handle('etiquetas:exportar-pdf',     async (_e, p) => etiquetasExportarPdfHandler(db, p));
}
