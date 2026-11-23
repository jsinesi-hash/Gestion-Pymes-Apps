import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '../../auth/AuthContext';
import { configurarBridge } from '../../bridge';
import { ConfigSincronizacion } from './ConfigSincronizacion';

// F2 PR4: Configuración → Sincronización. El emparejamiento exige ver la huella del hub y confirmarla
// antes de mandar el código; una terminal emparejada muestra el estado y sus acciones.
configurarBridge('appDePrueba');

const logout = vi.fn().mockResolvedValue(undefined);
function montar(permisos: string[] = ['usuario.administrar']) {
  const can = (c: string) => permisos.includes(c);
  return render(
    <AuthContext.Provider value={{ can, logout } as any}><ConfigSincronizacion /></AuthContext.Provider>,
  );
}

const standalone = { modo: 'standalone', origin_id: 'C1', hub: null, sync: null, coordinadora: true, series: [] };
const distribuido = {
  modo: 'distribuido', origin_id: 'C2',
  hub: { url: 'https://192.168.0.10:7443', huella: 'AA:BB', nombre: 'Caja 2', emparejado_en: 1 },
  sync: { enLinea: true, ultimoError: null, ultimoPushMs: 1_700_000_000_000, ultimoPullMs: null, pendientes: 3, cursor: 10, desfasajeMs: 90_000, relojDesfasado: true, versionesHub: null },
  coordinadora: false,
  series: [{ serie: 'sku', disponibles: 0 }],
};

afterEach(() => { delete (globalThis as any).appDePrueba; vi.restoreAllMocks(); logout.mockClear(); });

// F2 PR6 (ADR-156 §1): «Usar esta PC como servidor».
describe('ConfigSincronizacion — servidor en esta PC', () => {
  const sinInstalar = { plataforma: 'win32', carpeta: 'C:\\ProgramData\\x-hub', puerto: 7443, instalado: false, enMarcha: false, huella: null, direcciones: ['192.168.0.10'] };
  const enMarcha = { ...sinInstalar, instalado: true, enMarcha: true, huella: 'AA:BB:CC' };

  it('sin la configuración de la app no muestra la sección', async () => {
    (globalThis as any).appDePrueba = { sync: { estado: vi.fn().mockResolvedValue(standalone) } };
    montar();
    await screen.findByLabelText('Dirección del hub');
    expect(screen.queryByRole('region', { name: 'Servidor en esta PC' })).toBeNull();
  });

  it('instala el servidor confirmando antes (pide permiso de administrador y abre el puerto)', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const hubLocal = { estado: vi.fn().mockResolvedValue(sinInstalar), instalar: vi.fn().mockResolvedValue(enMarcha), desinstalar: vi.fn(), codigo: vi.fn() };
    (globalThis as any).appDePrueba = { sync: { estado: vi.fn().mockResolvedValue(standalone) }, hubLocal };
    montar();
    const seccion = await screen.findByRole('region', { name: 'Servidor en esta PC' });
    expect(seccion).toHaveTextContent('No instalado');
    fireEvent.click(screen.getByRole('button', { name: 'Instalar el servidor en esta PC' }));
    expect(confirmar.mock.calls[0]![0]).toMatch(/administrador/);
    expect(await screen.findByText('En marcha')).toBeInTheDocument();
    expect(hubLocal.instalar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Servidor instalado');
  });

  it('en marcha: muestra las direcciones y la huella, y genera un código de emparejamiento', async () => {
    const hubLocal = { estado: vi.fn().mockResolvedValue(enMarcha), instalar: vi.fn(), desinstalar: vi.fn(), codigo: vi.fn().mockResolvedValue({ codigo: 'WXYZ-2345', vence_en: 1_900_000_000 }) };
    (globalThis as any).appDePrueba = { sync: { estado: vi.fn().mockResolvedValue(standalone) }, hubLocal };
    montar();
    const seccion = await screen.findByRole('region', { name: 'Servidor en esta PC' });
    expect(seccion).toHaveTextContent('192.168.0.10');
    expect(seccion).toHaveTextContent('AA:BB:CC');
    fireEvent.click(screen.getByRole('button', { name: 'Generar código de emparejamiento' }));
    expect(await screen.findByTestId('codigo-hub')).toHaveTextContent('WXYZ-2345');
  });
});

describe('ConfigSincronizacion', () => {
  it('sin permiso de administración no muestra nada', () => {
    (globalThis as any).appDePrueba = { sync: { estado: vi.fn() } };
    montar([]);
    expect(screen.getByText('Sin acceso.')).toBeInTheDocument();
  });

  it('emparejar: busca el hub, muestra la huella y no deja seguir sin confirmarla', async () => {
    const sync = {
      estado: vi.fn().mockResolvedValue(standalone),
      sondear: vi.fn().mockResolvedValue({ url: 'https://192.168.0.10:7443', huella: 'AA:BB:CC' }),
      emparejar: vi.fn().mockResolvedValue({ origin_id: 'C1', arranque: 'semilla', filas: 120 }),
    };
    (globalThis as any).appDePrueba = { sync };
    montar();
    fireEvent.change(await screen.findByLabelText('Dirección del hub'), { target: { value: '192.168.0.10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar el hub' }));
    expect(await screen.findByTestId('huella-hub')).toHaveTextContent('AA:BB:CC');
    expect(sync.sondear).toHaveBeenCalledWith({ url: '192.168.0.10' });

    fireEvent.change(screen.getByLabelText('Código de emparejamiento'), { target: { value: 'ABCD-EFGH' } });
    const boton = screen.getByRole('button', { name: 'Emparejar' });
    expect(boton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/la huella coincide/i));
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    expect(await screen.findByRole('status')).toHaveTextContent('Terminal emparejada como C1. Subió su base al hub (120 filas).');
    expect(sync.emparejar).toHaveBeenCalledWith({ url: 'https://192.168.0.10:7443', codigo: 'ABCD-EFGH', huella: 'AA:BB:CC' });
    expect(logout).not.toHaveBeenCalled();
  });

  it('si bajó la base del hub, cierra la sesión (cambiaron los usuarios)', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    (globalThis as any).appDePrueba = { sync: {
      estado: vi.fn().mockResolvedValue(standalone),
      sondear: vi.fn().mockResolvedValue({ url: 'https://hub:7443', huella: 'AA' }),
      emparejar: vi.fn().mockResolvedValue({ origin_id: 'C2', arranque: 'snapshot', filas: 300 }),
    } };
    montar();
    fireEvent.change(await screen.findByLabelText('Dirección del hub'), { target: { value: 'hub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar el hub' }));
    fireEvent.click(await screen.findByLabelText(/la huella coincide/i));
    fireEvent.change(screen.getByLabelText('Código de emparejamiento'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Emparejar' }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('un error del hub se muestra traducido', async () => {
    (globalThis as any).appDePrueba = { sync: {
      estado: vi.fn().mockResolvedValue(standalone),
      sondear: vi.fn().mockRejectedValue(new Error("Error invoking remote method 'sync:sondear': Error: HUB_INALCANZABLE: connect ECONNREFUSED")),
    } };
    montar();
    fireEvent.change(await screen.findByLabelText('Dirección del hub'), { target: { value: 'hub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar el hub' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el hub');
  });

  it('emparejada: muestra el estado, el aviso de reloj y desempareja confirmando los cambios sin subir', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const desemparejar = vi.fn()
      .mockRejectedValueOnce(new Error('CAMBIOS_SIN_SUBIR: 3'))
      .mockResolvedValueOnce(undefined);
    const estado = vi.fn().mockResolvedValueOnce(distribuido).mockResolvedValue(standalone);
    (globalThis as any).appDePrueba = { sync: { estado, desemparejar } };
    montar();
    expect(await screen.findByText('https://192.168.0.10:7443')).toBeInTheDocument();
    expect(screen.getByText('En línea')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('difiere 90 s del hub');
    // F2 PR5: si coordina y cuántos códigos de producto le quedan (sin bloque, no puede dar de alta).
    expect(screen.getByTestId('sync-coordinadora')).toHaveTextContent('No (corre en otra terminal)');
    expect(screen.getByTestId('sync-serie-sku')).toHaveTextContent('0 — esperando un bloque del hub');

    fireEvent.click(screen.getByRole('button', { name: 'Desemparejar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Terminal desemparejada');
    expect(desemparejar.mock.calls).toEqual([[{ forzar: false }], [{ forzar: true }]]);
  });
});
