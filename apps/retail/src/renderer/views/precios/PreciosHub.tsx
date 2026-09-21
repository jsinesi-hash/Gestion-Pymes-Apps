import type { CSSProperties } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/precios/hub/listas', label: 'Listas' },
  { to: '/precios/hub/lotes', label: 'Lotes' },
  { to: '/precios/hub/importar', label: 'Importar' },
  { to: '/precios/hub/revision', label: 'Revisión' },
];

function tabStyle(isActive: boolean): CSSProperties {
  return {
    padding: '0.4rem 1rem',
    borderRadius: '6px 6px 0 0',
    borderBottom: isActive ? '2px solid var(--accent-strong)' : '2px solid transparent',
    background: 'transparent',
    color: isActive ? 'var(--accent-strong)' : 'inherit',
    textDecoration: 'none',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: isActive ? 600 : 400,
    marginBottom: -1,
    position: 'relative',
    zIndex: isActive ? 1 : 0,
  };
}

export function PreciosHub() {
  // El hub debe propagar la altura hasta el tab activo. Las vistas internas (Importar,
  // Revisión) usan `height:100%` + paneles `flex:1` para que su tabla scrollee ADENTRO,
  // dejando la barra horizontal a la vista. Sin esta cadena, el `<Outlet>` quedaba con
  // altura automática y la tabla crecía a la altura de TODAS las filas: la barra
  // horizontal terminaba hundida al pie de la lista (imposible de alcanzar en listas
  // grandes). Los tabs de flujo natural (Listas, Lotes) siguen desbordando y scrolleando
  // vía `.main-content`, igual que antes.
  return (
    <div className="flex-col gap-4" style={{ height: '100%', minHeight: 0 }}>
      <h2 style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-.02em', flexShrink: 0 }}>Precios y Costos</h2>
      <nav
        aria-label="Precios y Costos"
        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', flexShrink: 0 }}
      >
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} style={({ isActive }) => tabStyle(isActive)}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
    </div>
  );
}
