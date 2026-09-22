import { useState } from 'react';

type Props = {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
};

const SVG_OJO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SVG_OJO_TACHADO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/**
 * Campo de contraseña con botón para mostrarla u ocultarla.
 *
 * El botón es `type="button"` a propósito: dentro de un `<form>` un botón sin `type`
 * envía el formulario. Y queda fuera del tabulado (`tabIndex={-1}`) para no interrumpir
 * el recorrido usuario → contraseña → enviar.
 */
export function PasswordInput({
  id, value, onChange, placeholder, autoComplete, autoFocus, disabled,
  'aria-label': ariaLabel,
}: Readonly<Props>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="input-wrap">
      <input
        id={id}
        className="input"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        className="input-affix"
        tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? SVG_OJO_TACHADO : SVG_OJO}
      </button>
    </div>
  );
}
