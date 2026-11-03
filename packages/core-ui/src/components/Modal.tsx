import {
  createElement, useEffect, useId, useRef,
  type CSSProperties, type FormEventHandler, type KeyboardEvent, type MouseEvent, type ReactNode,
} from 'react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

// Revisión 2026-10-20 (P2): el repo tenía 73 overlays armados a mano (60 `role="dialog"` frente a 12
// `aria-modal`), sin trampa de foco ni restauración del foco, con `role="button"` en el overlay para
// acallar a SonarCloud y cierre por click fuera inconsistente. Este componente conserva el HTML y el
// CSS de siempre (`modal-overlay` > `modal`) y agrega la semántica y el foco.

const ENFOCABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

function enfocables(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(ENFOCABLES))
    .filter((el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
}

export type ModalProps = {
  children: ReactNode;
  /** Renderiza el encabezado `modal-header` con este título (y la × si hay `onClose`). */
  titulo?: string;
  /** Nombre accesible cuando no hay `titulo` ni encabezado propio. */
  ariaLabel?: string;
  /** `id` del encabezado propio, cuando el modal arma su cabecera a mano. */
  ariaLabelledBy?: string;
  ancho?: number | string;
  style?: CSSProperties;
  /**
   * Cierra con Escape, con la × del encabezado y —si `cerrarAlClickFuera`— con click en el overlay.
   * Sin `onClose` el modal es obligatorio (p. ej. autorización de Supervisor).
   */
  onClose?: () => void;
  /** Impide cerrar (Escape, ×, click fuera) mientras se guarda o se ejecuta algo irreversible. */
  bloqueado?: boolean;
  /** Por defecto `false`: un click perdido no debe descartar lo que el usuario tipeó. */
  cerrarAlClickFuera?: boolean;
  /** Oculta la × del encabezado (el pie ya trae un botón Cancelar); Escape sigue cerrando. */
  ocultarCerrar?: boolean;
  /** `form` cuando el propio diálogo es un formulario. */
  as?: 'div' | 'form';
  onSubmit?: FormEventHandler<HTMLElement>;
};

export function Modal({
  children, titulo, ariaLabel, ariaLabelledBy, ancho, style, onClose, bloqueado = false,
  cerrarAlClickFuera = false, ocultarCerrar = false, as = 'div', onSubmit,
}: Readonly<ModalProps>) {
  const tituloId = useId();
  const dialogo = useRef<HTMLElement | null>(null);
  const mouseDownEnOverlay = useRef<boolean | null>(null);
  const puedeCerrar = !!onClose && !bloqueado;

  // Un Escape cierra solo el modal de más arriba (pila de useEscapeAction).
  useEscapeToClose(() => onClose?.(), puedeCerrar);

  // Foco inicial y restauración al cerrar.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const d = dialogo.current;
    if (d && !d.contains(document.activeElement)) {
      const candidatos = enfocables(d);
      const primero = candidatos.find((el) => !el.hasAttribute('data-modal-cerrar')) ?? candidatos[0];
      (primero ?? d).focus();
    }
    return () => {
      if (previo && previo.isConnected) previo.focus();
    };
  }, []);

  function alTeclear(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Tab') return;
    const d = dialogo.current;
    if (!d) return;
    const lista = enfocables(d);
    if (lista.length === 0) { e.preventDefault(); d.focus(); return; }
    const primero = lista[0]!;
    const ultimo = lista[lista.length - 1]!;
    const activo = document.activeElement;
    if (e.shiftKey && (activo === primero || activo === d)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus(); }
  }

  function alPresionarOverlay(e: MouseEvent<HTMLDivElement>) {
    mouseDownEnOverlay.current = e.target === e.currentTarget;
  }

  function alClickOverlay(e: MouseEvent<HTMLDivElement>) {
    const empezoAfuera = mouseDownEnOverlay.current;
    mouseDownEnOverlay.current = null;
    // Arrastrar una selección desde dentro y soltar fuera no es "click fuera".
    if (e.target !== e.currentTarget || empezoAfuera === false) return;
    if (cerrarAlClickFuera && puedeCerrar) onClose?.();
  }

  const propsDialogo = {
    ref: (el: HTMLElement | null) => { dialogo.current = el; },
    className: 'modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titulo === undefined ? ariaLabelledBy : tituloId,
    'aria-label': titulo === undefined && !ariaLabelledBy ? ariaLabel : undefined,
    tabIndex: -1,
    style: { ...(ancho === undefined ? {} : { width: ancho }), ...style },
    onKeyDown: alTeclear,
    ...(as === 'form' ? { onSubmit } : {}),
  };

  const cuerpo = (
    <>
      {titulo !== undefined && (
        <div className="modal-header">
          <span id={tituloId} className="modal-title">{titulo}</span>
          {puedeCerrar && !ocultarCerrar && (
            <button type="button" className="ia" aria-label="Cerrar" data-modal-cerrar onClick={() => onClose?.()}>×</button>
          )}
        </div>
      )}
      {children}
    </>
  );

  return (
    // El overlay no es un control: el cierre por teclado es Escape y por mouse, un click fuera.
    <div className="modal-overlay" onMouseDown={alPresionarOverlay} onClick={alClickOverlay}>
      {createElement(as, propsDialogo, cuerpo)}
    </div>
  );
}
