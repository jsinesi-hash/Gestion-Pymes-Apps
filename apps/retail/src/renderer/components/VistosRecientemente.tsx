import type { VistoReciente } from '../hooks/useVistosRecientes';

// Widget de "vistos recientemente" (ADR-081 / PERF-2). Chips clickeables que reabren el
// detalle. Filtra por permiso: cada tipo se muestra sólo si el rol puede abrir ese detalle
// (mismo criterio que el sidebar). No renderiza nada si no queda ningún ítem visible.

const PERMISO_POR_TIPO: Record<VistoReciente['tipo'], string> = {
  producto: 'producto.consultar',
  cliente: 'ctacte.cobrar',
};

const ICONO_POR_TIPO: Record<VistoReciente['tipo'], string> = {
  producto: '📦',
  cliente: '👤',
};

export interface VistosRecientementeProps {
  vistos: VistoReciente[];
  can: (codigo: string) => boolean;
  onAbrir: (v: VistoReciente) => void;
  titulo?: string | undefined;
}

export function VistosRecientemente({ vistos, can, onAbrir, titulo = 'Vistos recientemente' }: VistosRecientementeProps) {
  const visibles = vistos.filter((v) => can(PERMISO_POR_TIPO[v.tipo]));
  if (visibles.length === 0) return null;

  return (
    <div className="vistos-recientes">
      <div className="vistos-recientes-titulo">{titulo}</div>
      <div className="vistos-recientes-chips">
        {visibles.map((v) => (
          <button
            key={`${v.tipo}:${v.id}`}
            type="button"
            className="vistos-chip"
            onClick={() => onAbrir(v)}
            title={v.etiqueta}
          >
            <span aria-hidden="true">{ICONO_POR_TIPO[v.tipo]}</span>
            <span className="vistos-chip-label">{v.etiqueta}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
