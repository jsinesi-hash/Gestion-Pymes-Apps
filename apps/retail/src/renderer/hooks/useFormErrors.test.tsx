import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormErrors } from './useFormErrors';

describe('useFormErrors (ADR-082)', () => {
  it('valida onBlur y guarda el error del campo', () => {
    const { result } = renderHook(() => useFormErrors<'nombre'>({ nombre: v => (v ? '' : 'Ingresá un nombre') }));
    act(() => result.current.onBlur('nombre', ''));
    expect(result.current.errors.nombre).toBe('Ingresá un nombre');
    act(() => result.current.onBlur('nombre', 'x'));
    expect(result.current.errors.nombre).toBe('');
  });
  it('validarTodo devuelve el primer campo inválido en orden', () => {
    const { result } = renderHook(() =>
      useFormErrors<'nombre' | 'precio'>({ nombre: v => (v ? '' : 'req'), precio: v => (v ? '' : 'req') }, ['nombre', 'precio']));
    let primero: string | undefined;
    act(() => { primero = result.current.validarTodo({ nombre: 'ok', precio: '' }); });
    expect(primero).toBe('precio');
  });
  it('setErrorBackend pinta un error que vino del main', () => {
    const { result } = renderHook(() => useFormErrors<'nombre'>({ nombre: () => '' }));
    act(() => result.current.setErrorBackend('nombre', 'Ya existe'));
    expect(result.current.errors.nombre).toBe('Ya existe');
  });
});
