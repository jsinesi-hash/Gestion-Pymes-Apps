// Alertas del modo distribuido (ADR-153 §4, F2 PR5). Con varias terminales sin conexión entre sí el stock
// consolidado puede quedar negativo y un cliente sobre su límite de crédito. Es una tarea coordinada
// (ADR-152): corre solo en la terminal coordinadora, después de cada pull, y avisa una vez por producto o
// cliente y por día (dedupe), a quien tiene el permiso para corregirlo (ADR-146): `stock.ajustar` para el
// stock (se corrige con una entrada o un conteo) y `ctacte.autorizar_exceso` para el crédito.
// F3 PR5 (ADR-155 §5): también los movimientos que llegan a un turno de caja ya cerrado (caja compartida con
// una terminal que estaba sin conexión), a quien autoriza diferencias de caja; uno por novedad.
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nombreCompletoCliente } from '@ferreteria/shared';
import { cajasConMovimientosTardios } from '@core/main';
import * as schema from '../db/schema';
import { despacharAviso, insertarAvisos, type ComandoAviso } from '../agenda/aviso-servicio';

type Db = BetterSQLite3Database<typeof schema>;

/** Día local `YYYY-MM-DD`: la misma situación vuelve a avisar al día siguiente si sigue sin corregirse. */
function dia(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function comandos(db: Db, ahora: Date): ComandoAviso[] {
  const hoy = dia(ahora);
  const stock = db.select({ id: schema.producto.id, nombre: schema.producto.nombre_corto, sku: schema.producto.sku, stock: schema.existencias.stock_fisico })
    .from(schema.existencias)
    .innerJoin(schema.producto, eq(schema.producto.id, schema.existencias.producto_id))
    .where(and(lt(schema.existencias.stock_fisico, 0), eq(schema.producto.activo, true)))
    .all();
  const credito = db.select({
    cliente: schema.cliente,
    saldo: schema.cuenta_corriente_cliente.saldo_centavos,
    limite: schema.cuenta_corriente_cliente.limite_credito_centavos,
  })
    .from(schema.cuenta_corriente_cliente)
    .innerJoin(schema.cliente, eq(schema.cliente.id, schema.cuenta_corriente_cliente.cliente_id))
    .where(and(
      gt(schema.cuenta_corriente_cliente.limite_credito_centavos, 0),
      sql`${schema.cuenta_corriente_cliente.saldo_centavos} > ${schema.cuenta_corriente_cliente.limite_credito_centavos}`,
      eq(schema.cuenta_corriente_cliente.activo, true),
    ))
    .all();

  const tardios = cajasConMovimientosTardios(db as never, ahora);
  const hora = (d: Date) => d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return [
    ...tardios.map((t): ComandoAviso => ({
      origen_tipo: 'caja_movimiento_tardio',
      origen_id: t.caja_id,
      titulo: 'Movimientos después del cierre de caja',
      cuerpo: `El turno de caja cerrado el ${hora(t.fecha_cierre)} recibió movimientos después del cierre (de una caja que estaba sin conexión). `
        + `Efectivo esperado al cierre: $${t.esperado_cierre_centavos / 100}; con lo que llegó después: $${t.esperado_actual_centavos / 100}. `
        + 'La diferencia del arqueo no se recalculó.',
      // El payload es una foto para mostrar: en pesos, como el resto de los avisos.
      datos: { caja_id: t.caja_id, esperado_cierre: t.esperado_cierre_centavos / 100, esperado_actual: t.esperado_actual_centavos / 100, posteriores: t.posteriores },
      destinatario: { tipo: 'permiso', permiso: 'caja.autorizar_diferencia' },
      severidad: 'alerta',
      // Una por novedad: otro movimiento tardío cambia el esperado o la cuenta y vuelve a avisar.
      dedupe_clave: `caja_movimiento_tardio:${t.caja_id}:${t.esperado_actual_centavos}:${t.posteriores}`,
    })),
    ...stock.map((p): ComandoAviso => ({
      origen_tipo: 'stock_negativo',
      origen_id: p.id,
      titulo: `Stock negativo: ${p.nombre}`,
      cuerpo: `${p.nombre} (${p.sku}) quedó con stock ${p.stock} al juntar las ventas de varias terminales. No se vende hasta corregirlo con una entrada o un conteo.`,
      datos: { producto_id: p.id, sku: p.sku, stock: p.stock },
      destinatario: { tipo: 'permiso', permiso: 'stock.ajustar' },
      severidad: 'alerta',
      dedupe_clave: `stock_negativo:${p.id}:${hoy}`,
    })),
    ...credito.map((c): ComandoAviso => {
      const nombre = nombreCompletoCliente(c.cliente);
      return {
        origen_tipo: 'ctacte_sobre_limite',
        origen_id: c.cliente.id,
        titulo: `Cliente sobre el límite de crédito: ${nombre}`,
        cuerpo: `${nombre} debe $${c.saldo / 100} y su límite es $${c.limite / 100}, por ventas en cuenta corriente de varias terminales.`,
        // El payload es una foto para mostrar: en pesos, como el resto de los avisos.
        datos: { cliente_id: c.cliente.id, saldo: c.saldo / 100, limite: c.limite / 100 },
        destinatario: { tipo: 'permiso', permiso: 'ctacte.autorizar_exceso' },
        severidad: 'alerta',
        dedupe_clave: `ctacte_sobre_limite:${c.cliente.id}:${hoy}`,
      };
    }),
  ];
}

/** Genera los avisos que falten (deduplicados) y los despacha fuera de la transacción. */
export async function alertasDistribuido(db: Db, ahora: Date = new Date()): Promise<number> {
  const ids = db.transaction((tx) => comandos(db, ahora).flatMap((cmd) => insertarAvisos(tx, cmd, ahora)));
  for (const id of ids) await despacharAviso(db, id);
  return ids.length;
}
