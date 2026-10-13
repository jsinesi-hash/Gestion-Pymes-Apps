import { useState } from 'react';
import { formatPesos } from '@core/ui';
import type { CategoriaPos, ProductoPos } from './tipos';

type Props = {
  categorias: CategoriaPos[];
  productos: ProductoPos[];
  onElegir: (producto: ProductoPos) => void;
};

export function ProductosGrilla({ categorias, productos, onElegir }: Props) {
  const conProductos = [...categorias]
    .sort((a, b) => a.orden - b.orden)
    .filter((c) => productos.some((p) => p.categoria_venta_id === c.id));
  const [elegida, setElegida] = useState<string | null>(null);

  if (productos.length === 0) {
    return <p>No hay productos cargados. Cargalos en Carta → Productos de venta.</p>;
  }

  const activa = conProductos.find((c) => c.id === elegida)?.id ?? conProductos[0]?.id ?? null;
  const visibles = productos.filter((p) => p.categoria_venta_id === activa);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {conProductos.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === activa}
            className={c.id === activa ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setElegida(c.id)}
          >
            {c.nombre}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {visibles.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label={p.nombre}
            className="btn-secondary"
            style={{ minHeight: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            onClick={() => onElegir(p)}
          >
            <span style={{ fontWeight: 700 }}>{p.nombre}</span>
            <span className="num">{formatPesos(p.precio_centavos)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
