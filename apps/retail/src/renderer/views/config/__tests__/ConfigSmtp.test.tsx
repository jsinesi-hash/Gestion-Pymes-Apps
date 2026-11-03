import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ConfigSmtp, AuthContext } from '@core/ui';

// ConfigSmtp vive en @core/ui (ADR-142) y lee la sesión del contexto: se le da un Supervisor con permiso.
const sesionSupervisor = { session: null, can: () => true, login: async () => {}, logout: async () => {}, actualizarPreferencias: () => {} };
function renderSmtp() {
  return render(<AuthContext.Provider value={sesionSupervisor}><ConfigSmtp /></AuthContext.Provider>);
}


const getConfig = vi.fn();
const setConfig = vi.fn().mockResolvedValue(undefined);
const setPassword = vi.fn().mockResolvedValue(undefined);
const probar = vi.fn();
const paramGet = vi.fn();
const paramSet = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  getConfig.mockResolvedValue({ host: 'smtp.x', port: 587, secure: false, from: 'a@x', user: 'u', tiene_password: true });
  probar.mockResolvedValue({ ok: true });
  paramGet.mockResolvedValue('false');
  (globalThis as any).ferreteria = {
    smtp: { getConfig, setConfig, setPassword, probar },
    parametros: { get: paramGet, set: paramSet },
  };
  // Por defecto se confirma: varios tests usan un usuario que no tiene forma de email.
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  getConfig.mockClear(); setConfig.mockClear(); setPassword.mockClear(); probar.mockClear();
  paramGet.mockClear(); paramSet.mockClear();
});

describe('ConfigSmtp', () => {
  it('carga la config y muestra que hay contraseña guardada', async () => {
    renderSmtp();
    await waitFor(() => expect(getConfig).toHaveBeenCalled());
    expect(await screen.findByDisplayValue('smtp.x')).toBeInTheDocument();
    expect(screen.getByText(/guardada/i)).toBeInTheDocument();
  });

  it('probar conexión muestra el resultado', async () => {
    renderSmtp();
    await waitFor(() => expect(getConfig).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /probar/i }));
    await waitFor(() => expect(probar).toHaveBeenCalled());
    expect(await screen.findByText(/conexión ok/i)).toBeInTheDocument();
  });

  it('probar conexión muestra el error cuando la IPC rechaza (antes fallaba en silencio)', async () => {
    probar.mockRejectedValue(new Error('ECONNREFUSED'));
    renderSmtp();
    await waitFor(() => expect(getConfig).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /probar/i }));

    expect(await screen.findByText('ECONNREFUSED')).toBeInTheDocument();
    // el botón vuelve a decir "Probar conexión", no queda colgado en "Probando..."
    expect(screen.getByRole('button', { name: /^probar conexión$/i })).toBeEnabled();
  });

  it('guardar llama a setConfig con los valores del form', async () => {
    renderSmtp();
    await screen.findByDisplayValue('smtp.x');
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(setConfig).toHaveBeenCalled());
    expect(setConfig.mock.calls[0][0]).toMatchObject({ host: 'smtp.x', port: 587, from: 'a@x', user: 'u' });
  });

  // --- Endurecimiento: el campo Usuario guarda en texto plano, la Contraseña en safeStorage.
  // Una contraseña tipeada por error en Usuario queda sin cifrar (paso en la practica).

  it('avisa cuando el Usuario no tiene forma de dirección de correo', async () => {
    getConfig.mockResolvedValue({ host: 'smtp.gmail.com', port: 587, secure: false, from: 'a@x.com', user: 'Secreta123@@', tiene_password: true });
    renderSmtp();
    await screen.findByDisplayValue('Secreta123@@');
    expect(screen.getByText(/no parece una dirección/i)).toBeInTheDocument();
  });

  it('no avisa cuando el Usuario es una dirección válida', async () => {
    getConfig.mockResolvedValue({ host: 'smtp.gmail.com', port: 587, secure: false, from: 'a@x.com', user: 'a@gmail.com', tiene_password: true });
    renderSmtp();
    await screen.findByDisplayValue('a@gmail.com');
    expect(screen.queryByText(/no parece una dirección/i)).not.toBeInTheDocument();
  });

  it('si se cancela la confirmación, no guarda nada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    getConfig.mockResolvedValue({ host: 'smtp.gmail.com', port: 587, secure: false, from: 'a@x.com', user: 'Secreta123@@', tiene_password: true });
    renderSmtp();
    await screen.findByDisplayValue('Secreta123@@');
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('avisa si el puerto 465 se usa sin conexión segura', async () => {
    getConfig.mockResolvedValue({ host: 'smtp.gmail.com', port: 465, secure: false, from: 'a@x.com', user: 'a@gmail.com', tiene_password: true });
    renderSmtp();
    await screen.findByDisplayValue('465');
    expect(screen.getByText(/TLS directa: marcá/i)).toBeInTheDocument();
  });

  it('avisa si el puerto 587 se usa con conexión segura tildada', async () => {
    getConfig.mockResolvedValue({ host: 'smtp.gmail.com', port: 587, secure: true, from: 'a@x.com', user: 'a@gmail.com', tiene_password: true });
    renderSmtp();
    await screen.findByDisplayValue('587');
    expect(screen.getByText(/usa STARTTLS: destildá/i)).toBeInTheDocument();
  });

  // --- Flag notif_cierre_caja_email: sin este toggle no habia forma de encender el canal
  // email desde la app (parametros_sistema no tiene pantalla propia).

  it('refleja el estado del aviso de cierre por email', async () => {
    paramGet.mockResolvedValue('true');
    renderSmtp();
    await screen.findByDisplayValue('smtp.x');
    await waitFor(() => expect(paramGet).toHaveBeenCalledWith({ clave: 'notif_cierre_caja_email' }));
    expect(screen.getByLabelText(/avisar los cierres de caja por email/i)).toBeChecked();
  });

  it('guardar persiste el flag de aviso de cierre', async () => {
    paramGet.mockResolvedValue('false');
    renderSmtp();
    await screen.findByDisplayValue('smtp.x');
    fireEvent.click(screen.getByLabelText(/avisar los cierres de caja por email/i));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(paramSet).toHaveBeenCalledWith({ clave: 'notif_cierre_caja_email', valor: 'true' }));
  });

  it('muestra la ayuda sobre contraseñas de aplicación', async () => {
    renderSmtp();
    await screen.findByDisplayValue('smtp.x');
    expect(screen.getByText(/contraseña de aplicación/i)).toBeInTheDocument();
  });
});
