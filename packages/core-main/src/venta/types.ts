import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';

export type VentaDb = BetterSQLite3Database<typeof schema>;
export type VentaTx = Parameters<Parameters<VentaDb['transaction']>[0]>[0];
export type VentaRow = typeof schema.venta.$inferSelect;
export type ComprobanteRow = typeof schema.comprobante.$inferSelect;

export type SyncFields = {
  version: 1;
  origin_id: string;
  sync_state: 'pending';
  updated_at: Date;
};

export type VentaPagoPayload = {
  medio_pago: 'efectivo' | 'tarjeta' | 'cuenta_corriente' | 'transferencia' | 'cheque';
  monto_centavos: number;
  recargo_pct?: number;
  recargo_centavos?: number;
  numero_cheque?: string;
  banco?: string;
  fecha_cheque?: string;
  titular_cheque?: string;
};

export type SupervisorCredenciales = { nombre_usuario: string; password: string };

/** Totales en pesos, calculados por la app; el core los persiste tal cual (ADR-010, E3a §2). */
export type ConfirmarVentaInput = {
  caja_id: string;
  cliente_id: string;
  subtotal: number;
  descuento_global: number;
  importe_iva: number;
  total: number;
  ajuste_redondeo: number;
  pagos: VentaPagoPayload[];
  venta_en_espera_id?: string;
  presupuesto_id?: string | null;
  supervisor_credenciales?: SupervisorCredenciales;
};

export type AplicarLineasCtx = {
  ventaId: string;
  now: Date;
  sync: SyncFields;
  userId: string;
  /** true si la venta venía de `en_espera`: la app debe limpiar las líneas previas. */
  esRetoma: boolean;
};

export type ConfirmarVentaHooks = {
  /** Antes de la transacción. Lanza `Error(<CODIGO>)` para abortar (stock, precio…). */
  validarPrevio?: () => void;
  /** Dentro de la transacción: persistir líneas + efecto en inventario de la app. */
  aplicarLineas: (tx: VentaTx, ctx: AplicarLineasCtx) => void;
};

export type AnularVentaInput = {
  venta_id: string;
  motivo: string;
  supervisor_credenciales: SupervisorCredenciales;
};

export type RevertirLineasCtx = {
  venta: VentaRow;
  now: Date;
  sync: SyncFields;
  userId: string;
  motivo: string;
};

export type AnularVentaHooks = {
  /** Dentro de la transacción: revertir el efecto en inventario de la app. */
  revertirLineas: (tx: VentaTx, ctx: RevertirLineasCtx) => void;
};
