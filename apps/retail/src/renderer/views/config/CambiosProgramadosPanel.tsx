import { useState, useEffect } from 'react';
import { useCallIpc, useToast } from '@core/ui';

const f = () => (globalThis as any).ferreteria;

type Props = { listaId: string };

export function CambiosProgramadosPanel({ listaId }: Readonly<Props>) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callIpc = useCallIpc();
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      const data = await f().precios.cambioProgramado.listar(listaId);
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [listaId]);

  async function handleCancelar(id: string) {
    // Optimistic update: mark locally as cancelado immediately
    setRows(prev => prev.map(r => r.id === id ? { ...r, estado: 'cancelado' } : r));
    setError(null);
    // ADR-085 (SEC-2): no se le pasa `success` a callIpc — el handler puede resolver con
    // { cancelado: false } en la carrera del compare-and-swap (el scheduler ya lo aplicó),
    // y ese caso NO es un éxito aunque la promesa no haya rechazado. El toast de éxito se
    // dispara a mano, sólo cuando `cancelado` es realmente true.
    const r = await callIpc<{ cancelado: boolean }>(
      () => f().precios.cambioProgramado.cancelar(id),
    );
    if (!r.ok) {
      // Error de validación u otro — revertir el optimista y mostrar el error general.
      await load();
      setError(r.traducido.mensaje);
      return;
    }
    if (!r.data.cancelado) {
      // Race condition: scheduler already applied it — revert and show error
      await load();
      setError('El cambio ya fue aplicado — no se pudo cancelar');
      return;
    }
    toast.success('Cambio cancelado');
    // Success: keep optimistic state; optionally do background refetch
  }

  if (loading && rows.length === 0) return <div style={{ padding: 'var(--pad)', opacity: 0.5 }}>Cargando...</div>;

  return (
    <div>
      {error && (
        <div className="alert-danger" style={{ margin: '0 0 8px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      {rows.length === 0 ? (
        <div style={{ padding: 'var(--pad)', opacity: 0.5, fontSize: 13 }}>Sin cambios programados para esta lista</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha aplicación</th>
              <th>Base</th>
              <th className="r">%</th>
              <th>Alcance</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.id}>
                <td>{new Date(row.fecha_aplicacion).toLocaleString('es-AR')}</td>
                <td>{row.base_calculo}</td>
                <td className="r num">{row.porcentaje > 0 ? '+' : ''}{row.porcentaje}%</td>
                <td>{row.alcance}{row.alcance_id ? ` (${row.alcance_id.slice(0, 8)}...)` : ''}</td>
                <td>
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3,
                    background: row.estado === 'pendiente' ? 'var(--color-warning, #f59e0b)' : row.estado === 'aplicado' ? 'var(--color-success, #10b981)' : '#6b7280',
                    color: '#fff' }}>
                    {row.estado}
                  </span>
                </td>
                <td>
                  {row.estado === 'pendiente' && (
                    <button className="btn-danger-sm" style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => handleCancelar(row.id)}>
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
