import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RecuperarPassword } from '@core/ui';

// ADR-137: recuperación de contraseña por mail en dos pasos (pedir código; código + clave nueva).
const mockSolicitar = vi.fn();
const mockConfirmar = vi.fn();
const mockOnClose = vi.fn();
const NUEVA = 'Nueva#2026x';

function renderModal(nombreUsuarioInicial = '') {
  return render(
    <MemoryRouter>
      <RecuperarPassword nombreUsuarioInicial={nombreUsuarioInicial} onClose={mockOnClose} />
    </MemoryRouter>
  );
}

async function pasarAlCodigo() {
  mockSolicitar.mockResolvedValue({ ok: true });
  renderModal('ana');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
  await screen.findByLabelText('Código de 6 dígitos');
}

function completar(codigo: string, nueva = NUEVA, repetir = NUEVA) {
  fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: codigo } });
  fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: nueva } });
  fireEvent.change(screen.getByPlaceholderText('Repetir la nueva contraseña'), { target: { value: repetir } });
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    auth: { recuperarSolicitar: mockSolicitar, recuperarConfirmar: mockConfirmar },
  };
});
afterEach(() => { delete (window as any).ferreteria; });

describe('RecuperarPassword — pedir el código', () => {
  it('es un diálogo accesible con el usuario ya tipeado en el login', () => {
    renderModal('ana');
    expect(screen.getByRole('dialog', { name: 'Recuperar contraseña' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toHaveValue('ana');
  });

  it('sin usuario avisa y no llama al main', () => {
    renderModal('');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá tu usuario.');
    expect(mockSolicitar).not.toHaveBeenCalled();
  });

  it('solicita el código con el usuario recortado y pasa al paso siguiente', async () => {
    mockSolicitar.mockResolvedValue({ ok: true });
    renderModal('  ana ');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    await waitFor(() => expect(mockSolicitar).toHaveBeenCalledWith({ identificador: 'ana' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/si el usuario existe/i);
  });

  it('un error al pedir el código se muestra traducido y no avanza', async () => {
    mockSolicitar.mockRejectedValue(new Error('NOT_FOUND'));
    renderModal('ana');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByLabelText('Código de 6 dígitos')).not.toBeInTheDocument();
  });

  it('Cancelar cierra', () => {
    renderModal('ana');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('RecuperarPassword — código y contraseña nueva', () => {
  it('un código que no tiene 6 dígitos no llama al main', async () => {
    await pasarAlCodigo();
    completar('12ab');
    expect(screen.getByRole('alert')).toHaveTextContent(/6 dígitos/i);
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it('contraseñas distintas: avisa y no llama al main', async () => {
    await pasarAlCodigo();
    completar('123456', NUEVA, NUEVA + 'x');
    expect(screen.getByRole('alert')).toHaveTextContent(/no coinciden/i);
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it('contraseña débil: muestra el motivo y no llama al main', async () => {
    await pasarAlCodigo();
    completar('123456', 'corta', 'corta');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it('confirma con usuario, código y contraseña nueva, y avisa que ya puede iniciar sesión', async () => {
    mockConfirmar.mockResolvedValue(undefined);
    await pasarAlCodigo();
    completar('123456');
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledWith({
      identificador: 'ana', codigo: '123456', passwordNueva: NUEVA,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent(/ya podés iniciar sesión/i);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio de sesión' }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('un código incorrecto o vencido muestra el mensaje y deja reintentar', async () => {
    mockConfirmar.mockRejectedValue(new Error('CODIGO_INVALIDO'));
    await pasarAlCodigo();
    completar('123456');
    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrecto o venció/i);
    expect(screen.getByLabelText('Código de 6 dígitos')).toBeInTheDocument();
  });

  it('«Pedir otro código» vuelve al primer paso', async () => {
    await pasarAlCodigo();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir otro código' }));
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toHaveValue('ana');
  });
});
