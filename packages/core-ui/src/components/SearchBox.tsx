import { useEffect, useRef } from 'react';

export interface SearchBoxProps {
  /** Valor mostrado (controlado por el padre, para poder persistirlo). */
  value: string;
  /** Cambio inmediato en cada tecla (feedback y persistencia del valor tipeado). */
  onChange: (v: string) => void;
  /** Cambio con debounce, para disparar el filtrado/consulta sin re-render por tecla. */
  onDebouncedChange?: ((v: string) => void) | undefined;
  /** Milisegundos de debounce (default 250). */
  debounceMs?: number | undefined;
  placeholder?: string | undefined;
  ariaLabel?: string | undefined;
  autoFocus?: boolean | undefined;
}

// Input de búsqueda unificado para los listados (ADR-081 / SRCH-2): ícono de lupa, botón
// limpiar, debounce interno y `Escape` para limpiar. Reutiliza la clase `.search` ya
// establecida en el resto de la app para verse igual.
export function SearchBox({
  value,
  onChange,
  onDebouncedChange,
  debounceMs = 250,
  placeholder = 'Buscar…',
  ariaLabel = 'Buscar',
  autoFocus,
}: SearchBoxProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function emitirDebounced(v: string, inmediato = false) {
    if (!onDebouncedChange) return;
    if (timer.current) clearTimeout(timer.current);
    if (inmediato) { onDebouncedChange(v); return; }
    timer.current = setTimeout(() => onDebouncedChange(v), debounceMs);
  }

  function setValor(v: string, inmediato = false) {
    onChange(v);
    emitirDebounced(v, inmediato);
  }

  return (
    <div className="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.preventDefault(); setValor('', true); } }}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Limpiar búsqueda"
          onClick={() => setValor('', true)}
        >
          ✕
        </button>
      )}
    </div>
  );
}
