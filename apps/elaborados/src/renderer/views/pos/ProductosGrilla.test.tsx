import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductosGrilla } from './ProductosGrilla';
import type { CategoriaPos, ProductoPos } from './tipos';

const categorias: CategoriaPos[] = [
  { id: 'c1', nombre: 'Helados', orden: 1 },
  { id: 'c2', nombre: 'Bebidas', orden: 2 },
];
const pote: ProductoPos = { id: 'p1', nombre: 'Pote 1/4', categoria_venta_id: 'c1', precio_centavos: 150000, grupos: [] };
const agua: ProductoPos = { id: 'p2', nombre: 'Agua', categoria_venta_id: 'c2', precio_centavos: 50000, grupos: [] };

describe('ProductosGrilla', () => {
  it('muestra categorías y solo los productos de la activa', () => {
    render(<ProductosGrilla categorias={categorias} productos={[pote, agua]} onElegir={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Helados' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bebidas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pote 1/4' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agua' })).not.toBeInTheDocument();
  });

  it('cambiar de categoría cambia la grilla', () => {
    render(<ProductosGrilla categorias={categorias} productos={[pote, agua]} onElegir={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bebidas' }));
    expect(screen.getByRole('button', { name: 'Agua' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pote 1/4' })).not.toBeInTheDocument();
  });

  it('click en un producto llama a onElegir con ese producto', () => {
    const onElegir = vi.fn();
    render(<ProductosGrilla categorias={categorias} productos={[pote, agua]} onElegir={onElegir} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pote 1/4' }));
    expect(onElegir).toHaveBeenCalledWith(pote);
  });

  it('muestra el estado vacío sin productos', () => {
    render(<ProductosGrilla categorias={categorias} productos={[]} onElegir={vi.fn()} />);
    expect(screen.getByText(/No hay productos cargados/)).toBeInTheDocument();
  });
});
