import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CatalogoProvider, useCatalogoContext } from './CatalogoContext';

function TestConsumer() {
  const { busqueda, setBusqueda, pagina, setPagina, filtros, setFiltros } =
    useCatalogoContext();
  return (
    <div>
      <span data-testid="busqueda">{busqueda}</span>
      <span data-testid="pagina">{pagina}</span>
      <span data-testid="categoria">{filtros.categoria_id ?? 'none'}</span>
      <button onClick={() => setBusqueda('sierra')}>buscar</button>
      <button onClick={() => setPagina(3)}>p3</button>
      <button onClick={() => setFiltros({ categoria_id: 'cat1' })}>filtrar</button>
    </div>
  );
}

describe('CatalogoContext', () => {
  it('estado inicial: busqueda vacia, pagina 1, sin filtros', () => {
    render(
      <CatalogoProvider>
        <TestConsumer />
      </CatalogoProvider>
    );
    expect(screen.getByTestId('busqueda').textContent).toBe('');
    expect(screen.getByTestId('pagina').textContent).toBe('1');
    expect(screen.getByTestId('categoria').textContent).toBe('none');
  });

  it('setBusqueda actualiza busqueda', async () => {
    render(
      <CatalogoProvider>
        <TestConsumer />
      </CatalogoProvider>
    );
    await act(async () => {
      screen.getByText('buscar').click();
    });
    expect(screen.getByTestId('busqueda').textContent).toBe('sierra');
  });

  it('setPagina actualiza pagina', async () => {
    render(
      <CatalogoProvider>
        <TestConsumer />
      </CatalogoProvider>
    );
    await act(async () => {
      screen.getByText('p3').click();
    });
    expect(screen.getByTestId('pagina').textContent).toBe('3');
  });

  it('setFiltros fusiona filtros parciales', async () => {
    render(
      <CatalogoProvider>
        <TestConsumer />
      </CatalogoProvider>
    );
    await act(async () => {
      screen.getByText('filtrar').click();
    });
    expect(screen.getByTestId('categoria').textContent).toBe('cat1');
  });
});
