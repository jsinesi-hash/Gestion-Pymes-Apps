import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { bridge } from '../bridge';

type Provincia = { id: string; nombre: string };
type Localidad = { id: string; nombre: string; codigoPostal: string | null };

export type DireccionGeoValue = {
  localidad_id: string;
  localidad: string;
  provincia: string;
  codigo_postal: string;
};

type Props = {
  value: DireccionGeoValue;
  onChange: (v: DireccionGeoValue) => void;
};

type DropdownPos = { top: number; left: number; width: number };

export function DireccionGeo({ value, onChange }: Readonly<Props>) {
  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [query, setQuery] = useState(value.localidad);
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    bridge().geo.provincias().then(setProvincias);
  }, []);

  const provinciaId = provincias.find((p) => p.nombre === value.provincia)?.id ?? '';

  useEffect(() => {
    if (!provinciaId) { setLocalidades([]); return; }
    bridge().geo.localidades(provinciaId, '').then(setLocalidades);
  }, [provinciaId]);

  const filtered = query.trim()
    ? localidades.filter((l) => l.nombre.toLowerCase().includes(query.toLowerCase())).slice(0, 50)
    : localidades.slice(0, 50);

  function openDropdown() {
    if (!value.provincia) return;
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownPos({ top: rect.bottom + globalThis.scrollY, left: rect.left + globalThis.scrollX, width: rect.width });
    }
    setOpen(true);
  }

  function selectProvincia(nombre: string) {
    onChange({ localidad_id: '', localidad: '', provincia: nombre, codigo_postal: '' });
    setQuery('');
    setOpen(false);
  }

  function selectLocalidad(loc: Localidad) {
    const cp = loc.codigoPostal ?? '';
    onChange({ localidad_id: loc.id, localidad: loc.nombre, provincia: value.provincia, codigo_postal: cp });
    setQuery(loc.nombre);
    setOpen(false);
  }

  function handleQueryChange(q: string) {
    setQuery(q);
    onChange({ ...value, localidad_id: '', localidad: q, codigo_postal: '' });
    openDropdown();
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const dropdown = open && filtered.length > 0 && dropdownPos
    ? createPortal(
        <ul
          ref={listRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            maxHeight: 220,
            overflowY: 'auto',
            margin: 0,
            padding: 0,
            listStyle: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          {filtered.map((l) => (
            <li
              key={l.id}
              onMouseDown={() => selectLocalidad(l)}
              style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: 14 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              <span>{l.nombre}</span>
              {l.codigoPostal && (
                <span style={{ opacity: 0.5, fontSize: 12, fontFamily: 'monospace' }}>{l.codigoPostal}</span>
              )}
            </li>
          ))}
        </ul>,
        document.body,
      )
    : null;

  return (
    <div className="flex-col gap-3">
      <div className="form-row">
        <label className="form-label">
          Provincia
          {' '}
          <select className="input" value={value.provincia} onChange={(e) => selectProvincia(e.target.value)}>
            <option value="">— Seleccioná una provincia —</option>
            {provincias.map((p) => (
              <option key={p.id} value={p.nombre}>{p.nombre}</option>
            ))}
          </select>
        </label>

        <label className="form-label" style={{ position: 'relative' }}>
          Localidad
          {' '}
          <input
            ref={inputRef}
            className="input"
            value={query}
            disabled={!value.provincia}
            placeholder={value.provincia ? 'Escribí para filtrar...' : 'Seleccioná provincia primero'}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={openDropdown}
          />
          {dropdown}
        </label>

        <label className="form-label" style={{ maxWidth: 120 }}>
          Cód. postal
          {' '}
          <input
            className="input"
            value={value.codigo_postal}
            onChange={(e) => onChange({ ...value, codigo_postal: e.target.value })}
            placeholder="1000"
            maxLength={8}
          />
        </label>
      </div>
    </div>
  );
}
