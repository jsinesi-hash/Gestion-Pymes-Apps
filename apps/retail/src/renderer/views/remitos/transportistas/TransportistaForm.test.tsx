import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TransportistaForm } from './TransportistaForm';

const upsert = vi.fn();
const get = vi.fn();

beforeEach(() => {
  upsert.mockReset();
  get.mockReset();
  (globalThis as any).ferreteria = { transportista: { upsert, get } };
});

function renderForm(path = '/remitos/transportistas/nuevo') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/remitos/transportistas/nuevo" element={<TransportistaForm />} />
        <Route path="/remitos/transportistas/:id/editar" element={<TransportistaForm />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TransportistaForm', () => {
  it('crea un transportista con los datos cargados', async () => {
    upsert.mockResolvedValue({ id: 't1' });
    renderForm();

    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: 'Transporte Rex' } });
    fireEvent.change(screen.getByLabelText(/teléfono/i), { target: { value: '11-1234' } });
    fireEvent.click(screen.getByRole('button', { name: /crear transportista/i }));

    await waitFor(() => expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      razon_social: 'Transporte Rex',
      telefono: '11-1234',
    })));
  });

  it('no deja crear sin razon social', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /crear transportista/i }));

    expect(await screen.findByText(/obligatoria/i)).toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('precarga los datos en modo edicion', async () => {
    get.mockResolvedValue({ id: 't1', razon_social: 'Transporte Rex', telefono: '111', email: null, persona_contacto: null, domicilio: null, observaciones: null });
    renderForm('/remitos/transportistas/t1/editar');

    await waitFor(() => expect(get).toHaveBeenCalledWith('t1'));
    expect(await screen.findByDisplayValue('Transporte Rex')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('rutea el error de validación del backend al campo email', async () => {
    upsert.mockRejectedValue(new Error('VALIDATION:email:TIPO'));
    renderForm();

    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: 'Transporte Rex' } });
    fireEvent.click(screen.getByRole('button', { name: /crear transportista/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('email')));
    expect(await screen.findByText(/formato inválido/i)).toBeInTheDocument();
  });
});
