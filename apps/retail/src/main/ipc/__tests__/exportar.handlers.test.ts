import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { exportarEjecutar } from '../exportar';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { ubicacionCreateHandler } from '../ubicacion';
import * as schema from '../../db/schema';

let db: ReturnType<typeof setupDb>;
let tmpDir: string;

beforeEach(() => {
  db = setupDb();
  runCatalogSeed(db);
  clearSession();
  loginAsAdmin(db);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('exportarEjecutar — permisos', () => {
  it('lanza UNAUTHENTICATED sin sesión', async () => {
    clearSession();
    await expect(exportarEjecutar(db, {
      entidad: 'productos', perfilId: 'control-stock',
      formato: 'csv', alcance: 'todo',
    }, path.join(tmpDir, 'out.csv'))).rejects.toThrow('UNAUTHENTICATED');
  });

  it('lanza ENTIDAD_DESCONOCIDA para entidad inválida', async () => {
    await expect(exportarEjecutar(db, {
      entidad: 'inexistente', perfilId: 'cualquiera',
      formato: 'csv', alcance: 'todo',
    }, path.join(tmpDir, 'out.csv'))).rejects.toThrow('ENTIDAD_DESCONOCIDA');
  });

  it('lanza PERFIL_DESCONOCIDO para perfil inválido', async () => {
    await expect(exportarEjecutar(db, {
      entidad: 'productos', perfilId: 'no-existe',
      formato: 'csv', alcance: 'todo',
    }, path.join(tmpDir, 'out.csv'))).rejects.toThrow('PERFIL_DESCONOCIDO');
  });

  it('lanza FORMATO_NO_PERMITIDO para xlsx en perfil reimportable', async () => {
    await expect(exportarEjecutar(db, {
      entidad: 'productos', perfilId: 'reimportable',
      formato: 'xlsx', alcance: 'todo',
    }, path.join(tmpDir, 'out.xlsx'))).rejects.toThrow('FORMATO_NO_PERMITIDO');
  });
});

describe('exportarEjecutar — escritura CSV', () => {
  it('escribe un CSV con BOM para productos (perfil control-stock)', async () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Herramientas' });
    const imp = db.select().from(schema.impuesto).get()!;
    productoCreateHandler(db, {
      nombre_corto: 'Tornillo M6', categoria_id: cat.id,
      impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100,
    });

    const filePath = path.join(tmpDir, 'productos.csv');
    await exportarEjecutar(db, {
      entidad: 'productos', perfilId: 'control-stock',
      formato: 'csv', alcance: 'todo',
    }, filePath);

    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content.charCodeAt(0)).toBe(0xFEFF);
    expect(content).toContain('Tornillo M6');
  });

  it('escribe un CSV para ubicaciones', async () => {
    ubicacionCreateHandler(db, { sector: 'B', estante: '02', posicion: '01' });

    const filePath = path.join(tmpDir, 'ubicaciones.csv');
    await exportarEjecutar(db, {
      entidad: 'ubicaciones', perfilId: 'completo',
      formato: 'csv', alcance: 'todo',
    }, filePath);

    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    // Forma canónica (ADR-064): sector B / estante 02 / posicion 01 -> 'B-2-1'.
    expect(content).toContain('B-2-1');
  });
});

describe('exportarEjecutar — escritura XLSX', () => {
  it('escribe un XLSX válido para ubicaciones', async () => {
    ubicacionCreateHandler(db, { sector: 'C', estante: '03', posicion: '01' });

    const filePath = path.join(tmpDir, 'ubicaciones.xlsx');
    await exportarEjecutar(db, {
      entidad: 'ubicaciones', perfilId: 'completo',
      formato: 'xlsx', alcance: 'todo',
    }, filePath);

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
  });
});
