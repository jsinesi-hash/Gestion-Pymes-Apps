import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RestoreWizard } from '@core/ui';

const mockValidar = vi.fn();
const mockEjecutar = vi.fn();
const mockOnClose = vi.fn();
const mockOnSuccess = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    restore: { validar: mockValidar, ejecutar: mockEjecutar },
    dialog: { seleccionarArchivo: vi.fn().mockResolvedValue(null) },
  };
});

function renderWizard() {
  return render(
    <MemoryRouter>
      <RestoreWizard onClose={mockOnClose} onSuccess={mockOnSuccess} />
    </MemoryRouter>
  );
}

const MANIFEST = {
  created_at: '2026-06-30T14:00:00.000Z',
  app_version: '1.0.0',
  sucursal_id: 'local',
  schema_hash: 'abc123',
  migrations_applied: 10,
  tipo: 'manual',
  incluye_certs: false,
  row_counts: { producto: 35, cliente: 10 },
};

const VALIDACION_OK = {
  ok: true,
  compatibilidad: 'direct' as const,
  manifest: MANIFEST,
  row_counts_actuales: { producto: 40, cliente: 12 },
};

const RESULTADO_EJECUTAR = {
  row_counts_antes: { producto: 40, cliente: 12 },
  row_counts_despues: { producto: 35, cliente: 10 },
};

// Helpers para avanzar pasos
async function avanzarAComparar() {
  renderWizard();
  fireEvent.change(screen.getByLabelText('Ruta del archivo .fbk'), { target: { value: 'C:\\bk\\file.fbk' } });
  fireEvent.click(screen.getByRole('button', { name: 'Validar backup' }));
  await screen.findByRole('button', { name: 'Continuar →' });
}

async function avanzarAConfirmar() {
  await avanzarAComparar();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar →' }));
}

describe('RestoreWizard — paso seleccionar', () => {
  it('renderiza el modal con campos de ruta y contraseña', () => {
    renderWizard();
    expect(screen.getByRole('dialog', { name: 'Restaurar desde backup' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ruta del archivo .fbk')).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validar backup' })).toBeInTheDocument();
  });

  it('muestra error si se intenta validar sin ruta', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Validar backup' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá la ruta del archivo .fbk');
    expect(mockValidar).not.toHaveBeenCalled();
  });

  it('botón Cancelar llama a onClose', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('botón ✕ llama a onClose', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('Escape llama a onClose', () => {
    renderWizard();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('RestoreWizard — validación', () => {
  it('llama api.restore.validar con la ruta y avanza a comparar', async () => {
    mockValidar.mockResolvedValue(VALIDACION_OK);
    await avanzarAComparar();
    expect(mockValidar).toHaveBeenCalledWith({ ruta: 'C:\\bk\\file.fbk' });
  });

  it('incluye password en la llamada cuando está especificada', async () => {
    mockValidar.mockResolvedValue(VALIDACION_OK);
    renderWizard();
    fireEvent.change(screen.getByLabelText('Ruta del archivo .fbk'), { target: { value: 'C:\\bk\\file.fbk' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'clave123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar backup' }));
    await screen.findByRole('button', { name: 'Continuar →' });
    expect(mockValidar).toHaveBeenCalledWith({ ruta: 'C:\\bk\\file.fbk', password: 'clave123' });
  });

  it('muestra error y vuelve a seleccionar si validación falla (ok: false)', async () => {
    mockValidar.mockResolvedValue({ ok: false, error: 'Checksum inválido', compatibilidad: 'incompatible' });
    renderWizard();
    fireEvent.change(screen.getByLabelText('Ruta del archivo .fbk'), { target: { value: 'C:\\bk\\file.fbk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar backup' }));
    await screen.findByText('Checksum inválido');
    expect(screen.getByRole('button', { name: 'Validar backup' })).toBeInTheDocument();
  });

  it('muestra error si api.restore.validar lanza excepción', async () => {
    mockValidar.mockRejectedValue(new Error('Archivo no encontrado'));
    renderWizard();
    fireEvent.change(screen.getByLabelText('Ruta del archivo .fbk'), { target: { value: 'C:\\bk\\file.fbk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar backup' }));
    expect(await screen.findByText('Archivo no encontrado')).toBeInTheDocument();
  });
});

describe('RestoreWizard — paso comparar', () => {
  it('muestra mensaje verde para compatibilidad direct', async () => {
    mockValidar.mockResolvedValue(VALIDACION_OK);
    await avanzarAComparar();
    expect(screen.getByText('✓ Backup compatible — se puede restaurar directamente.')).toBeInTheDocument();
  });

  it('muestra mensaje amarillo para compatibilidad migrate', async () => {
    mockValidar.mockResolvedValue({ ...VALIDACION_OK, compatibilidad: 'migrate' });
    renderWizard();
    fireEvent.change(screen.getByLabelText('Ruta del archivo .fbk'), { target: { value: 'C:\\bk\\file.fbk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar backup' }));
    expect(await screen.findByText('⚠ Backup de versión anterior — se aplicarán migraciones automáticamente.')).toBeInTheDocument();
  });

  it('muestra las tablas del manifest con sus row_counts', async () => {
    mockValidar.mockResolvedValue(VALIDACION_OK);
    await avanzarAComparar();
    expect(screen.getByText('producto')).toBeInTheDocument();
    expect(screen.getByText('cliente')).toBeInTheDocument();
  });

  it('avanza al paso confirmar al hacer clic en "Continuar →"', async () => {
    mockValidar.mockResolvedValue(VALIDACION_OK);
    await avanzarAComparar();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar →' }));
    expect(screen.getByLabelText(/para confirmar, escribí/i)).toBeInTheDocument();
  });
});

describe('RestoreWizard — paso confirmar y ejecución', () => {
  beforeEach(() => {
    mockValidar.mockResolvedValue(VALIDACION_OK);
    mockEjecutar.mockResolvedValue(RESULTADO_EJECUTAR);
  });

  it('botón "Restaurar ahora" está deshabilitado sin texto de confirmación', async () => {
    await avanzarAConfirmar();
    expect(screen.getByRole('button', { name: 'Restaurar ahora' })).toBeDisabled();
  });

  it('botón "Restaurar ahora" se habilita solo al escribir exactamente RESTAURAR', async () => {
    await avanzarAConfirmar();
    const input = screen.getByLabelText(/para confirmar, escribí/i);
    fireEvent.change(input, { target: { value: 'restaurar' } }); // minúsculas
    expect(screen.getByRole('button', { name: 'Restaurar ahora' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'RESTAURAR' } });
    expect(screen.getByRole('button', { name: 'Restaurar ahora' })).not.toBeDisabled();
  });

  it('ejecutar llama api.restore.ejecutar y llama onSuccess', async () => {
    await avanzarAConfirmar();
    fireEvent.change(screen.getByLabelText(/para confirmar, escribí/i), { target: { value: 'RESTAURAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar ahora' }));
    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());
    expect(mockEjecutar).toHaveBeenCalledWith({ ruta: 'C:\\bk\\file.fbk' });
  });

  it('muestra error y vuelve a confirmar si api.restore.ejecutar falla', async () => {
    mockEjecutar.mockRejectedValue(new Error('BD bloqueada'));
    await avanzarAConfirmar();
    fireEvent.change(screen.getByLabelText(/para confirmar, escribí/i), { target: { value: 'RESTAURAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar ahora' }));
    await screen.findByText('BD bloqueada');
    expect(screen.getByRole('button', { name: 'Restaurar ahora' })).toBeInTheDocument();
  });

  it('Escape NO llama a onClose durante la ejecución', async () => {
    let resolveEjecutar!: (v: any) => void;
    mockEjecutar.mockReturnValue(new Promise(r => { resolveEjecutar = r; }));
    await avanzarAConfirmar();
    fireEvent.change(screen.getByLabelText(/para confirmar, escribí/i), { target: { value: 'RESTAURAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar ahora' }));
    await screen.findByText('Restaurando base de datos…');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).not.toHaveBeenCalled();
    resolveEjecutar(RESULTADO_EJECUTAR);
  });

  it('"Volver" regresa al paso comparar', async () => {
    await avanzarAConfirmar();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('button', { name: 'Continuar →' })).toBeInTheDocument();
  });
});
