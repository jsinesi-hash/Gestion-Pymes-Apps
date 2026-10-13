export type MedioPago = 'efectivo' | 'tarjeta' | 'cuenta_corriente' | 'transferencia' | 'cheque';

export type VentaPagoPayload = {
  medio_pago: MedioPago;
  monto_centavos: number;
  recargo_pct?: number;
  recargo_centavos?: number;
  numero_cheque?: string;
  banco?: string;
  fecha_cheque?: string;
  titular_cheque?: string;
};
