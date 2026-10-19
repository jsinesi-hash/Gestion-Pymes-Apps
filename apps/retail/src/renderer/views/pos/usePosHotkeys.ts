import { useEffect, useRef } from 'react';
import { POS_ATAJOS, atajoHabilitado, type PosAccion, type PosAtajoCtx } from '../../../common/posAtajos';

export interface PosHotkeysOpts {
  ctx: PosAtajoCtx;
  /** true mientras haya un modal o drawer abierto: el hook no hace nada. */
  bloqueado: boolean;
  onEnfocarBuscador: () => void;
  onCobrar: () => void;
  onDescuentoUltimaLinea: () => void;
  onVentasEspera: () => void;
  onPonerEspera: () => void;
  /** Opcional: contrato listo para el multiplicador N* (Fase 2). */
  onCancelarMultiplicador?: () => void;
}

/** Atajos de teclado del POS: tabla declarativa en common/posAtajos.ts. */
export function usePosHotkeys(opts: PosHotkeysOpts): void {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const o = ref.current;
      if (o.bloqueado) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const atajo = POS_ATAJOS.find((a) => a.tecla === e.key);
      if (!atajo || !atajoHabilitado(atajo.accion, o.ctx)) return;
      const handlers: Record<PosAccion, (() => void) | undefined> = {
        'enfocar-buscador': o.onEnfocarBuscador,
        'cobrar': o.onCobrar,
        'descuento-ultima-linea': o.onDescuentoUltimaLinea,
        'ventas-espera': o.onVentasEspera,
        'poner-espera': o.onPonerEspera,
        'cancelar-multiplicador': o.onCancelarMultiplicador,
      };
      const fn = handlers[atajo.accion];
      if (!fn) return;
      e.preventDefault();
      fn();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
}
