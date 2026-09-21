import type { CanalAdapter, AvisoParaEnviar, ResultadoEnvio } from './tipos';

// in_app es local e instantaneo: la fila en `aviso` ES la entrega. La campana y la
// bandeja de la UI la muestran leyendo la tabla. Se implementa ya (ADR-047 §8).
export const inAppAdapter: CanalAdapter = {
  canal: 'in_app',
  async enviar(_aviso: AvisoParaEnviar): Promise<ResultadoEnvio> {
    return { ok: true };
  },
};
