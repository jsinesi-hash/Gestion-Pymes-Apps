import { describe, it, expect } from 'vitest';
import { nombreCompletoCliente } from './persona.js';

// ADR-050 — split de cliente.razon_social en nombre/apellido.
// nombreCompletoCliente arma el nombre para mostrar, sin duplicar la
// concatenación ad-hoc en cada punto de lectura.

describe('nombreCompletoCliente', () => {
  it('concatena nombre y apellido con un solo espacio', () => {
    expect(nombreCompletoCliente({ nombre: 'Juan', apellido: 'García' })).toBe('Juan García');
  });

  it('sin apellido (null) devuelve solo el nombre, sin espacio colgando', () => {
    expect(nombreCompletoCliente({ nombre: 'Consumidor', apellido: null })).toBe('Consumidor');
  });

  it('con apellido vacío devuelve solo el nombre, sin espacio colgando', () => {
    expect(nombreCompletoCliente({ nombre: 'Consumidor', apellido: '' })).toBe('Consumidor');
  });

  it('recorta espacios extra de nombre y apellido', () => {
    expect(nombreCompletoCliente({ nombre: '  Juan  ', apellido: '  García  ' })).toBe('Juan García');
  });

  it('con apellido solo espacios devuelve solo el nombre', () => {
    expect(nombreCompletoCliente({ nombre: 'Consumidor', apellido: '   ' })).toBe('Consumidor');
  });
});
