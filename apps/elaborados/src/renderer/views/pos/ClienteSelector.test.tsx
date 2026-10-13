import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClienteSelector } from './ClienteSelector';
import { CONSUMIDOR_FINAL, CONSUMIDOR_FINAL_ID } from './consumidorFinal';

const CLIENTES = [
  { id: 'c1', nombre: 'Juan', apellido: 'García', numero_documento: '20111222', habilita_cuenta_corriente: true },
  { id: 'c2', nombre: 'Ana', apellido: 'Pérez', numero_documento: '30333444', habilita_cuenta_corriente: false },
];

describe('ClienteSelector', () => {
  let list: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    list = vi.fn().mockResolvedValue(CLIENTES);
    vi.stubGlobal('elaborados', { cliente: { list } });
  });
  afterEach(() => vi.unstubAllGlobals());

  const abrir = async (onCambiar = vi.fn(), clienteId = CONSUMIDOR_FINAL_ID) => {
    render(<ClienteSelector clienteId={clienteId} onCambiar={onCambiar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    await screen.findByLabelText('Buscar cliente');
    return onCambiar;
  };

  it('muestra Consumidor Final por defecto', () => {
    render(<ClienteSelector clienteId={CONSUMIDOR_FINAL_ID} onCambiar={vi.fn()} />);
    expect(screen.getByText('Consumidor Final')).toBeTruthy();
  });

  it('filtra por "gar" sin importar tildes ni mayúsculas', async () => {
    await abrir();
    await screen.findByText('Juan García');
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'gar' } });
    expect(screen.getByText('Juan García')).toBeTruthy();
    expect(screen.queryByText('Ana Pérez')).toBeNull();
  });

  it('elegir un cliente llama a onCambiar y cierra el panel', async () => {
    const onCambiar = await abrir();
    fireEvent.click(await screen.findByText('Juan García'));
    expect(onCambiar).toHaveBeenCalledWith({ id: 'c1', nombre_completo: 'Juan García', habilita_cuenta_corriente: true });
    expect(screen.queryByLabelText('Buscar cliente')).toBeNull();
  });

  it('muestra el badge Cta. cte. solo al cliente que la habilita', async () => {
    await abrir();
    await screen.findByText('Juan García');
    expect(screen.getAllByText('Cta. cte.')).toHaveLength(1);
  });

  it('elegir Consumidor Final devuelve el fijo', async () => {
    const onCambiar = await abrir(vi.fn(), 'c1');
    fireEvent.click(await screen.findByRole('button', { name: /Consumidor Final/ }));
    expect(onCambiar).toHaveBeenCalledWith(CONSUMIDOR_FINAL);
  });

  it('error de cliente.list muestra una alerta', async () => {
    list.mockRejectedValue(new Error('boom'));
    render(<ClienteSelector clienteId={CONSUMIDOR_FINAL_ID} onCambiar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('muestra el nombre recibido por prop cuando el cliente viene de afuera (p. ej. al retomar un pedido)', () => {
    render(<ClienteSelector clienteId="c-externo" nombre="Juan García" onCambiar={vi.fn()} />);
    expect(screen.getByText('Juan García')).toBeInTheDocument();
    expect(screen.queryByText('Cliente')).not.toBeInTheDocument();
  });
});
