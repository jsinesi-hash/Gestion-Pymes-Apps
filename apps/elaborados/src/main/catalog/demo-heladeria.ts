import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { articuloCreateHandler } from '../ipc/articulo';
import { movimientoArticuloCreateHandler } from '../ipc/movimiento-articulo';
import { recetaProduccionSetHandler } from '../ipc/receta-produccion';
import { produccionCrearHandler } from '../ipc/produccion';
import { categoriaVentaCreateHandler } from '../ipc/categoria-venta';
import { grupoModificadorCreateHandler, grupoModificadorOpcionSetHandler } from '../ipc/grupo-modificador';
import { productoVentaCreateHandler } from '../ipc/producto-venta';
import { snapshotIds, registrarDiferencia } from './demo-registro';

type Db = BetterSQLite3Database<typeof schema>;

const SABORES = [
  'Chocolate', 'Vainilla', 'Dulce de Leche', 'Frutilla',
  'Limón', 'Menta Granizada', 'Americana', 'Crema del Cielo',
] as const;

function yaSembrado(db: Db): boolean {
  return db.select({ id: schema.producto_venta.id }).from(schema.producto_venta).limit(1).all().length > 0;
}

function categoriaPorNombre(db: Db, nombre: string, orden: number) {
  return db.select().from(schema.categoria_venta).where(eq(schema.categoria_venta.nombre, nombre)).get()
    ?? categoriaVentaCreateHandler(db, { nombre, orden });
}

function grupoPorNombre(db: Db, nombre: string) {
  return db.select().from(schema.grupo_modificador).where(eq(schema.grupo_modificador.nombre, nombre)).get()
    ?? grupoModificadorCreateHandler(db, { nombre });
}

/** Siembra el catálogo demo de forma atómica y anota lo creado en `demo_registro` (ADR-110) para poder vaciarlo. */
export function runDemoHeladeriaSeed(db: Db): void {
  if (yaSembrado(db)) return;
  db.transaction((tx) => {
    const antes = snapshotIds(tx);
    sembrarDemo(tx);
    registrarDiferencia(tx, antes);
  });
}

function sembrarDemo(db: Db): void {
  const impuesto = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;

  // ── Insumos ────────────────────────────────────────────────────────────────
  const leche = articuloCreateHandler(db, { nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false });
  const crema = articuloCreateHandler(db, { nombre: 'Crema de leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false });
  const azucar = articuloCreateHandler(db, { nombre: 'Azúcar', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false });
  const banana = articuloCreateHandler(db, { nombre: 'Banana', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false });
  for (const insumo of [leche, crema, azucar, banana]) {
    movimientoArticuloCreateHandler(db, { articulo_id: insumo.id, motivo: 'compra', cantidad: 200, costo_unitario_centavos: 30000 });
  }
  const saborizantes = SABORES.map((s) =>
    articuloCreateHandler(db, { nombre: `Saborizante ${s}`, tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false })
  );
  for (const sabz of saborizantes) {
    movimientoArticuloCreateHandler(db, { articulo_id: sabz.id, motivo: 'compra', cantidad: 20, costo_unitario_centavos: 150000 });
  }

  // ── 8 sabores con receta (rinde 12kg: 6 leche + 3 crema + 2 azúcar + 1 saborizante) ──
  const grupoSabores = grupoPorNombre(db, 'Sabores');
  const opcionesSabores: { articulo_id: string; nombre: string; recargo_centavos: number; cantidad: number; orden: number }[] = [];
  SABORES.forEach((nombreSabor, i) => {
    const sabz = saborizantes[i];
    const sabor = articuloCreateHandler(db, { nombre: nombreSabor, tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    recetaProduccionSetHandler(db, {
      articulo_id: sabor.id, rinde_cantidad: 12,
      items: [
        { articulo_id: leche.id, cantidad: 6 },
        { articulo_id: crema.id, cantidad: 3 },
        { articulo_id: azucar.id, cantidad: 2 },
        { articulo_id: sabz.id, cantidad: 1 },
      ],
    });
    produccionCrearHandler(db, { articulo_id: sabor.id, cantidad_producida: 12, observaciones: 'Lote demo inicial' });
    opcionesSabores.push({ articulo_id: sabor.id, nombre: nombreSabor, recargo_centavos: 0, cantidad: 0, orden: i + 1 });
  });
  grupoModificadorOpcionSetHandler(db, { grupo_modificador_id: grupoSabores.id, opciones: opcionesSabores });

  // ── Envases + reventa directa ─────────────────────────────────────────────
  const poteCuarto = articuloCreateHandler(db, { nombre: 'Pote 1/4 kg', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const poteMedio = articuloCreateHandler(db, { nombre: 'Pote 1/2 kg', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const poteUno = articuloCreateHandler(db, { nombre: 'Pote 1 kg', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const cucurucho = articuloCreateHandler(db, { nombre: 'Cucurucho', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const vasito = articuloCreateHandler(db, { nombre: 'Vasito', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const palito = articuloCreateHandler(db, { nombre: 'Palito', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const torta = articuloCreateHandler(db, { nombre: 'Torta helada', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  for (const envase of [poteCuarto, poteMedio, poteUno, cucurucho, vasito, palito, torta]) {
    movimientoArticuloCreateHandler(db, { articulo_id: envase.id, motivo: 'compra', cantidad: 50, costo_unitario_centavos: 20000 });
  }

  // ── Categorías de venta ────────────────────────────────────────────────────
  const catHelados = categoriaPorNombre(db, 'Helados', 1);
  const catPalitos = categoriaPorNombre(db, 'Palitos', 2);
  const catTortas = categoriaPorNombre(db, 'Tortas', 3);
  const catLicuados = categoriaPorNombre(db, 'Licuados', 4);
  const catCucuruchos = categoriaPorNombre(db, 'Cucuruchos', 5);

  // ── Productos de venta ─────────────────────────────────────────────────────
  productoVentaCreateHandler(db, {
    nombre: 'Pote 1/4 kg', categoria_venta_id: catHelados.id, precio_centavos: 350000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: poteCuarto.id, cantidad: 1 }],
    grupos: [{ grupo_modificador_id: grupoSabores.id, min: 1, max: 2, cantidad_total: 0.25, modo_descuento: 'reparto', orden: 1 }],
  });
  productoVentaCreateHandler(db, {
    nombre: 'Pote 1/2 kg', categoria_venta_id: catHelados.id, precio_centavos: 600000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: poteMedio.id, cantidad: 1 }],
    grupos: [{ grupo_modificador_id: grupoSabores.id, min: 1, max: 3, cantidad_total: 0.5, modo_descuento: 'reparto', orden: 1 }],
  });
  productoVentaCreateHandler(db, {
    nombre: 'Pote 1 kg', categoria_venta_id: catHelados.id, precio_centavos: 1100000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: poteUno.id, cantidad: 1 }],
    grupos: [{ grupo_modificador_id: grupoSabores.id, min: 1, max: 4, cantidad_total: 1, modo_descuento: 'reparto', orden: 1 }],
  });
  productoVentaCreateHandler(db, {
    nombre: 'Cucurucho', categoria_venta_id: catCucuruchos.id, precio_centavos: 180000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: cucurucho.id, cantidad: 1 }],
    grupos: [{ grupo_modificador_id: grupoSabores.id, min: 1, max: 2, cantidad_total: 0.15, modo_descuento: 'reparto', orden: 1 }],
  });
  productoVentaCreateHandler(db, {
    nombre: 'Vasito', categoria_venta_id: catHelados.id, precio_centavos: 180000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: vasito.id, cantidad: 1 }],
    grupos: [{ grupo_modificador_id: grupoSabores.id, min: 1, max: 2, cantidad_total: 0.15, modo_descuento: 'reparto', orden: 1 }],
  });
  productoVentaCreateHandler(db, {
    nombre: 'Palito', categoria_venta_id: catPalitos.id, precio_centavos: 120000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: palito.id, cantidad: 1 }], grupos: [],
  });
  productoVentaCreateHandler(db, {
    nombre: 'Torta helada (porción)', categoria_venta_id: catTortas.id, precio_centavos: 250000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: torta.id, cantidad: 1 }], grupos: [],
  });
  productoVentaCreateHandler(db, {
    nombre: 'Licuado de banana', categoria_venta_id: catLicuados.id, precio_centavos: 280000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: banana.id, cantidad: 0.15 }, { articulo_id: leche.id, cantidad: 0.2 }],
    grupos: [],
  });
}
