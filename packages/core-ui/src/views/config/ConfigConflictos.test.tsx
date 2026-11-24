import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AuthContext } from '../../auth/AuthContext';
import { configurarBridge } from '../../bridge';
import { ConfigConflictos } from './ConfigConflictos';

// F3 PR2 (ADR-159): Configuración → Conflictos. El Supervisor ve los conflictos del hub desde cualquier caja,
// compara las dos versiones y resuelve: revisado o «Recuperar» en una edición, descartar una alta repetida.
configurarBridge('appDePrueba');

function montar(permisos: string[] = ['sync.conflictos']) {
  const can = (c: string) => permisos.includes(c);
  return render(<AuthContext.Provider value={{ can } as any}><ConfigConflictos /></AuthContext.Provider>);
}

const distribuido = { modo: 'distribuido', origin_id: 'C2', hub: { url: 'https://hub', huella: 'AA', nombre: 'Caja 2', emparejado_en: 1 }, sync: null, coordinadora: false, series: [] };
const base = { resuelto: 0, resolucion: null, resuelto_por: null, resuelto_en: null, fecha: 1_795_000_000, columnasUnicas: [] as string[] };
const edicion = {
  ...base, id: 7, tipo: 'lww', tabla: 'producto', fila_id: 'p1', origin_id: 'C1', detalle: null,
  fila_entrante: { id: 'p1', nombre_corto: 'Pinza de A', precio_venta_lista_centavos: 90000, version: 3, fecha_actualizacion: 100, usuario_modificacion_id: 'u1' },
  fila_actual: { id: 'p1', nombre_corto: 'Pinza de B', precio_venta_lista_centavos: 90000, version: 3, fecha_actualizacion: 200, usuario_modificacion_id: 'u2' },
  perdida: 'entrante', recuperable: true,
};
const alta = {
  ...base, id: 8, tipo: 'unicidad', tabla: 'marca', fila_id: 'm2', origin_id: 'C2', detalle: 'UNIQUE constraint failed: marca.nombre',
  fila_entrante: { id: 'm2', nombre: 'Bosch' }, fila_actual: null, perdida: null, recuperable: false, columnasUnicas: ['nombre'],
};

function bridgeCon(conflictos: unknown[], extra: Record<string, unknown> = {}) {
  const sync = {
    estado: vi.fn().mockResolvedValue(distribuido),
    conflictos: vi.fn().mockResolvedValue({ conflictos, hayMas: false, enEspera: 0 }),
    resolverConflicto: vi.fn().mockResolvedValue({ ...edicion, resuelto: 1, resolucion: 'recuperado' }),
    descartarAlta: vi.fn().mockResolvedValue(undefined),
    ...extra,
  };
  (globalThis as any).appDePrueba = { sync };
  return sync;
}

afterEach(() => { delete (globalThis as any).appDePrueba; vi.restoreAllMocks(); });

describe('ConfigConflictos', () => {
  it('sin el permiso no muestra nada ni consulta al hub', () => {
    const sync = bridgeCon([edicion]);
    montar([]);
    expect(screen.getByText('Sin acceso.')).toBeInTheDocument();
    expect(sync.conflictos).not.toHaveBeenCalled();
  });

  it('una caja que no está emparejada lo explica', async () => {
    bridgeCon([], { estado: vi.fn().mockResolvedValue({ ...distribuido, modo: 'standalone', hub: null }) });
    montar();
    expect(await screen.findByText(/no está emparejada/)).toBeInTheDocument();
  });

  it('lista los pendientes en lenguaje del negocio, con la caja de origen', async () => {
    const sync = bridgeCon([edicion, alta]);
    montar();
    const tabla = await screen.findByRole('table', { name: 'Conflictos' });
    expect(within(tabla).getByText('Edición simultánea')).toBeInTheDocument();
    expect(within(tabla).getByText('Alta repetida')).toBeInTheDocument();
    expect(within(tabla).getByText('Producto: Pinza de A')).toBeInTheDocument();
    expect(within(tabla).getByText('Marca: Bosch')).toBeInTheDocument();
    expect(sync.conflictos).toHaveBeenCalledWith({ pendientes: true });
  });

  it('el detalle de una edición muestra las dos versiones y resalta lo que cambia; «Recuperar» pide confirmar', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const sync = bridgeCon([edicion]);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Producto: Pinza de A' }));
    const detalle = screen.getByRole('region', { name: 'Detalle del conflicto' });
    const fila = within(detalle).getByRole('row', { name: /nombre_corto/ });
    expect(fila).toHaveTextContent('Pinza de B');
    expect(fila).toHaveTextContent('Pinza de A');
    expect(fila).toHaveAttribute('data-distinto', 'true');
    // Lo que no cambió, los campos de sync y la auditoría (cambia en cada edición) no se listan.
    expect(within(detalle).queryByRole('row', { name: /precio_venta_lista_centavos/ })).toBeNull();
    expect(within(detalle).queryByRole('row', { name: /version/ })).toBeNull();
    expect(within(detalle).queryByRole('row', { name: /fecha_actualizacion/ })).toBeNull();
    expect(within(detalle).queryByRole('row', { name: /usuario_modificacion_id/ })).toBeNull();

    fireEvent.click(within(detalle).getByRole('button', { name: 'Recuperar esta versión' }));
    expect(confirmar).toHaveBeenCalled();
    expect(sync.resolverConflicto).toHaveBeenCalledWith({ id: 7, resolucion: 'recuperado' });
    expect(await screen.findByRole('status')).toHaveTextContent(/Recuperada/);
  });

  it('marcar como revisado no escribe nada en la caja', async () => {
    const sync = bridgeCon([{ ...edicion, recuperable: false }]);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Producto: Pinza de A' }));
    const detalle = screen.getByRole('region', { name: 'Detalle del conflicto' });
    expect(within(detalle).queryByRole('button', { name: 'Recuperar esta versión' })).toBeNull();
    fireEvent.click(within(detalle).getByRole('button', { name: 'Marcar como revisado' }));
    expect(sync.resolverConflicto).toHaveBeenCalledWith({ id: 7, resolucion: 'revisado' });
  });

  it('una alta repetida de esta caja se puede descartar; la de otra caja dice dónde corregirla', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const sync = bridgeCon([alta, { ...alta, id: 9, fila_id: 'm3', origin_id: 'C1', fila_entrante: { id: 'm3', nombre: 'Makita' } }]);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Marca: Bosch' }));
    let detalle = screen.getByRole('region', { name: 'Detalle del conflicto' });
    expect(detalle).toHaveTextContent(/nombre/);
    fireEvent.click(within(detalle).getByRole('button', { name: 'Descartar esta alta' }));
    expect(sync.descartarAlta).toHaveBeenCalledWith({ id: 8 });
    expect(await screen.findByRole('status')).toHaveTextContent(/Descartada/);

    fireEvent.click(screen.getByRole('button', { name: 'Ver Marca: Makita' }));
    detalle = screen.getByRole('region', { name: 'Detalle del conflicto' });
    expect(within(detalle).queryByRole('button', { name: 'Descartar esta alta' })).toBeNull();
    expect(detalle).toHaveTextContent(/caja C1/);
  });

  it('avisa los cambios que esperan una alta repetida', async () => {
    bridgeCon([], { conflictos: vi.fn().mockResolvedValue({ conflictos: [], hayMas: false, enEspera: 3 }) });
    montar();
    expect(await screen.findByText(/3 cambios esperan/)).toBeInTheDocument();
  });

  it('sin conexión con el hub no muestra datos viejos', async () => {
    bridgeCon([], { conflictos: vi.fn().mockRejectedValue(new Error('HUB_INALCANZABLE')) });
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo conectar con el hub/);
    expect(screen.queryByRole('table', { name: 'Conflictos' })).toBeNull();
  });
});
