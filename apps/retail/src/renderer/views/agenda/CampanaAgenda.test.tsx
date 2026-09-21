import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CampanaAgenda } from './CampanaAgenda';

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const badge = vi.fn();
const getParam = vi.fn();

beforeEach(() => {
  navigateSpy.mockReset(); badge.mockReset(); getParam.mockReset();
  badge.mockResolvedValue({ atrasadas: 3, avisos_fallidos: 2 });
  (globalThis as any).ferreteria = {
    aviso: { badge },
    parametros: { get: getParam },
  };
});

function renderCampana() { return render(<MemoryRouter><CampanaAgenda /></MemoryRouter>); }

describe('CampanaAgenda', () => {
  it('no renderiza nada si el módulo está deshabilitado', async () => {
    getParam.mockResolvedValue('false');
    const { container } = renderCampana();
    await waitFor(() => expect(badge).not.toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('habilitado: muestra el contador suma (atrasadas + fallidos)', async () => {
    getParam.mockResolvedValue('true');
    renderCampana();
    expect(await screen.findByText('5')).toBeInTheDocument();   // 3 + 2
  });

  it('al abrir el menú, click en avisos fallidos navega a /agenda/avisos', async () => {
    getParam.mockResolvedValue('true');
    renderCampana();
    fireEvent.click(await screen.findByLabelText('Agenda'));
    fireEvent.click(await screen.findByText('Avisos fallidos'));
    expect(navigateSpy).toHaveBeenCalledWith('/agenda/avisos');
  });
});
