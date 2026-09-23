import fs from 'node:fs';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { DefinicionExport, ExportRequest } from '@ferreteria/shared';
import { exportClientes, exportCaja, exportCtaCte } from '@ferreteria/shared';
import type * as coreSchema from '@core/db';
import { getSession } from '../auth/session';
import { buildCsv } from '../export/csv-writer';
import { buildXlsx } from '../export/xlsx-writer';
import { clienteQueryAll } from './cliente';
import { cajaArqueosQueryAll } from './caja';
import { ctacteQueryAll } from './ctacte';

type Db = BetterSQLite3Database<typeof coreSchema>;

export type Exportador = {
  definicion: DefinicionExport<any>;
  fetch: (db: Db, req: ExportRequest) => Record<string, unknown>[];
};

export type ExportarEjecutar = (db: Db, req: ExportRequest, filePath: string) => Promise<void>;

export const EXPORTADORES_CORE: readonly Exportador[] = [
  { definicion: exportClientes, fetch: (db) => clienteQueryAll(db) as Record<string, unknown>[] },
  { definicion: exportCaja,     fetch: (db) => cajaArqueosQueryAll(db) as Record<string, unknown>[] },
  { definicion: exportCtaCte,   fetch: (db) => ctacteQueryAll(db) as Record<string, unknown>[] },
];

export function crearExportarEjecutar(exportadores: readonly Exportador[]): ExportarEjecutar {
  const porEntidad = new Map<string, Exportador>();
  for (const e of exportadores) {
    if (porEntidad.has(e.definicion.entidad)) throw new Error('EXPORTADOR_DUPLICADO');
    porEntidad.set(e.definicion.entidad, e);
  }
  return async (db, req, filePath) => {
    const session = getSession();
    if (!session) throw new Error('UNAUTHENTICATED');
    const exp = porEntidad.get(req.entidad);
    if (!exp) throw new Error('ENTIDAD_DESCONOCIDA');
    const def = exp.definicion;
    if (!session.permisos.has(def.permiso)) throw new Error('FORBIDDEN');
    const perfil = def.perfiles.find((p) => p.id === req.perfilId);
    if (!perfil) throw new Error('PERFIL_DESCONOCIDO');
    if (!session.permisos.has(perfil.permiso)) throw new Error('FORBIDDEN');
    if (perfil.soloFormatos && !perfil.soloFormatos.includes(req.formato)) throw new Error('FORMATO_NO_PERMITIDO');
    const filas = exp.fetch(db, req);
    if (req.formato === 'csv') fs.writeFileSync(filePath, buildCsv(perfil.columnas as any, filas), 'utf8');
    else fs.writeFileSync(filePath, await buildXlsx(perfil.columnas as any, filas, def.label));
  };
}

export function registerExportarHandlers(ipcMain: IpcMain, db: Db, ejecutar: ExportarEjecutar): void {
  ipcMain.handle('exportar:ejecutar', async (_e, req: ExportRequest) => {
    const session = getSession();
    if (!session) throw new Error('UNAUTHENTICATED');
    const { dialog } = await import('electron');
    const ext = req.formato === 'csv' ? 'csv' : 'xlsx';
    const result = await dialog.showSaveDialog({
      defaultPath: `export.${ext}`,
      filters: req.formato === 'csv'
        ? [{ name: 'CSV', extensions: ['csv'] }]
        : [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePath) return;
    await ejecutar(db, req, result.filePath);
  });
}
