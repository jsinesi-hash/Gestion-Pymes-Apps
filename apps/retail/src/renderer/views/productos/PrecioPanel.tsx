import { useState } from 'react';
import { useListasPrecios } from '../../hooks/useListasPrecios';
import { useListaPrecioValor } from '../../hooks/useListaPrecioValor';
import { useAuth } from '@core/ui';

type Props = {
  productoId: string;
  precioVentaLista: number;
};

export function PrecioPanel({ productoId, precioVentaLista }: Readonly<Props>) {
  const { listas, loading: loadingListas } = useListasPrecios();
  const { vigentes, loading: loadingVigentes, refetch } = useListaPrecioValor(productoId);
  const { can } = useAuth();
  const isSupervisor = can('config.fiscal');

  const [editingListaId, setEditingListaId] = useState<string | null>(null);
  const [editingValor, setEditingValor] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  function getVigente(listaId: string) {
    return vigentes.find((v: any) => v.lista_id === listaId) ?? null;
  }

  function getFallbackCentavos(lista: any): number {
    return Math.round(Math.round(precioVentaLista * 100) * (1 + lista.ajuste_porcentual / 100));
  }

  async function handleConfirmarManual(listaId: string) {
    const precioPesos = Number.parseFloat(editingValor);
    if (Number.isNaN(precioPesos) || precioPesos <= 0) return;
    setEditingListaId(null);
    try {
      await (globalThis as any).ferreteria.precios.valor.setManual({
        listaId, productoId, precioCentavos: Math.round(precioPesos * 100),
      });
      await refetch();
    } catch (e: any) {
      setToast(e?.message ?? 'Error al guardar');
      await refetch();
    }
  }

  if (loadingListas || loadingVigentes) return null;

  return (
    <div className="card">
      <div className="card-title">Precios por lista</div>

      {toast && (
        <div className="alert-danger" style={{ margin: '0 var(--pad) 10px' }}>
          {toast}
          <button onClick={() => setToast(null)} style={{ marginLeft: '8px', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lista</th>
              <th className="r">Precio vigente</th>
              <th>Desde</th>
              <th>Origen</th>
              {isSupervisor && <th />}
            </tr>
          </thead>
          <tbody>
            {listas.map((lista: any) => {
              const vigente = getVigente(lista.id);
              const isEditing = editingListaId === lista.id;

              let priceCellContent: React.ReactNode;
              let metaCellContent: React.ReactNode = null;
              let origenCellContent: React.ReactNode = null;

              if (vigente) {
                if (vigente.precio_promocion_centavos != null) {
                  // Active promo
                  priceCellContent = (
                    <span>
                      <span className="num" style={{ color: 'var(--color-success, #10b981)', fontWeight: 700 }}>
                        ${(vigente.precio_promocion_centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>{' '}
                      <span className="num" style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: 12 }}>
                        ${(vigente.precio_centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </span>
                  );
                  metaCellContent = vigente.promo_hasta
                    ? <span className="text-muted" style={{ fontSize: 12 }}>En promo hasta {new Date(vigente.promo_hasta).toLocaleDateString('es-AR')}</span>
                    : <span className="text-muted" style={{ fontSize: 12 }}>En promo</span>;
                } else {
                  // Normal vigente
                  priceCellContent = (
                    <span className="num" data-testid={`precio-${lista.id}`}>
                      ${(vigente.precio_centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  );
                  metaCellContent = vigente.fecha_desde
                    ? <span className="text-muted" style={{ fontSize: 12 }}>{new Date(vigente.fecha_desde).toLocaleDateString('es-AR')}</span>
                    : null;
                }
                origenCellContent = <span className="text-muted" style={{ fontSize: 12 }}>{vigente.origen}</span>;
              } else {
                // Fallback calculated price
                const fallbackCentavos = getFallbackCentavos(lista);
                priceCellContent = (
                  <span>
                    <span className="num" data-testid={`precio-${lista.id}`}>
                      ${(fallbackCentavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>{' '}
                    <span style={{ fontSize: 11, padding: '2px 5px', borderRadius: 3, background: 'var(--color-warning-bg, #fef3c7)', color: 'var(--color-warning-text, #92400e)', fontWeight: 600 }}>
                      Sin confirmar — calculado por fallback
                    </span>
                  </span>
                );
                metaCellContent = null;
                origenCellContent = null;
              }

              return (
                <tr key={lista.id}>
                  <td className="p-name">{lista.nombre}</td>
                  <td className="r">
                    {isEditing ? (
                      <div className="flex gap-2 items-center" style={{ justifyContent: 'flex-end' }}>
                        <input
                          className="input num"
                          type="number"
                          value={editingValor}
                          onChange={e => setEditingValor(e.target.value)}
                          style={{ width: '90px', padding: '5px 8px' }}
                          autoFocus
                          placeholder="Precio $"
                        />
                        <button className="btn-primary" style={{ padding: '5px 10px', fontSize: '12px' }}
                          aria-label="confirmar" onClick={() => handleConfirmarManual(lista.id)}>
                          Confirmar
                        </button>
                        <button className="btn-secondary" style={{ padding: '5px 8px', fontSize: '12px' }}
                          onClick={() => setEditingListaId(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : priceCellContent}
                  </td>
                  <td>{metaCellContent}</td>
                  <td>{origenCellContent}</td>
                  {isSupervisor && (
                    <td>
                      {!isEditing && (
                        <div className="row-act">
                          <button className="ia" aria-label="editar"
                            onClick={() => {
                              const v = getVigente(lista.id);
                              const precioCentavos = v ? v.precio_centavos : getFallbackCentavos(lista);
                              setEditingListaId(lista.id);
                              setEditingValor(String((precioCentavos / 100).toFixed(2)));
                            }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {listas.length === 0 && (
              <tr>
                <td colSpan={isSupervisor ? 5 : 4} style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.4, fontSize: '13px' }}>
                  Sin listas de precios activas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
