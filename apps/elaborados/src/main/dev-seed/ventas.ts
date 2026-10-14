import { and, asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { cajaAbrirHandler, cajaGetActivaHandler } from '@core/main';
import * as schema from '../db/schema';
import { CONSUMIDOR_FINAL_ID, GRUPO_SABORES } from '../catalog/seed';
import { ventaConfirmarHandler, ventaCotizarHandler } from '../ipc/venta';
import { CLIENTES_DEMO } from './clientes';

type Db = BetterSQLite3Database<typeof schema>;

type Linea = {
  producto_venta_id: string;
  cantidad: number;
  modificadores?: { grupo_modificador_id: string; opcion_ids: string[] }[];
};

function productoPorNombre(db: Db, nombre: string) {
  const p = db.select().from(schema.producto_venta).where(eq(schema.producto_venta.nombre, nombre)).get();
  if (!p) throw new Error(`SEED_VENTAS: falta el producto de venta "${nombre}" (¿corrió el catálogo demo?)`);
  return p;
}

function clienteConCuentaHolgada(db: Db) {
  const demo = CLIENTES_DEMO
    .filter((c) => c.limite_credito_centavos != null)
    .sort((a, b) => b.limite_credito_centavos! - a.limite_credito_centavos!)[0];
  const cli = db.select().from(schema.cliente).where(eq(schema.cliente.numero_documento, demo.numero_documento)).get();
  if (!cli) throw new Error('SEED_VENTAS: faltan los clientes demo (¿corrió seedClientesDemo?)');
  return cli;
}

/**
 * Ventas de ejemplo sobre una caja abierta del usuario en sesión (la reutiliza si ya hay una):
 * pote de 3 sabores en efectivo, palito con tarjeta y licuados a cuenta corriente de un cliente
 * demo con cuenta. La caja queda abierta. Si ya hay ventas confirmadas, no hace nada.
 * Requiere sesión (los handlers la exigen) y el catálogo y los clientes demo ya sembrados.
 */
export function seedVentasDemo(db: Db): { creadas: number } {
  const yaHay = db.select({ id: schema.venta.id }).from(schema.venta)
    .where(eq(schema.venta.estado, 'confirmada')).limit(1).get();
  if (yaHay) return { creadas: 0 };

  // El pote de 1/4 kg admite hasta 2 sabores: para 3 sabores se usa el de 1/2 kg (máx. 3).
  const pote = productoPorNombre(db, 'Pote 1/2 kg');
  const palito = productoPorNombre(db, 'Palito');
  const licuado = productoPorNombre(db, 'Licuado de banana');
  const grupo = db.select().from(schema.grupo_modificador)
    .where(eq(schema.grupo_modificador.nombre, GRUPO_SABORES)).get();
  if (!grupo) throw new Error('SEED_VENTAS: falta el grupo "Sabores"');
  const sabores = db.select().from(schema.grupo_modificador_opcion)
    .where(and(eq(schema.grupo_modificador_opcion.grupo_modificador_id, grupo.id), eq(schema.grupo_modificador_opcion.activo, true)))
    .orderBy(asc(schema.grupo_modificador_opcion.orden)).all().slice(0, 3);
  if (sabores.length < 3) throw new Error('SEED_VENTAS: el grupo "Sabores" tiene menos de 3 opciones');
  const cliCuenta = clienteConCuentaHolgada(db);

  const caja = cajaGetActivaHandler(db) ?? cajaAbrirHandler(db, { monto_inicial: 0 });

  const vender = (lineas: Linea[], medio: 'efectivo' | 'tarjeta' | 'cuenta_corriente', cliente_id: string) => {
    const { total_centavos } = ventaCotizarHandler(db, { lineas });
    ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id, lineas,
      pagos: [{ medio_pago: medio, monto_centavos: total_centavos }],
    });
  };

  vender([{
    producto_venta_id: pote.id, cantidad: 1,
    modificadores: [{ grupo_modificador_id: grupo.id, opcion_ids: sabores.map((s) => s.id) }],
  }], 'efectivo', CONSUMIDOR_FINAL_ID);
  vender([{ producto_venta_id: palito.id, cantidad: 1 }], 'tarjeta', CONSUMIDOR_FINAL_ID);
  vender([{ producto_venta_id: licuado.id, cantidad: 2 }], 'cuenta_corriente', cliCuenta.id);

  return { creadas: 3 };
}
