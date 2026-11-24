import { useEffect, useState } from 'react';
import type { CajaDelHub } from '@core/preload';
import { bridge } from '../../bridge';

// F3 PR5 (ADR-155 §4): al cerrar un turno compartido, avisa qué cajas no se comunican con el hub. Sus
// movimientos todavía no llegaron y no entran en este cierre; si llegan después, quedan en el turno como
// posteriores al cierre y la coordinadora avisa (§5). Cerrar igual es decisión de quien cierra.

/** Más que el intervalo del sync (unos segundos): una caja callada este tiempo no está subiendo. */
export const SIN_CONTACTO_MS = 60_000;

export function cajasSinContacto(cajas: readonly CajaDelHub[], esta: string, ahoraMs: number): CajaDelHub[] {
  return cajas.filter((c) => c.origin_id !== esta && !c.revocada_en
    && (c.ultimo_contacto == null || ahoraMs - c.ultimo_contacto * 1000 > SIN_CONTACTO_MS));
}

function hace(c: CajaDelHub, ahoraMs: number): string {
  if (c.ultimo_contacto == null) return 'nunca se conectó';
  const min = Math.round((ahoraMs - c.ultimo_contacto * 1000) / 60_000);
  return min < 60 ? `sin contacto hace ${min} min` : `sin contacto hace ${Math.round(min / 60)} h`;
}

export function AvisoCajasSinContacto({ ahoraMs }: { ahoraMs?: number }) {
  const [calladas, setCalladas] = useState<CajaDelHub[] | null>(null);
  const [sinHub, setSinHub] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { modo } = await bridge().sync.cajaModo();
        if (modo !== 'compartida') return;
        const estado = await bridge().sync.estado();
        try {
          const cajas = await bridge().sync.terminales();
          if (vivo) setCalladas(cajasSinContacto(cajas, estado.origin_id, ahoraMs ?? Date.now()));
        } catch {
          if (vivo) setSinHub(true);
        }
      } catch { /* sin sync en esta versión: nada que avisar */ }
    })();
    return () => { vivo = false; };
  }, [ahoraMs]);

  if (sinHub) {
    return (
      <div className="alert-warn" role="note">
        No se pudo consultar al hub qué cajas están conectadas. Puede haber movimientos de otras cajas que todavía no llegaron.
      </div>
    );
  }
  if (!calladas || calladas.length === 0) return null;
  const ahora = ahoraMs ?? Date.now();
  return (
    <div className="alert-warn" role="note">
      Estas cajas no se comunican con el hub: sus movimientos todavía no llegaron y no entran en este cierre.
      Si llegan después, quedan en el turno y se avisa al Supervisor.
      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {calladas.map((c) => <li key={c.origin_id}>{c.nombre} ({c.origin_id}): {hace(c, ahora)}</li>)}
      </ul>
    </div>
  );
}
