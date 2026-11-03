import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Modal } from './Modal';

// Revisión 2026-10-20 (P2): 60 `role="dialog"` frente a 12 `aria-modal`, sin trampa de foco ni
// restauración del foco, overlays con `role="button"` para acallar a SonarCloud y cierre por click
// fuera inconsistente. `Modal` es el componente único con el mismo HTML/CSS que ya usan todos.
const escape = () => fireEvent.keyDown(window, { key: 'Escape' });

describe('Modal — semántica', () => {
  it('es un diálogo modal con el título como nombre accesible', () => {
    render(<Modal titulo="Nuevo movimiento"><p>cuerpo</p></Modal>);
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo movimiento' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveClass('modal');
    expect(screen.getByText('cuerpo')).toBeInTheDocument();
  });

  it('sin título usa ariaLabel como nombre accesible', () => {
    render(<Modal ariaLabel="Depurar backups"><p>x</p></Modal>);
    expect(screen.getByRole('dialog', { name: 'Depurar backups' })).toBeInTheDocument();
  });

  it('con encabezado propio se nombra por ariaLabelledBy', () => {
    render(<Modal ariaLabelledBy="mi-titulo"><h2 id="mi-titulo">Ticket interno</h2></Modal>);
    expect(screen.getByRole('dialog', { name: 'Ticket interno' })).toBeInTheDocument();
  });

  it('el overlay no tiene rol de botón (no es un control)', () => {
    const { container } = render(<Modal titulo="T"><p>x</p></Modal>);
    const overlay = container.querySelector('.modal-overlay')!;
    expect(overlay).not.toHaveAttribute('role');
    expect(overlay).not.toHaveAttribute('tabindex');
  });

  it('aplica ancho y estilo al contenedor y puede ser un formulario', () => {
    const alEnviar = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<Modal titulo="F" ancho={640} style={{ maxHeight: '90vh' }} as="form" onSubmit={alEnviar}><button type="submit">ok</button></Modal>);
    const d = screen.getByRole('dialog');
    expect(d.tagName).toBe('FORM');
    expect(d).toHaveStyle({ width: '640px', maxHeight: '90vh' });
    fireEvent.click(screen.getByText('ok'));
    expect(alEnviar).toHaveBeenCalledTimes(1);
  });
});

describe('Modal — foco', () => {
  it('enfoca el primer campo (no el botón Cerrar del encabezado)', () => {
    render(<Modal titulo="T" onClose={() => {}}><input aria-label="uno" /><input aria-label="dos" /></Modal>);
    expect(screen.getByLabelText('uno')).toHaveFocus();
  });

  it('respeta un autoFocus de los hijos', () => {
    render(<Modal titulo="T"><input aria-label="uno" /><input aria-label="dos" autoFocus /></Modal>);
    expect(screen.getByLabelText('dos')).toHaveFocus();
  });

  it('sin controles enfocables enfoca el propio diálogo', () => {
    render(<Modal ariaLabel="A"><p>solo texto</p></Modal>);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('Tab en el último control vuelve al primero y Shift+Tab en el primero va al último', () => {
    render(<Modal titulo="T"><input aria-label="uno" /><input aria-label="dos" /><button type="button">fin</button></Modal>);
    const dialogo = screen.getByRole('dialog');
    screen.getByText('fin').focus();
    fireEvent.keyDown(dialogo, { key: 'Tab' });
    expect(screen.getByLabelText('uno')).toHaveFocus();
    fireEvent.keyDown(dialogo, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('fin')).toHaveFocus();
  });

  it('Tab en un control intermedio no interfiere (el navegador avanza solo)', () => {
    render(<Modal titulo="T"><input aria-label="uno" /><input aria-label="dos" /></Modal>);
    const evento = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    screen.getByLabelText('uno').focus();
    screen.getByLabelText('uno').dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(false);
  });

  it('al cerrarse devuelve el foco a quien lo abrió', () => {
    function Anfitrion() {
      const [abierto, setAbierto] = useState(false);
      return (
        <>
          <button onClick={() => setAbierto(true)}>abrir</button>
          {abierto && <Modal titulo="T" onClose={() => setAbierto(false)}><input aria-label="campo" /></Modal>}
        </>
      );
    }
    render(<Anfitrion />);
    const abrir = screen.getByText('abrir');
    abrir.focus();
    fireEvent.click(abrir);
    expect(screen.getByLabelText('campo')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(abrir).toHaveFocus();
  });
});

describe('Modal — cierre', () => {
  it('Escape llama a onClose', () => {
    const onClose = vi.fn();
    render(<Modal titulo="T" onClose={onClose}><input /></Modal>);
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sin onClose Escape no hace nada (modal obligatorio, p. ej. autorización de Supervisor)', () => {
    render(<Modal titulo="T"><input /></Modal>);
    expect(() => escape()).not.toThrow();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
  });

  it('bloqueado: ni Escape ni el botón Cerrar (p. ej. mientras se guarda o se restaura)', () => {
    const onClose = vi.fn();
    render(<Modal titulo="T" onClose={onClose} bloqueado><input /></Modal>);
    escape();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
  });

  it('ocultarCerrar quita la × pero Escape sigue cerrando (el pie ya trae un botón Cancelar)', () => {
    const onClose = vi.fn();
    render(<Modal titulo="T" onClose={onClose} ocultarCerrar><button type="button">Cancelar</button></Modal>);
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('el botón × del encabezado llama a onClose', () => {
    const onClose = vi.fn();
    render(<Modal titulo="T" onClose={onClose}><input /></Modal>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('con modales anidados Escape cierra solo el de más arriba', () => {
    const abajo = vi.fn(); const arriba = vi.fn();
    render(<><Modal titulo="A" onClose={abajo}><input /></Modal><Modal titulo="B" onClose={arriba}><input /></Modal></>);
    escape();
    expect(arriba).toHaveBeenCalledTimes(1);
    expect(abajo).not.toHaveBeenCalled();
  });
});

describe('Modal — click fuera', () => {
  const overlayDe = (c: HTMLElement) => c.querySelector('.modal-overlay') as HTMLElement;

  it('por defecto NO cierra al hacer click fuera (evita perder lo tipeado)', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal titulo="T" onClose={onClose}><input /></Modal>);
    fireEvent.mouseDown(overlayDe(container)); fireEvent.click(overlayDe(container));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('con cerrarAlClickFuera cierra al hacer click en el overlay', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal titulo="T" onClose={onClose} cerrarAlClickFuera><input /></Modal>);
    fireEvent.mouseDown(overlayDe(container)); fireEvent.click(overlayDe(container));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('un click dentro del diálogo no cierra', () => {
    const onClose = vi.fn();
    render(<Modal titulo="T" onClose={onClose} cerrarAlClickFuera><p>dentro</p></Modal>);
    fireEvent.mouseDown(screen.getByText('dentro')); fireEvent.click(screen.getByText('dentro'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('arrastrar una selección desde dentro y soltar sobre el overlay no cierra', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal titulo="T" onClose={onClose} cerrarAlClickFuera><p>dentro</p></Modal>);
    fireEvent.mouseDown(screen.getByText('dentro'));
    fireEvent.click(overlayDe(container));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('bloqueado no cierra aunque se pida cerrarAlClickFuera', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal titulo="T" onClose={onClose} cerrarAlClickFuera bloqueado><input /></Modal>);
    fireEvent.mouseDown(overlayDe(container)); fireEvent.click(overlayDe(container));
    expect(onClose).not.toHaveBeenCalled();
  });
});
