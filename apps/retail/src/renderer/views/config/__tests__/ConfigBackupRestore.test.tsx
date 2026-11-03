import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigBackupRestore } from '@core/ui';

const mockGetParam = vi.fn();
const mockSetParam = vi.fn();
const mockListar = vi.fn();
const mockEjecutar = vi.fn();
const mockEliminar = vi.fn();
const mockSeleccionarCarpeta = vi.fn();
const mockGetDefaultBackupPath = vi.fn();
const mockEvaluarDepuracion = vi.fn();

function setupFerreteria() {
  (window as any).ferreteria = {
    parametros: { get: mockGetParam, set: mockSetParam },
    backup: { listar: mockListar, ejecutar: mockEjecutar, eliminar: mockEliminar, evaluarDepuracion: mockEvaluarDepuracion },
    restore: { validar: vi.fn(), ejecutar: vi.fn() },
    dialog: {
      seleccionarCarpeta: mockSeleccionarCarpeta,
      seleccionarArchivo: vi.fn(),
      getDefaultBackupPath: mockGetDefaultBackupPath,
    },
  };
}

function renderView() {
  return render(<MemoryRouter><ConfigBackupRestore /></MemoryRouter>);
}

const BACKUP_ITEM = {
  ruta: 'C:\\Backups\\ferreteria-2026-06-30.fbk',
  nombre: 'ferreteria-2026-06-30.fbk',
  fecha: '2026-06-30T14:00:00.000Z',
  tipo: 'manual',
  tamano_bytes: 1_048_576,
  migrations_aplicadas: 10,
  schema_hash: 'abc123',
  incluye_certs: false,
  cifrado: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetParam.mockResolvedValue(undefined);
  mockSetParam.mockResolvedValue(undefined);
  mockListar.mockResolvedValue([]);
  mockEjecutar.mockResolvedValue({ ruta: 'C:\\Backups\\nuevo.fbk' });
  mockEliminar.mockResolvedValue(undefined);
  mockSeleccionarCarpeta.mockResolvedValue(null);
  mockGetDefaultBackupPath.mockResolvedValue(null); // sin default por defecto en tests
  mockEvaluarDepuracion.mockResolvedValue({ candidatos: [], protegidos: [], bytesALiberar: 0, porCarpeta: {} });
  setupFerreteria();
});

describe('ConfigBackupRestore — estado inicial', () => {
  it('renderiza encabezado y botones de acción', async () => {
    renderView();
    expect(screen.getByText('Backups')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear backup ahora' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar desde archivo…' })).toBeInTheDocument();
  });

  it('carga los 7 parámetros al montar', async () => {
    renderView();
    await waitFor(() => {
      expect(mockGetParam).toHaveBeenCalledWith({ clave: 'backup_destino_local' });
      expect(mockGetParam).toHaveBeenCalledWith({ clave: 'backup_auto_habilitado' });
      expect(mockGetParam).toHaveBeenCalledWith({ clave: 'backup_retencion_dias' });
      expect(mockGetParam).toHaveBeenCalledWith({ clave: 'backup_incluir_certs' });
      expect(mockGetParam).toHaveBeenCalledWith({ clave: 'backup_retencion_cantidad' });
      expect(mockGetParam).toHaveBeenCalledWith({ clave: 'backup_retencion_piso' });
      expect(mockGetParam).toHaveBeenCalledWith({ clave: 'backup_retencion_size_mb' });
    });
  });

  it('muestra empty state cuando no hay directorio configurado', async () => {
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    expect(screen.getByText('No hay backups en la carpeta configurada.')).toBeInTheDocument();
  });

  it('pre-popula el campo con la ruta por defecto cuando backup_destino_local está vacío', async () => {
    mockGetDefaultBackupPath.mockResolvedValue('C:\\Users\\user\\AppData\\Roaming\\Ferreteria');
    renderView();
    await waitFor(() => {
      expect(screen.getByLabelText('Carpeta destino')).toHaveValue(
        'C:\\Users\\user\\AppData\\Roaming\\Ferreteria',
      );
    });
  });
});

describe('ConfigBackupRestore — lista de backups', () => {
  beforeEach(() => {
    mockGetParam.mockImplementation(({ clave }: { clave: string }) =>
      Promise.resolve(clave === 'backup_destino_local' ? 'C:\\Backups' : undefined)
    );
    mockListar.mockResolvedValue([BACKUP_ITEM]);
  });

  it('muestra tabla de backups con tipo y tamaño', async () => {
    renderView();
    await screen.findByText('manual');
    expect(screen.getByText('1.00 MB')).toBeInTheDocument();
  });

  it('eliminar backup llama api.backup.eliminar tras confirmar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderView();
    await screen.findByText('manual');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(mockEliminar).toHaveBeenCalledWith({ ruta: BACKUP_ITEM.ruta }));
  });

  it('no elimina si el usuario cancela el confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderView();
    await screen.findByText('manual');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(mockEliminar).not.toHaveBeenCalled();
  });
});

describe('ConfigBackupRestore — crear backup', () => {
  it('muestra error si no hay carpeta destino configurada', async () => {
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    fireEvent.click(screen.getByRole('button', { name: 'Crear backup ahora' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Configurá una carpeta destino antes de crear un backup.');
  });

  it('llama api.backup.ejecutar y muestra confirmación de éxito', async () => {
    mockGetParam.mockImplementation(({ clave }: { clave: string }) =>
      Promise.resolve(clave === 'backup_destino_local' ? 'C:\\Backups' : undefined)
    );
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    fireEvent.click(screen.getByRole('button', { name: 'Crear backup ahora' }));
    await screen.findByText('Backup creado exitosamente.');
    expect(mockEjecutar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'manual', destino: 'C:\\Backups' }));
  });

  it('muestra error si api.backup.ejecutar falla', async () => {
    mockGetParam.mockImplementation(({ clave }: { clave: string }) =>
      Promise.resolve(clave === 'backup_destino_local' ? 'C:\\Backups' : undefined)
    );
    mockEjecutar.mockRejectedValue(new Error('Disco lleno'));
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    fireEvent.click(screen.getByRole('button', { name: 'Crear backup ahora' }));
    await screen.findByText('Disco lleno');
  });
});

describe('ConfigBackupRestore — guardar configuración', () => {
  it('llama api.parametros.set para los 7 parámetros y muestra confirmación', async () => {
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    await waitFor(() => {
      expect(mockSetParam).toHaveBeenCalledWith({ clave: 'backup_destino_local',   valor: '' });
      expect(mockSetParam).toHaveBeenCalledWith({ clave: 'backup_auto_habilitado', valor: 'true' });
      expect(mockSetParam).toHaveBeenCalledWith({ clave: 'backup_retencion_dias',  valor: '30' });
      expect(mockSetParam).toHaveBeenCalledWith({ clave: 'backup_incluir_certs',   valor: 'false' });
      expect(mockSetParam).toHaveBeenCalledWith({ clave: 'backup_retencion_cantidad', valor: '10' });
      expect(mockSetParam).toHaveBeenCalledWith({ clave: 'backup_retencion_piso',     valor: '3' });
      expect(mockSetParam).toHaveBeenCalledWith({ clave: 'backup_retencion_size_mb',  valor: '0' });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Parámetros guardados.');
  });
});

describe('ConfigBackupRestore — advertencia de certificados', () => {
  it('muestra advertencia al activar "Incluir certificados AFIP"', async () => {
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    fireEvent.click(screen.getByRole('checkbox', { name: /incluir certificados afip/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Los certificados AFIP son credenciales fiscales');
  });

  it('no muestra advertencia cuando certs está desactivado', async () => {
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ConfigBackupRestore — auto-guardar al examinar carpeta', () => {
  it('guarda automáticamente backup_destino_local al seleccionar carpeta con Examinar', async () => {
    mockSeleccionarCarpeta.mockResolvedValue('C:\\Backups\\NuevaCarpeta');
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    fireEvent.click(screen.getByRole('button', { name: /examinar/i }));
    await waitFor(() => {
      expect(mockSetParam).toHaveBeenCalledWith({
        clave: 'backup_destino_local',
        valor: 'C:\\Backups\\NuevaCarpeta',
      });
    });
  });

  it('no auto-guarda si el diálogo es cancelado', async () => {
    mockSeleccionarCarpeta.mockResolvedValue(null);
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    fireEvent.click(screen.getByRole('button', { name: /examinar/i }));
    await waitFor(() => expect(mockSeleccionarCarpeta).toHaveBeenCalled());
    expect(mockSetParam).not.toHaveBeenCalledWith(
      expect.objectContaining({ clave: 'backup_destino_local' }),
    );
  });
});

describe('ConfigBackupRestore — RestoreWizard', () => {
  it('abre el RestoreWizard al hacer clic en "Restaurar desde archivo…"', async () => {
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar desde archivo…' }));
    expect(screen.getByRole('dialog', { name: 'Restaurar desde backup' })).toBeInTheDocument();
  });

  it('cierra el RestoreWizard al presionar Escape dentro del wizard', async () => {
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledTimes(7));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar desde archivo…' }));
    expect(screen.getByRole('dialog', { name: 'Restaurar desde backup' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Restaurar desde backup' })).not.toBeInTheDocument()
    );
  });
});
