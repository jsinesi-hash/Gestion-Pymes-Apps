import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { resaltarCoincidencia } from './resaltar';

function marks(node: React.ReactNode) {
  const { container } = render(<span>{node}</span>);
  return Array.from(container.querySelectorAll('mark')).map((m) => m.textContent);
}

describe('resaltarCoincidencia', () => {
  it('devuelve el texto tal cual cuando la query está vacía', () => {
    const { container } = render(<span>{resaltarCoincidencia('Tornillo', '')}</span>);
    expect(container.textContent).toBe('Tornillo');
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });

  it('envuelve la coincidencia en <mark> preservando el texto original', () => {
    const node = resaltarCoincidencia('Tornillo Phillips', 'phil');
    const { container } = render(<span>{node}</span>);
    expect(container.textContent).toBe('Tornillo Phillips');
    expect(marks(node)).toEqual(['Phil']);
  });

  it('matchea sin distinguir acentos ni mayúsculas, respetando el original', () => {
    const node = resaltarCoincidencia('Válvula ESFÉRICA', 'esferica');
    expect(marks(node)).toEqual(['ESFÉRICA']);
  });

  it('resalta todas las apariciones', () => {
    const node = resaltarCoincidencia('cable cable', 'cable');
    expect(marks(node)).toEqual(['cable', 'cable']);
  });

  it('no rompe con caracteres especiales de regex en la query', () => {
    const node = resaltarCoincidencia('caño 1/2 pulgada', '1/2');
    expect(marks(node)).toEqual(['1/2']);
  });
});
