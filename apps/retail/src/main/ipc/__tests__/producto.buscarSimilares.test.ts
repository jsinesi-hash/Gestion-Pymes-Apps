import { describe, it, expect } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler, buscarSimilaresHandler } from '../producto';
import { listaPrecioCreateHandler } from '../lista-precio';
import { setManualHandler } from '../lista-precio-valor';
import { presentacionCreateHandler, presentacionSetDefaultHandler } from '../presentacion';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;

function seedProductos(db: Db) {
  runCatalogSeed(db); // provee un impuesto por defecto
  const cat = categoriaCreateHandler(db, { nombre: 'Ferretería test' });
  const imp = db.select().from(schema.impuesto).all()[0];
  const mk = (nombre_corto: string) => productoCreateHandler(db, {
    nombre_corto, categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'unidad', precio_venta_lista: 100,
  });
  return {
    tarugo:   mk('Tarugo plástico 8mm'),
    tornillo: mk('Tornillo cabeza plana 3x25'),
    martillo: mk('Martillo 500g'),
  };
}

describe('buscarSimilaresHandler (servicio de búsqueda por similitud en Catálogo)', () => {
  it('encuentra "Tarugo ... 8mm" aunque se busque con la unidad separada ("tarugo 8 mm")', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { tarugo } = seedProductos(db);
    const res = buscarSimilaresHandler(db, { texto: 'tarugo 8 mm' });
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].producto_id).toBe(tarugo.id);
    expect(res[0].score).toBeGreaterThan(0);
  });

  it('devuelve resultados rankeados por score descendente', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    seedProductos(db);
    const res = buscarSimilaresHandler(db, { texto: 'tornillo cabeza plana', piso: 0.1 });
    expect(res.length).toBeGreaterThan(0);
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].score).toBeGreaterThanOrEqual(res[i].score);
    }
    expect(res[0].nombre_corto.toLowerCase()).toContain('tornillo');
  });

  it('respeta el límite de resultados', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    seedProductos(db);
    const res = buscarSimilaresHandler(db, { texto: 'tornillo', limite: 1, piso: 0.01 });
    expect(res.length).toBeLessThanOrEqual(1);
  });

  it('texto vacío → sin resultados (nunca match automático)', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    seedProductos(db);
    expect(buscarSimilaresHandler(db, { texto: '   ' })).toEqual([]);
  });

  it('enriquece cada candidato con precio final vigente, origen, stock y marca', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { tarugo } = seedProductos(db);
    listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, predeterminada: true });

    const res = buscarSimilaresHandler(db, { texto: 'tarugo 8 mm' });
    const cand = res.find(r => r.producto_id === tarugo.id)!;
    expect(cand.precio_final_centavos).toBe(10000);
    expect(cand.precio_origen).toBe('vigente');
    expect(cand.stock_fisico).toBe(0);
    expect(cand).toHaveProperty('marca_nombre');
  });

  it('sin lista predeterminada, el precio cae a fallback (precio_venta_lista)', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { tarugo } = seedProductos(db);
    const res = buscarSimilaresHandler(db, { texto: 'tarugo 8 mm' });
    const cand = res.find(r => r.producto_id === tarugo.id)!;
    expect(cand.precio_final_centavos).toBe(10000);
    expect(cand.precio_origen).toBe('fallback');
  });

  it('aplica el factor de la presentación default (precio por unidad por defecto)', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { tarugo } = seedProductos(db);
    listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, predeterminada: true });
    const unidad = db.select().from(schema.unidad).all()[0];
    const pp = presentacionCreateHandler(db, { producto_id: tarugo.id, unidad_id: unidad.id, factor_a_stock: 6 });
    presentacionSetDefaultHandler(db, { id: pp.id });

    const res = buscarSimilaresHandler(db, { texto: 'tarugo 8 mm' });
    const cand = res.find(r => r.producto_id === tarugo.id)!;
    expect(cand.precio_final_centavos).toBe(60000);
  });

  it('con clienteId que tiene lista propia, usa esa lista', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { tarugo } = seedProductos(db);
    listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, predeterminada: true });
    const especial = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: 0, predeterminada: false });
    setManualHandler(db, { listaId: especial.id, productoId: tarugo.id, precioCentavos: 7500 });
    const clienteId = 'c1000000-0000-0000-0000-000000000099';
    db.insert(schema.cliente).values({
      id: clienteId, tipo_documento: 'DNI', numero_documento: '1', nombre: 'Test', apellido: 'Cliente',
      condicion_fiscal: 'Consumidor Final', lista_precio_id: especial.id, activo: true,
      usuario_creacion_id: 'test', fecha_creacion: new Date(),
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: new Date(),
    }).run();

    const res = buscarSimilaresHandler(db, { texto: 'tarugo 8 mm', clienteId });
    const cand = res.find(r => r.producto_id === tarugo.id)!;
    expect(cand.precio_final_centavos).toBe(7500);
  });
});
