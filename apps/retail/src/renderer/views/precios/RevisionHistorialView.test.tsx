import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RevisionHistorialView } from './RevisionHistorialView';

function mockApi() {
  (window as any).ferreteria = {
    importacionCosto: {
      getHistorial: vi.fn().mockResolvedValue([]),
      getColaRevision: vi.fn().mockResolvedValue([]),
    },
    importacionCatalogo: { getHistorial: vi.fn().mockResolvedValue([]) },
    catalogo: { producto: { list: vi.fn().mockResolvedValue({ items: [] }) } },
  };
}

function renderAt(entry: string) {
  return render(<MemoryRouter initialEntries={[entry]}><RevisionHistorialView /></MemoryRouter>);
}

describe('RevisionHistorialView', () => {
  beforeEach(mockApi);

  // ADR-056 Lote 4: los tabs se renombran a "Revisión Costos" / "Historial de Costos" /
  // "Historial de Catálogo" (las claves internas y el default no cambian).
  it('muestra los 3 tabs renombrados y carga Historial de Costos por default', async () => {
    renderAt('/precios/revision-historial');
    expect(screen.getByRole('tab', { name: /revisi[oó]n costos/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /historial de costos/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /historial de cat[aá]logo/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /historial de costos/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('respeta ?tab=revision', async () => {
    renderAt('/precios/revision-historial?tab=revision');
    expect(screen.getByRole('tab', { name: /revisi[oó]n costos/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('cambia de tab al hacer clic en Historial de Catálogo', async () => {
    renderAt('/precios/revision-historial');
    fireEvent.click(screen.getByRole('tab', { name: /historial de cat[aá]logo/i }));
    expect(screen.getByRole('tab', { name: /historial de cat[aá]logo/i }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText(/no se import[oó] ning[uú]n cat[aá]logo/i)).toBeDefined();
  });
});
