import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProveedorDetalle } from './ProveedorDetalle';

const proveedor = {
  id: 'prov1', tipo_documento: 'CUIT', numero_documento: '20111111112',
  razon_social: 'Proveedor SA', nombre_fantasia: null, condicion_fiscal: 'Responsable Inscripto',
  codigo: 'PR-01', domicilio: null, localidad: null, provincia: null, codigo_postal: null,
  telefono: null, email: null, persona_contacto: null, observaciones: null, activo: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  (window as any).ferreteria = {
    compras: {
      proveedor: {
        get: vi.fn().mockResolvedValue(proveedor),
        deactivate: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/compras/proveedores/prov1']}>
      <Routes>
        <Route path="/compras/proveedores/:id" element={<ProveedorDetalle />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProveedorDetalle — "Dar de baja" (antes fallaba en silencio)', () => {
  it('muestra el error traducido cuando falla la baja y el botón vuelve a estar disponible', async () => {
    (window as any).ferreteria.compras.proveedor.deactivate = vi.fn().mockRejectedValue(new Error('PROVEEDOR_CON_OC_ABIERTAS'));
    renderView();
    await waitFor(() => expect(screen.getByText('Proveedor SA')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /dar de baja/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('PROVEEDOR_CON_OC_ABIERTAS'));
    // el proveedor sigue activo (no se aplicó el cambio optimista) y el botón está disponible
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dar de baja/i })).toBeEnabled();
  });

  it('da de baja sin error cuando la llamada tiene éxito', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Proveedor SA')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /dar de baja/i }));

    await waitFor(() => expect(screen.getByText('Inactivo')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
