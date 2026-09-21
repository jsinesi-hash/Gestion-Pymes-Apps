import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BandejaAvisosView } from './BandejaAvisosView';

vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

const listar = vi.fn();
const reintentar = vi.fn();
const descartar = vi.fn();

beforeEach(() => {
  [listar, reintentar, descartar].forEach((f) => f.mockReset());
  reintentar.mockResolvedValue({});
  descartar.mockResolvedValue({ ok: true });
  (globalThis as any).ferreteria = { aviso: { listar, reintentar, descartar } };
});

function unAviso(over: Partial<any> = {}) {
  return {
    id: 'a1', agenda_evento_id: 'e1', origen_tipo: 'agenda_evento', origen_id: 'e1',
    canal: 'in_app', destinatario_usuario_id: 'u1', destinatario_contacto: null,
    payload: JSON.stringify({ titulo: 'Aviso X', cuerpo: 'cuerpo' }), estado: 'pendiente',
    intentos: 0, ultimo_error: null, proximo_intento_at: null,
    generado_at: Date.now(), enviado_at: null, ...over,
  };
}

function renderView() { return render(<MemoryRouter><BandejaAvisosView /></MemoryRouter>); }

describe('BandejaAvisosView', () => {
  it('muestra el título del payload y el canal', async () => {
    listar.mockResolvedValue([unAviso()]);
    renderView();
    expect(await screen.findByText('Aviso X')).toBeInTheDocument();
    expect(screen.getByText('En la app', { selector: 'td' })).toBeInTheDocument();
  });

  it('los fallidos aparecen antes que el resto', async () => {
    listar.mockResolvedValue([
      unAviso({ id: 'ok', payload: JSON.stringify({ titulo: 'Enviado Z', cuerpo: '' }), estado: 'enviado', canal: 'email', destinatario_contacto: 'x@y.com' }),
      unAviso({ id: 'bad', payload: JSON.stringify({ titulo: 'Fallido A', cuerpo: '' }), estado: 'fallido', canal: 'email', destinatario_contacto: 'x@y.com', ultimo_error: 'EMAIL_NO_IMPLEMENTADO' }),
    ]);
    renderView();
    await screen.findByText('Fallido A');
    // con estado "Todos" para ver ambos
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '' } });
    const filas = screen.getAllByText(/Fallido A|Enviado Z/);
    expect(filas[0]).toHaveTextContent('Fallido A');
  });

  it('reintentar llama al IPC', async () => {
    listar.mockResolvedValue([unAviso({ estado: 'fallido' })]);
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(reintentar).toHaveBeenCalledWith({ id: 'a1' }));
  });

  it('ver traza abre el modal con el último error', async () => {
    listar.mockResolvedValue([unAviso({ estado: 'fallido', ultimo_error: 'EMAIL_NO_IMPLEMENTADO' })]);
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Traza' }));
    expect(await screen.findByText(/EMAIL_NO_IMPLEMENTADO/)).toBeInTheDocument();
  });

  it('el modal de traza cierra con Escape', async () => {
    listar.mockResolvedValue([unAviso({ estado: 'fallido', ultimo_error: 'EMAIL_NO_IMPLEMENTADO' })]);
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Traza' }));
    await screen.findByText(/EMAIL_NO_IMPLEMENTADO/);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByText(/EMAIL_NO_IMPLEMENTADO/)).not.toBeInTheDocument();
  });
});
