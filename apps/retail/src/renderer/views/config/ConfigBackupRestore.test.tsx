import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigBackupRestore } from './ConfigBackupRestore';

beforeEach(() => {
  (globalThis as any).ferreteria = {
    parametros: { get: vi.fn().mockResolvedValue(''), set: vi.fn().mockResolvedValue(undefined) },
    dialog: { getDefaultBackupPath: vi.fn().mockResolvedValue('/backups'), seleccionarCarpeta: vi.fn() },
    backup: {
      listar: vi.fn().mockResolvedValue([]),
      evaluarDepuracion: vi.fn().mockResolvedValue({
        candidatos: [{ ruta: '/backups/x.fbk', nombre: 'x.fbk', tamano_bytes: 1048576, fecha: '2026-01-01T00:00:00-03:00', tipo: 'auto', incluye_certs: false, cifrado: false, app_version: '1.0.0' }],
        protegidos: [], bytesALiberar: 1048576, porCarpeta: { '/backups': { candidatos: 1, bytes: 1048576 } },
      }),
      depurar: vi.fn(),
    },
  };
});

describe('ConfigBackupRestore — depuración', () => {
  it('muestra el banner de depurables cuando hay candidatos', async () => {
    render(<ConfigBackupRestore />);
    await waitFor(() => {
      expect(screen.getByText(/1 backups? depurables?/i)).toBeInTheDocument();
    });
  });
});
