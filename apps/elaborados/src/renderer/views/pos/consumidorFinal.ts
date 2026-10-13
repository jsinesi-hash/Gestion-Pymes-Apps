export const CONSUMIDOR_FINAL_ID = 'cf000000-0000-0000-0000-000000000001';

export type ClientePos = { id: string; nombre_completo: string; habilita_cuenta_corriente: boolean };

export const CONSUMIDOR_FINAL: ClientePos = {
  id: CONSUMIDOR_FINAL_ID,
  nombre_completo: 'Consumidor Final',
  habilita_cuenta_corriente: false,
};
