import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useEscapeAction, useEscapeSalir } from '../useEscapeAction';

type Opts = Parameters<typeof useEscapeAction>[1];

function Consumidor({ handler, opts }: Readonly<{ handler: () => void; opts?: Opts }>) {
  useEscapeAction(handler, opts);
  return null;
}

function escape() {
  fireEvent.keyDown(window, { key: 'Escape' });
}

describe('useEscapeAction', () => {
  it('ejecuta el handler al presionar Escape', () => {
    const fn = vi.fn();
    render(<Consumidor handler={fn} />);
    escape();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignora cualquier otra tecla', () => {
    const fn = vi.fn();
    render(<Consumidor handler={fn} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('con dos handlers apilados solo dispara el último montado', () => {
    const primero = vi.fn();
    const segundo = vi.fn();
    const { rerender } = render(<Consumidor handler={primero} />);
    rerender(
      <>
        <Consumidor handler={primero} />
        <Consumidor handler={segundo} />
      </>,
    );
    escape();
    expect(segundo).toHaveBeenCalledTimes(1);
    expect(primero).not.toHaveBeenCalled();
  });

  it('al desmontar el de arriba vuelve a atender el de abajo', () => {
    const primero = vi.fn();
    const segundo = vi.fn();
    const { rerender } = render(
      <>
        <Consumidor handler={primero} />
        <Consumidor handler={segundo} />
      </>,
    );
    rerender(<><Consumidor handler={primero} /></>);
    escape();
    expect(primero).toHaveBeenCalledTimes(1);
    expect(segundo).not.toHaveBeenCalled();
  });

  it('no dispara cuando enabled es false', () => {
    const fn = vi.fn();
    render(<Consumidor handler={fn} opts={{ enabled: false }} />);
    escape();
    expect(fn).not.toHaveBeenCalled();
  });

  it('vuelve a atender cuando enabled pasa de false a true', () => {
    const fn = vi.fn();
    const { rerender } = render(<Consumidor handler={fn} opts={{ enabled: false }} />);
    rerender(<Consumidor handler={fn} opts={{ enabled: true }} />);
    escape();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('un overlay tiene prioridad sobre una pantalla aunque se haya montado antes', () => {
    const pantalla = vi.fn();
    const overlay = vi.fn();
    // El overlay se declara primero a propósito: los efectos de React corren de hijo a
    // padre, así que un modal puede registrarse antes que su pantalla contenedora.
    render(
      <>
        <Consumidor handler={overlay} opts={{ layer: 'overlay' }} />
        <Consumidor handler={pantalla} opts={{ layer: 'page' }} />
      </>,
    );
    escape();
    expect(overlay).toHaveBeenCalledTimes(1);
    expect(pantalla).not.toHaveBeenCalled();
  });

  it('la pantalla atiende cuando no hay ningún overlay activo', () => {
    const pantalla = vi.fn();
    render(<Consumidor handler={pantalla} opts={{ layer: 'page' }} />);
    escape();
    expect(pantalla).toHaveBeenCalledTimes(1);
  });

  it('usa siempre la última versión del handler sin re-suscribirse', () => {
    const viejo = vi.fn();
    const nuevo = vi.fn();
    const { rerender } = render(<Consumidor handler={viejo} />);
    rerender(<Consumidor handler={nuevo} />);
    escape();
    expect(nuevo).toHaveBeenCalledTimes(1);
    expect(viejo).not.toHaveBeenCalled();
  });

  it('no deja listeners colgados al desmontar el último consumidor', () => {
    const fn = vi.fn();
    const { unmount } = render(<Consumidor handler={fn} />);
    unmount();
    escape();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('useEscapeSalir', () => {
  function Formulario({ salir, hayCambios }: Readonly<{ salir: () => void; hayCambios: boolean }>) {
    useEscapeSalir(salir, hayCambios);
    return null;
  }

  afterEach(() => { vi.restoreAllMocks(); });

  it('sale sin preguntar cuando no hay cambios', () => {
    const salir = vi.fn();
    // jsdom no implementa window.confirm: hay que stubbearlo siempre.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Formulario salir={salir} hayCambios={false} />);
    escape();
    expect(salir).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('pide confirmación y sale si el usuario acepta', () => {
    const salir = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Formulario salir={salir} hayCambios />);
    escape();
    expect(salir).toHaveBeenCalledTimes(1);
  });

  it('no sale si el usuario cancela la confirmación', () => {
    const salir = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Formulario salir={salir} hayCambios />);
    escape();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(salir).not.toHaveBeenCalled();
  });
});
