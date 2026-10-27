import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthContext, AppProfileProvider, AppShell } from '@core/ui';
import { crearNavegacion } from '@ferreteria/shared';
import { routes as routesRetail } from '../../routes';

// Revisión 2026-10-20 (P1): una excepción de render en una pantalla dejaba la ventana en blanco.
// AppShell contiene el error en el área de contenido y conserva el menú; al navegar a otra
// pantalla el aviso se descarta solo.
const nav = [
  { key: 'g1', label: 'Grupo Uno', icon: <span />, items: [
    { label: 'Pantalla A', to: '/a', icon: <span /> },
    { label: 'Pantalla B', to: '/b', icon: <span /> },
  ]},
];
const crumbs = [{ grupo: 'Grupo Uno', base: '/a', baseLabel: 'Lista A' }, { grupo: 'Grupo Uno', base: '/b', baseLabel: 'Lista B' }];

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  (globalThis as any).ferreteria = {};
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete (globalThis as any).ferreteria;
  consoleError.mockRestore();
});

function Rota(): JSX.Element { throw new Error('pantalla A rota'); }

function montar() {
  const session = { id: 'u', nombreCompleto: 'U', rolId: 'r', rolNombre: 'OPERADOR', permisos: [],
    preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable',
      skin: 'actual', pantalla_inicio: null, favoritos: [] } } as any;
  const router = createMemoryRouter([{ path: '/', element:
    <AppShell nombreApp="App X" nav={nav as any} crumbs={crumbs} comandos={{ accion: [], nav: [] }} buscadores={[]} />,
    children: [
      { path: 'a', element: <Rota /> },
      { path: 'b', element: <div>contenido B</div> },
    ] }], { initialEntries: ['/a'] });
  return render(
    <AppProfileProvider value={{ nombreApp: 'App X', navegacion: crearNavegacion({ rutas: [], inicioPorRol: {}, inicioFallback: '/b' }) }}>
      <AuthContext.Provider value={{ session, can: () => true, login: async () => {}, logout: async () => {}, actualizarPreferencias: () => {} }}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </AppProfileProvider>);
}

describe('AppShell — error de una pantalla', () => {
  it('muestra el aviso en el área de contenido y conserva el menú', () => {
    montar();
    expect(screen.getByRole('alert')).toHaveTextContent(/Algo salió mal en esta pantalla/);
    expect(screen.getByText('App X')).toBeInTheDocument();
    expect(screen.getByText('Pantalla A')).toBeInTheDocument();
    expect(screen.getByText('Pantalla B')).toBeInTheDocument();
  });

  it('al navegar a otra pantalla el aviso desaparece', () => {
    montar();
    fireEvent.click(screen.getByText('Pantalla B'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('contenido B')).toBeInTheDocument();
  });
});

describe('árbol de rutas de Retail', () => {
  it('la ruta raíz declara un errorElement (un error del shell no muestra la pantalla por defecto de react-router)', () => {
    const raiz = routesRetail.find((r) => r.path === '/');
    expect(raiz?.errorElement).toBeDefined();
  });
});
