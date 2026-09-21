import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepuracionBackupsModal } from './DepuracionBackupsModal';
import type { ResumenDepuracion } from '@ferreteria/shared';

const resumen: ResumenDepuracion = {
  candidatos: [
    { ruta: '/A/b3.fbk', nombre: 'b3.fbk', tamano_bytes: 1048576, fecha: '2026-01-01T00:00:00-03:00', tipo: 'auto', incluye_certs: false, cifrado: false, app_version: '1.0.0' },
  ],
  protegidos: [],
  bytesALiberar: 1048576,
  porCarpeta: { '/A': { candidatos: 1, bytes: 1048576 } },
};

beforeEach(() => {
  (globalThis as any).ferreteria = {
    backup: {
      evaluarDepuracion: vi.fn().mockResolvedValue(resumen),
      depurar: vi.fn().mockResolvedValue({ eliminados: 1, bytesLiberados: 1048576 }),
    },
  };
});

describe('DepuracionBackupsModal', () => {
  it('lista candidatos y al confirmar llama a depurar con las rutas', async () => {
    const onClose = vi.fn();
    const onDone = vi.fn();
    render(<DepuracionBackupsModal resumen={resumen} onClose={onClose} onDone={onDone} />);
    expect(screen.getByText('b3.fbk')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /depurar ahora/i }));
    await waitFor(() => {
      expect((globalThis as any).ferreteria.backup.depurar).toHaveBeenCalledWith({ rutas: ['/A/b3.fbk'] });
      expect(onDone).toHaveBeenCalled();
    });
  });

  it('postergar cierra sin borrar y persiste la fecha', () => {
    try { localStorage.removeItem('backup_depuracion_pospuesta_hasta'); } catch { /* noop */ }
    const onClose = vi.fn();
    render(<DepuracionBackupsModal resumen={resumen} onClose={onClose} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '15 días' }));
    expect(onClose).toHaveBeenCalled();
    expect((globalThis as any).ferreteria.backup.depurar).not.toHaveBeenCalled();
    const hasta = Number(localStorage.getItem('backup_depuracion_pospuesta_hasta'));
    // ~15 días en el futuro (con margen para la ejecución del test).
    expect(hasta).toBeGreaterThan(Date.now() + 14 * 86400000);
  });
});
