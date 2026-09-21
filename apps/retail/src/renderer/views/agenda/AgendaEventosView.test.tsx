import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgendaEventosView } from './AgendaEventosView';

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const listar = vi.fn();
const completar = vi.fn();
const posponer = vi.fn();
const descartar = vi.fn();
const crearEvento = vi.fn();

beforeEach(() => {
  navigateSpy.mockReset();
  [listar, completar, posponer, descartar, crearEvento].forEach((f) => f.mockReset());
  completar.mockResolvedValue({ ok: true });
  posponer.mockResolvedValue({ ok: true });
  descartar.mockResolvedValue({ ok: true });
  crearEvento.mockResolvedValue({});
  (globalThis as any).ferreteria = {
    agenda: { listar, completar, posponer, descartar, crearEvento },
    parametros: { get: vi.fn().mockResolvedValue('14') },
  };
});

function unEvento(over: Partial<any> = {}) {
  return {
    id: 'e1', origen: 'manual', rutina_id: null, titulo: 'Llamar proveedor', descripcion: null,
    fecha: new Date(Date.now() - 86400000).toISOString(), estado: 'pendiente', nota: null,
    destinatario_tipo: 'usuario', destinatario_usuario_id: 'u1', destinatario_rol: null,
    proveedor_id: null, orden_compra_id: null, producto_id: null, ...over,
  };
}

function renderView() {
  return render(<MemoryRouter><AgendaEventosView /></MemoryRouter>);
}

describe('AgendaEventosView', () => {
  it('muestra un evento atrasado bajo la zona Atrasadas', async () => {
    listar.mockResolvedValue([unEvento()]);
    renderView();
    expect(await screen.findByText('Llamar proveedor')).toBeInTheDocument();
    expect(screen.getByText(/Atrasadas/)).toBeInTheDocument();
  });

  it('por defecto oculta completadas/descartadas', async () => {
    listar.mockResolvedValue([
      unEvento({ id: 'a', titulo: 'Pendiente X' }),
      unEvento({ id: 'b', titulo: 'Completada Y', estado: 'completada' }),
    ]);
    renderView();
    expect(await screen.findByText('Pendiente X')).toBeInTheDocument();
    expect(screen.queryByText('Completada Y')).not.toBeInTheDocument();
  });

  it('busca por título', async () => {
    listar.mockResolvedValue([
      unEvento({ id: '1', titulo: 'Pedido tornillos' }),
      unEvento({ id: '2', titulo: 'Revisar caja' }),
    ]);
    renderView();
    await screen.findByText('Pedido tornillos');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por título/), { target: { value: 'tornillos' } });
    expect(screen.getByText('Pedido tornillos')).toBeInTheDocument();
    expect(screen.queryByText('Revisar caja')).not.toBeInTheDocument();
  });

  it('completar llama al IPC con el id', async () => {
    listar.mockResolvedValue([unEvento()]);
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Completar' }));
    await waitFor(() => expect(completar).toHaveBeenCalledWith({ id: 'e1' }));
  });

  it('abrir origen navega a la OC cuando hay orden_compra_id', async () => {
    listar.mockResolvedValue([unEvento({ orden_compra_id: 'oc9' })]);
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir origen' }));
    expect(navigateSpy).toHaveBeenCalledWith('/compras/ordenes/oc9');
  });

  it('el modal "Nuevo evento" cierra con Escape', async () => {
    listar.mockResolvedValue([]);
    renderView();
    fireEvent.click(await screen.findByText('+ Nuevo evento'));
    await screen.findByText('Nuevo evento');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByText('Nuevo evento')).not.toBeInTheDocument();
  });

  it('el modal de Posponer cierra con Escape', async () => {
    listar.mockResolvedValue([unEvento()]);
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Posponer' }));
    expect(screen.getByText(/posponer «llamar proveedor»/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByText(/posponer «llamar proveedor»/i)).not.toBeInTheDocument();
  });

  it('el modal de Descartar cierra con Escape', async () => {
    listar.mockResolvedValue([unEvento()]);
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }));
    expect(screen.getByText(/descartar «llamar proveedor»/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByText(/descartar «llamar proveedor»/i)).not.toBeInTheDocument();
  });
});
