import { useEffect, useRef, useState, useCallback } from 'react';

const EVENTOS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const;

// SEC-3 (ADR-079): bloquea tras `minutos` sin actividad. Con minutos<=0 queda inerte.
// El overlay vive por encima de la UI sin desmontar nada, así el carrito persiste.
export function useIdleLock(minutos: number): { locked: boolean; unlock: () => void } {
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);
  lockedRef.current = locked;

  const unlock = useCallback(() => setLocked(false), []);

  useEffect(() => {
    if (minutos <= 0) return;
    const ms = minutos * 60_000;
    function arm() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLocked(true), ms);
    }
    function onActividad() {
      if (lockedRef.current) return;
      arm();
    }
    EVENTOS.forEach(ev => window.addEventListener(ev, onActividad, { passive: true }));
    arm();
    return () => {
      EVENTOS.forEach(ev => window.removeEventListener(ev, onActividad));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [minutos]);

  return { locked, unlock };
}
