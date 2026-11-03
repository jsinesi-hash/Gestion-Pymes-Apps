import { useState } from 'react';
import { formatPesos, Modal } from '@core/ui';
import type { ModificadorElegido, ProductoPos } from './tipos';

type Props = {
  producto: ProductoPos;
  onConfirmar: (modificadores: ModificadorElegido[]) => void;
  onCancelar: () => void;
};

export function SelectorSaboresModal({ producto, onConfirmar, onCancelar }: Props) {
  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});

  const toggle = (grupoId: string, max: number, opcionId: string) => {
    setElegidas((prev) => {
      const actual = prev[grupoId] ?? [];
      if (actual.includes(opcionId)) return { ...prev, [grupoId]: actual.filter((id) => id !== opcionId) };
      if (max === 1) return { ...prev, [grupoId]: [opcionId] };
      if (actual.length >= max) return prev;
      return { ...prev, [grupoId]: [...actual, opcionId] };
    });
  };

  const completo = producto.grupos.every((g) => (elegidas[g.grupo_modificador_id] ?? []).length >= g.min);
  const recargos = producto.grupos.reduce((acc, g) => {
    const ids = elegidas[g.grupo_modificador_id] ?? [];
    return acc + g.opciones.filter((o) => ids.includes(o.id)).reduce((s, o) => s + o.recargo_centavos, 0);
  }, 0);

  const confirmar = () => {
    onConfirmar(
      producto.grupos
        .filter((g) => (elegidas[g.grupo_modificador_id] ?? []).length > 0)
        .map((g) => ({ grupo_modificador_id: g.grupo_modificador_id, opcion_ids: elegidas[g.grupo_modificador_id] })),
    );
  };

  return (
    <Modal ariaLabel={producto.nombre} ancho={560} onClose={onCancelar}>
      <div className="modal-header"><span className="modal-title">{producto.nombre}</span></div>
      <div className="modal-body">
        {producto.grupos.map((g) => {
          const ids = elegidas[g.grupo_modificador_id] ?? [];
          const rango = g.min === g.max ? `Elegí ${g.max}` : `Elegí ${g.min} a ${g.max}`;
          return (
            <div key={g.grupo_modificador_id}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {g.nombre} <span style={{ fontWeight: 400, opacity: 0.7 }}>({rango})</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.opciones.map((o) => {
                  const activo = ids.includes(o.id);
                  const bloqueado = !activo && g.max > 1 && ids.length >= g.max;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={activo}
                      disabled={bloqueado}
                      className={activo ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => toggle(g.grupo_modificador_id, g.max, o.id)}
                    >
                      {o.nombre}{o.recargo_centavos > 0 ? ` + ${formatPesos(o.recargo_centavos)}` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="btn-primary" disabled={!completo} onClick={confirmar}>
          Agregar · <span className="num">{formatPesos(producto.precio_centavos + recargos)}</span>
        </button>
      </div>
    </Modal>
  );
}
