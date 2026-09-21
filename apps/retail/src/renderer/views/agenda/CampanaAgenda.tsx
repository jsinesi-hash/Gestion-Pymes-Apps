import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgendaBadge, useAgendaHabilitado } from '../../hooks/useAgenda';

const SVG_CAMPANA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

export function CampanaAgenda() {
  const habilitado = useAgendaHabilitado();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const badge = useAgendaBadge(habilitado);

  if (!habilitado) return null;

  const total = badge.atrasadas + badge.avisos_fallidos;

  return (
    <div style={{ position: 'relative' }}>
      <button className="icon-btn" title="Agenda" aria-label="Agenda" onClick={() => setAbierto((v) => !v)}>
        {SVG_CAMPANA}
        {total > 0 && (
          <span aria-label={`${total} pendientes`} style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>{total > 99 ? '99+' : total}</span>
        )}
      </button>

      {abierto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setAbierto(false)} />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 41, width: 240,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.18)', overflow: 'hidden',
          }} role="menu">
            <button type="button" className="dropdown-item" style={dropStyle}
              onClick={() => { setAbierto(false); navigate('/agenda'); }}>
              <span>Eventos atrasados</span>
              <span className="badge" style={{ color: badge.atrasadas ? 'var(--danger)' : 'var(--ink-3)' }}>{badge.atrasadas}</span>
            </button>
            <button type="button" className="dropdown-item" style={dropStyle}
              onClick={() => { setAbierto(false); navigate('/agenda/avisos'); }}>
              <span>Avisos fallidos</span>
              <span className="badge" style={{ color: badge.avisos_fallidos ? 'var(--danger)' : 'var(--ink-3)' }}>{badge.avisos_fallidos}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const dropStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
  padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 13, color: 'var(--ink-1)', borderBottom: '1px solid var(--border)',
};
