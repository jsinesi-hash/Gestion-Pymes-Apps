import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthContext, AppProfileProvider, AppShell } from '@core/ui';
import { crearNavegacion } from '@ferreteria/shared';

// Task B4: AppShell es genérico y no conoce nada de Retail. Se lo monta con un NAV, crumbs,
// comandos y buscadores INVENTADOS y se verifica que renderiza sólo eso y respeta permisos.
const nav = [
  { key: 'g1', label: 'Grupo Uno', icon: <span />, items: [
    { label: 'Pantalla A', to: '/a', icon: <span /> },
    { label: 'Pantalla B', to: '/b', icon: <span />, permiso: 'secreto' },
  ]},
];
// El baseLabel del crumb es distinto del label del nav a propósito: así "Pantalla A" existe
// una sola vez en el DOM (en el sidebar) y las aserciones no chocan con el breadcrumb.
const crumbs = [{ grupo: 'Grupo Uno', base: '/a', baseLabel: 'Lista A' }];

beforeEach(() => {
  (globalThis as any).ferreteria = {};
});
afterEach(() => {
  delete (globalThis as any).ferreteria;
});

function montar(permisos: string[]) {
  const session = { id: 'u', nombreCompleto: 'U', rolId: 'r', rolNombre: 'OPERADOR', permisos,
    preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable',
      skin: 'actual', pantalla_inicio: null, favoritos: [] } } as any;
  const router = createMemoryRouter([{ path: '/', element:
    <AppShell nombreApp="App X" nav={nav as any} crumbs={crumbs} comandos={{ accion: [], nav: [] }} buscadores={[]} />,
    children: [{ path: 'a', element: <div>contenido A</div> }] }], { initialEntries: ['/a'] });
  return render(
    <AppProfileProvider value={{ nombreApp: 'App X', navegacion: crearNavegacion({ rutas: [], inicioPorRol: {}, inicioFallback: '/a' }) }}>
      <AuthContext.Provider value={{ session, can: (c: string) => permisos.includes(c), login: async () => {}, logout: async () => {}, actualizarPreferencias: () => {} }}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </AppProfileProvider>);
}

describe('AppShell (props)', () => {
  it('muestra el nombre de la app, el NAV inyectado y el breadcrumb inyectado', () => {
    montar([]);
    expect(screen.getByText('App X')).toBeInTheDocument();
    expect(screen.getByText('Pantalla A')).toBeInTheDocument();
    expect(screen.queryByText('Pantalla B')).not.toBeInTheDocument(); // sin permiso 'secreto'
    expect(screen.getByLabelText('Ruta de navegación')).toHaveTextContent('Grupo Uno');
    expect(screen.queryByText('Productos')).not.toBeInTheDocument(); // nada de Retail
  });
  it('con permiso muestra el ítem restringido', () => {
    montar(['secreto']);
    expect(screen.getByText('Pantalla B')).toBeInTheDocument();
  });
});
