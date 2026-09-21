import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PreciosHub } from './PreciosHub';

it('resalta la pestaña activa según la ruta y renderiza el hijo', () => {
  render(
    <MemoryRouter initialEntries={['/precios/hub/lotes']}>
      <Routes>
        <Route path="/precios/hub" element={<PreciosHub />}>
          <Route path="lotes" element={<div>contenido lotes</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  const lotes = screen.getByRole('link', { name: /Lotes/i });
  expect(lotes.getAttribute('aria-current')).toBe('page'); // NavLink sets aria-current on active
  expect(screen.getByText('contenido lotes')).toBeInTheDocument();
});

it('en el detalle de un lote (lotes/:id) conserva las pestañas y deja Lotes activa', () => {
  render(
    <MemoryRouter initialEntries={['/precios/hub/lotes/b1']}>
      <Routes>
        <Route path="/precios/hub" element={<PreciosHub />}>
          <Route path="lotes" element={<div>listado lotes</div>} />
          <Route path="lotes/:id" element={<div>detalle del lote</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  // las 4 pestañas siguen presentes (no se pierde la estructura)
  ['Listas', 'Lotes', 'Importar', 'Revisión'].forEach(t =>
    expect(screen.getByRole('link', { name: t })).toBeInTheDocument());
  expect(screen.getByRole('link', { name: /Lotes/i }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByText('detalle del lote')).toBeInTheDocument();
});

it('mantiene la pestaña Importar activa en la sub-ruta catalogo-proveedor', () => {
  render(
    <MemoryRouter initialEntries={['/precios/hub/importar/catalogo-proveedor']}>
      <Routes>
        <Route path="/precios/hub" element={<PreciosHub />}>
          <Route path="importar" element={<div>costos</div>} />
          <Route path="importar/catalogo-proveedor" element={<div>catalogo</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: /Importar/i }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByText('catalogo')).toBeInTheDocument();
});
