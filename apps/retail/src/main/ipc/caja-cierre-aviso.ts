import { eq, lte, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import type { OnCajaCerrada } from '@core/main';
import type { ComandoAviso } from '../agenda/aviso-servicio';
import { insertarAvisos, despacharAviso } from '../agenda/aviso-servicio';
import { productosBajoMinimo } from '../agenda/bajo-minimo';
import { leerParametro, leerParametroNumero } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** ADR-157: montos en centavos (el resumen que arma `cajaCalcularCierreHandler`). */
interface ResumenCierre {
  caja_id: string; monto_inicial_centavos: number;
  por_forma_pago: Array<{ forma_pago: string; ingresado_centavos: number; cantidad_operaciones: number }>;
  esperado_efectivo_centavos: number; ventas_count: number; total_ventas_centavos: number;
}

/** El payload del aviso es una foto para mostrar (mail, pantalla): conserva sus claves en pesos. */
const aPesos = (centavos: number): number => centavos / 100;

const TOP_BAJO_MINIMO = 10;

const leerNum = (db: Db, clave: string, def: number): number => Math.trunc(leerParametroNumero(db, clave, def));

function resolverDestinatario(db: Db): ComandoAviso['destinatario'] {
  const raw = leerParametro(db, 'notif_cierre_destinatario');
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && (parsed.tipo === 'usuario' || parsed.tipo === 'rol')) return parsed;
  } catch { /* cae al default */ }
  return { tipo: 'rol', rol: 'supervisor' };
}

function calcularTurno(db: Db, cajaRow: { fecha_apertura: Date }): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(schema.caja).where(lte(schema.caja.fecha_apertura, cajaRow.fecha_apertura)).get();
  return row?.n ?? 1;
}

function bajoMinimo(db: Db) {
  const lista = productosBajoMinimo(db);
  return {
    total: lista.length,
    top: lista.slice(0, TOP_BAJO_MINIMO).map(({ nombre_corto, stock_fisico, stock_minimo }) => ({ nombre_corto, stock_fisico, stock_minimo })),
  };
}

export function construirComandoCierre(db: Db, args: {
  cajaRow: { id: string; usuario_id: string; fecha_apertura: Date; fecha_cierre: Date | null };
  resumen: ResumenCierre;
  diferencia_centavos: number;
  monto_contado_centavos: number;
  usuarioCierreId: string;
  now: Date;
}): ComandoAviso {
  const { cajaRow, resumen, diferencia_centavos, monto_contado_centavos, usuarioCierreId, now } = args;
  const diferencia = aPesos(diferencia_centavos);
  const umbralCentavos = leerNum(db, 'arqueo_diferencia_alerta_centavos', 200000);
  const severidad: 'normal' | 'alerta' = Math.abs(diferencia_centavos) > umbralCentavos ? 'alerta' : 'normal';
  const turno = calcularTurno(db, cajaRow);
  const usuario = db.select({ n: schema.usuario.nombre_completo }).from(schema.usuario).where(eq(schema.usuario.id, usuarioCierreId)).get();
  const fechaCorta = (cajaRow.fecha_cierre ?? now).toLocaleDateString('es-AR');

  const titulo = severidad === 'alerta'
    ? `Cierre con descuadre de $${Math.abs(diferencia)} — turno ${turno}`
    : `Cierre de caja — turno ${turno} (${fechaCorta})`;

  const datos = {
    fecha: (cajaRow.fecha_cierre ?? now).toISOString(),
    turno,
    usuario_cierre: usuario?.n ?? '',
    total_vendido: aPesos(resumen.total_ventas_centavos),
    n_ventas: resumen.ventas_count,
    desglose_por_medio_pago: resumen.por_forma_pago.map((fp) => ({
      forma_pago: fp.forma_pago, ingresado: aPesos(fp.ingresado_centavos), cantidad_operaciones: fp.cantidad_operaciones,
    })),
    fondo_inicial: aPesos(resumen.monto_inicial_centavos),
    efectivo_esperado: aPesos(resumen.esperado_efectivo_centavos),
    efectivo_contado: aPesos(monto_contado_centavos),
    diferencia,
    bajo_minimo: bajoMinimo(db),
  };

  return {
    origen_tipo: 'cierre_caja',
    origen_id: cajaRow.id,
    titulo,
    cuerpo: `Cierre de caja del turno ${turno}. Cerró: ${usuario?.n ?? ''}.`,
    datos,
    severidad,
    destinatario: resolverDestinatario(db),
    canales: ['in_app', 'email'],
    dedupe_clave: `cierre_caja:${cajaRow.id}`,
  };
}

/**
 * Hook de cierre de caja de Retail (ADR-047 §6): el aviso se inserta en la MISMA transacción
 * del cierre; el envío (email) va después del commit, best-effort.
 * El core tipa `db`/`tx` con su esquema; en Retail son la BD compuesta (superset), de ahí el cast.
 */
export const avisoCierreCaja: OnCajaCerrada = ({ db, tx, cajaRow, resumen, diferencia_centavos, monto_contado_centavos, usuarioCierreId, now }) => {
  const rdb = db as unknown as Db;
  const cmd = construirComandoCierre(rdb, { cajaRow, resumen, diferencia_centavos, monto_contado_centavos, usuarioCierreId, now });
  const ids = insertarAvisos(tx as unknown as Tx, cmd, now);
  return () => { for (const id of ids) void despacharAviso(rdb, id); };
};
