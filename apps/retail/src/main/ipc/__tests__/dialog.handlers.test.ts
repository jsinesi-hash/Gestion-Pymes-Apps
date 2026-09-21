import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

import { dialog } from 'electron';
import { seleccionarCarpetaHandler, seleccionarArchivoHandler } from '../dialog';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('seleccionarCarpetaHandler', () => {
  it('devuelve la ruta seleccionada cuando el usuario elige una carpeta', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['C:\\Backups\\Ferreteria'],
    });
    const result = await seleccionarCarpetaHandler();
    expect(result).toBe('C:\\Backups\\Ferreteria');
  });

  it('devuelve null si el usuario cancela el diálogo', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    const result = await seleccionarCarpetaHandler();
    expect(result).toBeNull();
  });

  it('llama a showOpenDialog con properties openDirectory', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/ruta'],
    });
    await seleccionarCarpetaHandler();
    expect(vi.mocked(dialog.showOpenDialog)).toHaveBeenCalledWith(
      expect.objectContaining({ properties: ['openDirectory'] })
    );
  });
});

describe('seleccionarArchivoHandler', () => {
  it('devuelve la ruta del archivo seleccionado', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['C:\\Backups\\ferreteria-backup.fbk'],
    });
    const result = await seleccionarArchivoHandler();
    expect(result).toBe('C:\\Backups\\ferreteria-backup.fbk');
  });

  it('devuelve null si el usuario cancela el diálogo', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    const result = await seleccionarArchivoHandler();
    expect(result).toBeNull();
  });

  it('filtra por extensión fbk', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/ruta.fbk'],
    });
    await seleccionarArchivoHandler();
    expect(vi.mocked(dialog.showOpenDialog)).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.arrayContaining([
          expect.objectContaining({ extensions: ['fbk'] }),
        ]),
      })
    );
  });
});
