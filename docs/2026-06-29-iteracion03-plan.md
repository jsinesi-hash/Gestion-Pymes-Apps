# Iteración 03 — Formularios Proveedores/Clientes y POS Cliente

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir validaciones, layout y campos en los formularios de Proveedores y Clientes, y agregar selección de cliente en el POS.

**Architecture:** Migración 0009 agrega 4 columnas a `cliente` y `proveedor`. Utilidades puras de validación/formato en `renderer/utils/documento.ts`. Fix de `DireccionGeo` con React portal. Selector de cliente en POS con estado en `usePosSession`.

**Tech Stack:** TypeScript, React, Drizzle ORM, SQLite, Vitest, @testing-library/react

---

## File Map

| Archivo | Acción |
|---|---|
| `packages/client/src/main/db/migrations/0009_personas_v2.sql` | Crear |
| `packages/client/src/main/db/migrations/meta/_journal.json` | Modificar |
| `packages/client/src/main/db/schema/personas.ts` | Modificar |
| `packages/client/src/main/ipc/cliente.ts` | Modificar |
| `packages/client/src/main/ipc/proveedor.ts` | Modificar |
| `packages/client/src/main/ipc/__tests__/cliente.handlers.test.ts` | Modificar |
| `packages/client/src/main/ipc/__tests__/proveedor.handlers.test.ts` | Modificar |
| `packages/client/src/renderer/utils/documento.ts` | Crear |
| `packages/client/src/renderer/utils/documento.test.ts` | Crear |
| `packages/client/src/renderer/components/DireccionGeo.tsx` | Modificar |
| `packages/client/src/renderer/views/compras/proveedores/ProveedorForm.tsx` | Modificar |
| `packages/client/src/renderer/views/clientes/ClienteForm.tsx` | Modificar |
| `packages/client/src/renderer/hooks/usePosSession.ts` | Modificar |
| `packages/client/src/renderer/hooks/__tests__/usePosSession.test.tsx` | Modificar |
| `packages/client/src/renderer/views/pos/PosClienteSelector.tsx` | Crear |
| `packages/client/src/renderer/views/pos/__tests__/PosClienteSelector.test.tsx` | Crear |
| `packages/client/src/renderer/views/pos/PosTotalsPanel.tsx` | Modificar |
| `packages/client/src/renderer/views/pos/PosView.tsx` | Modificar |

---

## Task 1: Migración DB 0009 + Schema + IPC

**Files:**
- Create: `packages/client/src/main/db/migrations/0009_personas_v2.sql`
- Modify: `packages/client/src/main/db/migrations/meta/_journal.json`
- Modify: `packages/client/src/main/db/schema/personas.ts`
- Modify: `packages/client/src/main/ipc/cliente.ts`
- Modify: `packages/client/src/main/ipc/proveedor.ts`

- [ ] **Step 1: Crear migración SQL**

Crear `packages/client/src/main/db/migrations/0009_personas_v2.sql` con:

```sql
ALTER TABLE cliente ADD COLUMN calle TEXT;
ALTER TABLE cliente ADD COLUMN numero TEXT;
ALTER TABLE cliente ADD COLUMN aclaracion TEXT;
ALTER TABLE cliente ADD COLUMN telefono_adicional TEXT;

ALTER TABLE proveedor ADD COLUMN calle TEXT;
ALTER TABLE proveedor ADD COLUMN numero TEXT;
ALTER TABLE proveedor ADD COLUMN aclaracion TEXT;
ALTER TABLE proveedor ADD COLUMN telefono_adicional TEXT;
```

- [ ] **Step 2: Actualizar journal**

En `packages/client/src/main/db/migrations/meta/_journal.json`, agregar al array `entries` al final:

```json
{
  "idx": 9,
  "version": "7",
  "when": 1751155200000,
  "tag": "0009_personas_v2",
  "breakpoints": true
}
```

- [ ] **Step 3: Actualizar schema Drizzle**

En `packages/client/src/main/db/schema/personas.ts`, agregar las 4 columnas en ambas tablas.

En `export const cliente = sqliteTable('cliente', {`, después de `codigo_postal`:
```typescript
  calle:                text('calle'),
  numero:               text('numero'),
  aclaracion:           text('aclaracion'),
  telefono_adicional:   text('telefono_adicional'),
```

En `export const proveedor = sqliteTable('proveedor', {`, después de `codigo_postal`:
```typescript
  calle:                text('calle'),
  numero:               text('numero'),
  aclaracion:           text('aclaracion'),
  telefono_adicional:   text('telefono_adicional'),
```

- [ ] **Step 4: Actualizar payload e handler de cliente**

En `packages/client/src/main/ipc/cliente.ts`, extender `ClienteUpsertPayload`:

```typescript
export type ClienteUpsertPayload = {
  id?: string;
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  razon_social: string;
  condicion_fiscal: 'RI' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  nombre_fantasia?: string;
  telefono?: string;
  telefono_adicional?: string;
  email?: string;
  habilita_cuenta_corriente?: boolean;
  domicilio?: string;
  calle?: string;
  numero?: string;
  aclaracion?: string;
  localidad_id?: string;
  localidad?: string;
  provincia?: string;
  codigo_postal?: string;
};
```

En `clienteUpsertHandler`, en el `db.update(...).set({...})` agregar:
```typescript
calle:              payload.calle              ?? null,
numero:             payload.numero             ?? null,
aclaracion:         payload.aclaracion         ?? null,
telefono_adicional: payload.telefono_adicional ?? null,
```

En el `db.insert(...).values({...})` agregar los mismos 4 campos.

- [ ] **Step 5: Actualizar payload e handler de proveedor**

En `packages/client/src/main/ipc/proveedor.ts`, extender `ProveedorUpsertPayload`:

```typescript
export type ProveedorUpsertPayload = {
  id?: string;
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  razon_social: string;
  condicion_fiscal: 'RI' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  nombre_fantasia?: string;
  domicilio?: string;
  calle?: string;
  numero?: string;
  aclaracion?: string;
  localidad_id?: string;
  localidad?: string;
  provincia?: string;
  codigo_postal?: string;
  telefono?: string;
  telefono_adicional?: string;
  email?: string;
  persona_contacto?: string;
  observaciones?: string;
};
```

En `proveedorUpsertHandler`, en ambos `db.update().set()` y `db.insert().values()` agregar:
```typescript
calle:              payload.calle              ?? null,
numero:             payload.numero             ?? null,
aclaracion:         payload.aclaracion         ?? null,
telefono_adicional: payload.telefono_adicional ?? null,
```

- [ ] **Step 6: Escribir tests para nuevos campos IPC**

En `packages/client/src/main/ipc/__tests__/cliente.handlers.test.ts`, agregar al final:

```typescript
describe('clienteUpsertHandler — campos domicilio extendido', () => {
  it('guarda y recupera calle, numero, aclaracion, telefono_adicional', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      razon_social: 'Test Cliente',
      condicion_fiscal: 'Consumidor Final',
      calle: 'Av. Corrientes',
      numero: '1234',
      aclaracion: 'Piso 3B',
      telefono_adicional: '11-9999-8888',
    });
    const c = clienteGetHandler(db, id);
    expect(c!.calle).toBe('Av. Corrientes');
    expect(c!.numero).toBe('1234');
    expect(c!.aclaracion).toBe('Piso 3B');
    expect(c!.telefono_adicional).toBe('11-9999-8888');
  });

  it('permite guardar sin los campos opcionales (null en DB)', () => {
    const { id } = clienteUpsertHandler(db, {
      tipo_documento: 'DNI',
      numero_documento: '87654321',
      razon_social: 'Sin Domicilio',
      condicion_fiscal: 'Consumidor Final',
    });
    const c = clienteGetHandler(db, id);
    expect(c!.calle).toBeNull();
    expect(c!.telefono_adicional).toBeNull();
  });
});
```

En `packages/client/src/main/ipc/__tests__/proveedor.handlers.test.ts`, agregar al final:

```typescript
describe('proveedorUpsertHandler — campos domicilio extendido', () => {
  it('guarda y recupera calle, numero, aclaracion, telefono_adicional', () => {
    loginAsAdmin(db);
    const { id } = proveedorUpsertHandler(db, {
      tipo_documento: 'CUIT',
      numero_documento: '20111111112',
      razon_social: 'Distribuidora SA',
      condicion_fiscal: 'RI',
      calle: 'Tucumán',
      numero: '500',
      aclaracion: 'Galpón 2',
      telefono_adicional: '0351-4444-5555',
    });
    const p = proveedorGetHandler(db, id);
    expect(p!.calle).toBe('Tucumán');
    expect(p!.numero).toBe('500');
    expect(p!.aclaracion).toBe('Galpón 2');
    expect(p!.telefono_adicional).toBe('0351-4444-5555');
  });
});
```

- [ ] **Step 7: Correr tests IPC**

```
cd packages/client && npx vitest run src/main/ipc/__tests__/cliente.handlers.test.ts src/main/ipc/__tests__/proveedor.handlers.test.ts
```

Esperado: todos los tests PASS (incluyendo los nuevos).

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/main/db/migrations/0009_personas_v2.sql
git add packages/client/src/main/db/migrations/meta/_journal.json
git add packages/client/src/main/db/schema/personas.ts
git add packages/client/src/main/ipc/cliente.ts
git add packages/client/src/main/ipc/proveedor.ts
git add packages/client/src/main/ipc/__tests__/cliente.handlers.test.ts
git add packages/client/src/main/ipc/__tests__/proveedor.handlers.test.ts
git commit -m "feat(db): migración 0009 — calle/numero/aclaracion/telefono_adicional en cliente y proveedor"
```

---

## Task 2: Utilidades de validación/formato de documentos

**Files:**
- Create: `packages/client/src/renderer/utils/documento.ts`
- Create: `packages/client/src/renderer/utils/documento.test.ts`

- [ ] **Step 1: Escribir los tests (RED)**

Crear `packages/client/src/renderer/utils/documento.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatDocumento, validarDocumento, validarTelefono, validarCodigoPostal } from './documento';

describe('formatDocumento', () => {
  describe('CUIT / CUIL', () => {
    it('0-2 dígitos: sin guiones', () => {
      expect(formatDocumento('CUIT', '2')).toBe('2');
      expect(formatDocumento('CUIT', '20')).toBe('20');
    });
    it('3-10 dígitos: un guión después de los 2 primeros', () => {
      expect(formatDocumento('CUIT', '201')).toBe('20-1');
      expect(formatDocumento('CUIT', '2012345678')).toBe('20-12345678');
    });
    it('11 dígitos: formato completo XX-XXXXXXXX-X', () => {
      expect(formatDocumento('CUIT', '20123456789')).toBe('20-12345678-9');
    });
    it('ignora caracteres no-dígito en el input', () => {
      expect(formatDocumento('CUIT', '20-123456789')).toBe('20-12345678-9');
    });
    it('limita a 11 dígitos', () => {
      expect(formatDocumento('CUIT', '201234567890')).toBe('20-12345678-9');
    });
    it('CUIL mismo comportamiento que CUIT', () => {
      expect(formatDocumento('CUIL', '27111222334')).toBe('27-11122233-4');
    });
  });

  describe('DNI', () => {
    it('solo dígitos, sin guiones', () => {
      expect(formatDocumento('DNI', '12345678')).toBe('12345678');
    });
    it('limita a 8 dígitos', () => {
      expect(formatDocumento('DNI', '123456789')).toBe('12345678');
    });
    it('ignora caracteres no-dígito', () => {
      expect(formatDocumento('DNI', '1234abc')).toBe('1234');
    });
  });
});

describe('validarDocumento', () => {
  it('CUIT válido (11 dígitos con guiones): null', () => {
    expect(validarDocumento('CUIT', '20-12345678-9')).toBeNull();
  });
  it('CUIT solo dígitos sin guiones: null si son 11', () => {
    expect(validarDocumento('CUIT', '20123456789')).toBeNull();
  });
  it('CUIT con menos de 11 dígitos: error', () => {
    expect(validarDocumento('CUIT', '2012345678')).not.toBeNull();
  });
  it('CUIL válido: null', () => {
    expect(validarDocumento('CUIL', '27-11122233-4')).toBeNull();
  });
  it('DNI 8 dígitos: null', () => {
    expect(validarDocumento('DNI', '12345678')).toBeNull();
  });
  it('DNI 7 dígitos: null', () => {
    expect(validarDocumento('DNI', '1234567')).toBeNull();
  });
  it('DNI 6 dígitos: error', () => {
    expect(validarDocumento('DNI', '123456')).not.toBeNull();
  });
  it('DNI más de 8 dígitos: error', () => {
    expect(validarDocumento('DNI', '123456789')).not.toBeNull();
  });
});

describe('validarTelefono', () => {
  it('vacío: null (campo opcional)', () => {
    expect(validarTelefono('')).toBeNull();
  });
  it('solo dígitos: null', () => {
    expect(validarTelefono('1112345678')).toBeNull();
  });
  it('con guiones, espacios, paréntesis, +: null', () => {
    expect(validarTelefono('+54 (11) 1234-5678')).toBeNull();
  });
  it('con letras: error', () => {
    expect(validarTelefono('11-abc-5678')).not.toBeNull();
  });
});

describe('validarCodigoPostal', () => {
  it('vacío: null (campo opcional)', () => {
    expect(validarCodigoPostal('')).toBeNull();
  });
  it('numérico hasta 8 chars: null', () => {
    expect(validarCodigoPostal('1000')).toBeNull();
  });
  it('alfanumérico (ej. CP argentino antiguo): null', () => {
    expect(validarCodigoPostal('B1900')).toBeNull();
  });
  it('más de 8 chars: error', () => {
    expect(validarCodigoPostal('123456789')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan (RED)**

```
cd packages/client && npx vitest run src/renderer/utils/documento.test.ts
```

Esperado: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `documento.ts`**

Crear `packages/client/src/renderer/utils/documento.ts`:

```typescript
type TipoDocumento = 'DNI' | 'CUIT' | 'CUIL';

export function formatDocumento(tipo: TipoDocumento, rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '');

  if (tipo === 'CUIT' || tipo === 'CUIL') {
    const d = digits.slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
  }

  // DNI
  return digits.slice(0, 8);
}

export function validarDocumento(tipo: TipoDocumento, valor: string): string | null {
  const digits = valor.replace(/\D/g, '');

  if (tipo === 'CUIT' || tipo === 'CUIL') {
    if (digits.length !== 11) return 'Debe tener 11 dígitos (XX-XXXXXXXX-X).';
    return null;
  }

  // DNI
  if (digits.length < 7 || digits.length > 8) return 'El DNI debe tener 7 u 8 dígitos.';
  return null;
}

export function validarTelefono(valor: string): string | null {
  if (!valor.trim()) return null;
  if (!/^[0-9 +\-()\s]*$/.test(valor)) return 'El teléfono solo puede contener números.';
  return null;
}

export function validarCodigoPostal(valor: string): string | null {
  if (!valor.trim()) return null;
  if (valor.length > 8) return 'El código postal no puede superar 8 caracteres.';
  if (!/^[a-zA-Z0-9]+$/.test(valor)) return 'El código postal solo puede contener letras y números.';
  return null;
}
```

- [ ] **Step 4: Correr tests para verificar que pasan (GREEN)**

```
cd packages/client && npx vitest run src/renderer/utils/documento.test.ts
```

Esperado: todos los tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/renderer/utils/documento.ts
git add packages/client/src/renderer/utils/documento.test.ts
git commit -m "feat(utils): formatDocumento, validarDocumento, validarTelefono, validarCodigoPostal"
```

---

## Task 3: Fix DireccionGeo — dropdown con React portal

**Files:**
- Modify: `packages/client/src/renderer/components/DireccionGeo.tsx`

El problema es que `.card` en CSS global tiene `overflow: hidden`, lo que recorta el dropdown de Localidad. La solución es renderizar el dropdown en `document.body` mediante `ReactDOM.createPortal`.

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplazar `packages/client/src/renderer/components/DireccionGeo.tsx` con:

```typescript
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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

export function DireccionGeo({ value, onChange }: Props) {
  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [query, setQuery] = useState(value.localidad);
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    (window as any).ferreteria.geo.provincias().then(setProvincias);
  }, []);

  const provinciaId = provincias.find((p) => p.nombre === value.provincia)?.id ?? '';

  useEffect(() => {
    if (!provinciaId) { setLocalidades([]); return; }
    (window as any).ferreteria.geo.localidades(provinciaId, '').then(setLocalidades);
  }, [provinciaId]);

  const filtered = query.trim()
    ? localidades.filter((l) => l.nombre.toLowerCase().includes(query.toLowerCase())).slice(0, 50)
    : localidades.slice(0, 50);

  function openDropdown() {
    if (!value.provincia) return;
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
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
            background: 'var(--bg-card)',
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
          <select className="input" value={value.provincia} onChange={(e) => selectProvincia(e.target.value)}>
            <option value="">— Seleccioná una provincia —</option>
            {provincias.map((p) => (
              <option key={p.id} value={p.nombre}>{p.nombre}</option>
            ))}
          </select>
        </label>

        <label className="form-label" style={{ position: 'relative' }}>
          Localidad
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
```

- [ ] **Step 2: Correr todos los tests para detectar regresiones**

```
cd packages/client && npx vitest run
```

Esperado: todos los tests previos PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/renderer/components/DireccionGeo.tsx
git commit -m "fix(DireccionGeo): dropdown localidad via React portal para escapar overflow:hidden"
```

---

## Task 4: ProveedorForm — campos nuevos, validaciones y layout

**Files:**
- Modify: `packages/client/src/renderer/views/compras/proveedores/ProveedorForm.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplazar `packages/client/src/renderer/views/compras/proveedores/ProveedorForm.tsx` con:

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DireccionGeo, type DireccionGeoValue } from '../../../components/DireccionGeo';
import { formatDocumento, validarDocumento, validarTelefono, validarCodigoPostal } from '../../../utils/documento';

type FormState = {
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  razon_social: string;
  nombre_fantasia: string;
  condicion_fiscal: 'RI' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  calle: string;
  numero: string;
  aclaracion: string;
  direccion: DireccionGeoValue;
  telefono: string;
  telefono_adicional: string;
  email: string;
  persona_contacto: string;
  observaciones: string;
};

const initialForm: FormState = {
  tipo_documento: 'CUIT',
  numero_documento: '',
  razon_social: '',
  nombre_fantasia: '',
  condicion_fiscal: 'RI',
  calle: '',
  numero: '',
  aclaracion: '',
  direccion: { localidad_id: '', localidad: '', provincia: '', codigo_postal: '' },
  telefono: '',
  telefono_adicional: '',
  email: '',
  persona_contacto: '',
  observaciones: '',
};

export function ProveedorForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modoEdicion = !!id;

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (window as any).ferreteria.compras.proveedor.get(id).then((p: any) => {
      if (!p) return;
      setForm({
        tipo_documento:     p.tipo_documento    ?? 'CUIT',
        numero_documento:   p.numero_documento  ?? '',
        razon_social:       p.razon_social      ?? '',
        nombre_fantasia:    p.nombre_fantasia   ?? '',
        condicion_fiscal:   p.condicion_fiscal  ?? 'RI',
        calle:              p.calle             ?? '',
        numero:             p.numero            ?? '',
        aclaracion:         p.aclaracion        ?? '',
        direccion: {
          localidad_id:  p.localidad_id  ?? '',
          localidad:     p.localidad     ?? '',
          provincia:     p.provincia     ?? '',
          codigo_postal: p.codigo_postal ?? '',
        },
        telefono:           p.telefono           ?? '',
        telefono_adicional: p.telefono_adicional ?? '',
        email:              p.email              ?? '',
        persona_contacto:   p.persona_contacto   ?? '',
        observaciones:      p.observaciones      ?? '',
      });
    });
  }, [id]);

  function set(field: keyof Omit<FormState, 'direccion'>, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }

  function handleTipoDocumento(tipo: FormState['tipo_documento']) {
    const reformateado = formatDocumento(tipo, form.numero_documento);
    setForm(f => ({ ...f, tipo_documento: tipo, numero_documento: reformateado }));
    setErrors(e => { const n = { ...e }; delete n.tipo_documento; delete n.numero_documento; return n; });
  }

  function handleNumeroDocumento(raw: string) {
    const formateado = formatDocumento(form.tipo_documento, raw);
    set('numero_documento', formateado);
  }

  function handleNumeroLocal(raw: string) {
    set('numero', raw.replace(/\D/g, ''));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.razon_social.trim()) errs.razon_social = 'La razón social es obligatoria.';

    const errDoc = form.numero_documento.trim()
      ? validarDocumento(form.tipo_documento, form.numero_documento)
      : 'El número de documento es obligatorio.';
    if (errDoc) errs.numero_documento = errDoc;

    const errTel = validarTelefono(form.telefono);
    if (errTel) errs.telefono = errTel;

    const errTelAd = validarTelefono(form.telefono_adicional);
    if (errTelAd) errs.telefono_adicional = errTelAd;

    const errCp = validarCodigoPostal(form.direccion.codigo_postal);
    if (errCp) errs.codigo_postal = errCp;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...(id ? { id } : {}),
        tipo_documento:     form.tipo_documento,
        numero_documento:   form.numero_documento.trim(),
        razon_social:       form.razon_social.trim(),
        condicion_fiscal:   form.condicion_fiscal,
        nombre_fantasia:    form.nombre_fantasia.trim()    || undefined,
        calle:              form.calle.trim()              || undefined,
        numero:             form.numero.trim()             || undefined,
        aclaracion:         form.aclaracion.trim()         || undefined,
        localidad_id:       form.direccion.localidad_id    || undefined,
        localidad:          form.direccion.localidad       || undefined,
        provincia:          form.direccion.provincia       || undefined,
        codigo_postal:      form.direccion.codigo_postal   || undefined,
        telefono:           form.telefono.trim()           || undefined,
        telefono_adicional: form.telefono_adicional.trim() || undefined,
        email:              form.email.trim()              || undefined,
        persona_contacto:   form.persona_contacto.trim()   || undefined,
        observaciones:      form.observaciones.trim()      || undefined,
      };
      const { id: resultId } = await (window as any).ferreteria.compras.proveedor.upsert(payload);
      navigate(`/compras/proveedores/${resultId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-col gap-4" style={{ maxWidth: 800 }}>
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>{modoEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-col gap-4">
        <div className="card">
          <div className="card-title">Identificación fiscal</div>
          <div className="form-row">
            <label className="form-label">
              Tipo de documento *
              <select className="input" value={form.tipo_documento} onChange={e => handleTipoDocumento(e.target.value as FormState['tipo_documento'])}>
                <option value="CUIT">CUIT</option>
                <option value="DNI">DNI</option>
                <option value="CUIL">CUIL</option>
              </select>
            </label>
            <label className="form-label">
              Número de documento *
              <input
                className={`input${errors.numero_documento ? ' error' : ''}`}
                value={form.numero_documento}
                onChange={e => handleNumeroDocumento(e.target.value)}
                placeholder={form.tipo_documento === 'DNI' ? '12345678' : '20-12345678-9'}
              />
              {errors.numero_documento && <span className="field-error">{errors.numero_documento}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label" style={{ flex: 2 }}>
              Razón social *
              <input className={`input${errors.razon_social ? ' error' : ''}`} value={form.razon_social} onChange={e => set('razon_social', e.target.value)} placeholder="Distribuidora SA" />
              {errors.razon_social && <span className="field-error">{errors.razon_social}</span>}
            </label>
            <label className="form-label">
              Nombre fantasía
              <input className="input" value={form.nombre_fantasia} onChange={e => set('nombre_fantasia', e.target.value)} placeholder="Nombre comercial" />
            </label>
          </div>
          <div className="form-row">
            <label className="form-label" style={{ maxWidth: 220 }}>
              Condición fiscal *
              <select className="input" value={form.condicion_fiscal} onChange={e => set('condicion_fiscal', e.target.value as any)}>
                <option value="RI">Resp. Inscripto</option>
                <option value="Monotributo">Monotributo</option>
                <option value="Exento">Exento</option>
                <option value="Consumidor Final">Consumidor Final</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Contacto</div>
          <div className="form-row">
            <label className="form-label">
              Teléfono
              <input className={`input${errors.telefono ? ' error' : ''}`} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="11-1234-5678" />
              {errors.telefono && <span className="field-error">{errors.telefono}</span>}
            </label>
            <label className="form-label">
              Teléfono adicional
              <input className={`input${errors.telefono_adicional ? ' error' : ''}`} value={form.telefono_adicional} onChange={e => set('telefono_adicional', e.target.value)} placeholder="11-9999-8888" />
              {errors.telefono_adicional && <span className="field-error">{errors.telefono_adicional}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">
              Email
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contacto@proveedor.com" />
            </label>
            <label className="form-label">
              Persona de contacto
              <input className="input" value={form.persona_contacto} onChange={e => set('persona_contacto', e.target.value)} placeholder="Nombre del contacto" />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Domicilio</div>
          <div className="form-row">
            <label className="form-label" style={{ flex: 2 }}>
              Calle
              <input className="input" value={form.calle} onChange={e => set('calle', e.target.value)} placeholder="Av. Corrientes" />
            </label>
            <label className="form-label" style={{ maxWidth: 110 }}>
              Número
              <input className="input" value={form.numero} onChange={e => handleNumeroLocal(e.target.value)} placeholder="1234" />
            </label>
            <label className="form-label">
              Aclaración
              <input className="input" value={form.aclaracion} onChange={e => set('aclaracion', e.target.value)} placeholder="Piso 2, Of. B" />
            </label>
          </div>
          <DireccionGeo
            value={form.direccion}
            onChange={v => setForm(f => ({ ...f, direccion: v }))}
          />
          {errors.codigo_postal && <span className="field-error">{errors.codigo_postal}</span>}
        </div>

        <div className="card">
          <div className="card-title">Observaciones</div>
          <textarea
            className="input"
            rows={4}
            value={form.observaciones}
            onChange={e => set('observaciones', e.target.value)}
            placeholder="Notas internas sobre el proveedor..."
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : modoEdicion ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Correr todos los tests**

```
cd packages/client && npx vitest run
```

Esperado: todos PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/renderer/views/compras/proveedores/ProveedorForm.tsx
git commit -m "feat(ProveedorForm): calle/numero/aclaracion, tel adicional, máscara CUIT, validaciones"
```

---

## Task 5: ClienteForm — campos nuevos, validaciones y layout

**Files:**
- Modify: `packages/client/src/renderer/views/clientes/ClienteForm.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplazar `packages/client/src/renderer/views/clientes/ClienteForm.tsx` con:

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DireccionGeo, type DireccionGeoValue } from '../../components/DireccionGeo';
import { formatDocumento, validarDocumento, validarTelefono, validarCodigoPostal } from '../../utils/documento';

type FormState = {
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  razon_social: string;
  nombre_fantasia: string;
  condicion_fiscal: 'RI' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  telefono: string;
  telefono_adicional: string;
  email: string;
  habilita_cuenta_corriente: boolean;
  calle: string;
  numero: string;
  aclaracion: string;
  direccion: DireccionGeoValue;
};

const initialForm: FormState = {
  tipo_documento: 'DNI',
  numero_documento: '',
  razon_social: '',
  nombre_fantasia: '',
  condicion_fiscal: 'Consumidor Final',
  telefono: '',
  telefono_adicional: '',
  email: '',
  habilita_cuenta_corriente: false,
  calle: '',
  numero: '',
  aclaracion: '',
  direccion: { localidad_id: '', localidad: '', provincia: '', codigo_postal: '' },
};

export function ClienteForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modoEdicion = !!id;

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (window as any).ferreteria.cliente.get(id).then((c: any) => {
      if (!c) return;
      setForm({
        tipo_documento:            c.tipo_documento            ?? 'DNI',
        numero_documento:          c.numero_documento          ?? '',
        razon_social:              c.razon_social              ?? '',
        nombre_fantasia:           c.nombre_fantasia           ?? '',
        condicion_fiscal:          c.condicion_fiscal          ?? 'Consumidor Final',
        telefono:                  c.telefono                  ?? '',
        telefono_adicional:        c.telefono_adicional        ?? '',
        email:                     c.email                     ?? '',
        habilita_cuenta_corriente: c.habilita_cuenta_corriente ?? false,
        calle:                     c.calle                     ?? '',
        numero:                    c.numero                    ?? '',
        aclaracion:                c.aclaracion                ?? '',
        direccion: {
          localidad_id:  c.localidad_id  ?? '',
          localidad:     c.localidad     ?? '',
          provincia:     c.provincia     ?? '',
          codigo_postal: c.codigo_postal ?? '',
        },
      });
    });
  }, [id]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  function handleTipoDocumento(tipo: FormState['tipo_documento']) {
    const reformateado = formatDocumento(tipo, form.numero_documento);
    setForm(f => ({ ...f, tipo_documento: tipo, numero_documento: reformateado }));
    setErrors(e => { const n = { ...e }; delete n.tipo_documento; delete n.numero_documento; return n; });
  }

  function handleNumeroDocumento(raw: string) {
    const formateado = formatDocumento(form.tipo_documento, raw);
    setField('numero_documento', formateado);
  }

  function handleNumeroLocal(raw: string) {
    setField('numero', raw.replace(/\D/g, ''));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.razon_social.trim()) errs.razon_social = 'La razón social es obligatoria.';

    const errDoc = form.numero_documento.trim()
      ? validarDocumento(form.tipo_documento, form.numero_documento)
      : 'El número de documento es obligatorio.';
    if (errDoc) errs.numero_documento = errDoc;

    const errTel = validarTelefono(form.telefono);
    if (errTel) errs.telefono = errTel;

    const errTelAd = validarTelefono(form.telefono_adicional);
    if (errTelAd) errs.telefono_adicional = errTelAd;

    const errCp = validarCodigoPostal(form.direccion.codigo_postal);
    if (errCp) errs.codigo_postal = errCp;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...(id ? { id } : {}),
        tipo_documento:            form.tipo_documento,
        numero_documento:          form.numero_documento.trim(),
        razon_social:              form.razon_social.trim(),
        condicion_fiscal:          form.condicion_fiscal,
        nombre_fantasia:           form.nombre_fantasia.trim()    || undefined,
        telefono:                  form.telefono.trim()            || undefined,
        telefono_adicional:        form.telefono_adicional.trim() || undefined,
        email:                     form.email.trim()              || undefined,
        habilita_cuenta_corriente: form.habilita_cuenta_corriente,
        calle:                     form.calle.trim()              || undefined,
        numero:                    form.numero.trim()             || undefined,
        aclaracion:                form.aclaracion.trim()         || undefined,
        localidad_id:              form.direccion.localidad_id    || undefined,
        localidad:                 form.direccion.localidad       || undefined,
        provincia:                 form.direccion.provincia       || undefined,
        codigo_postal:             form.direccion.codigo_postal   || undefined,
      };
      const { id: resultId } = await (window as any).ferreteria.cliente.upsert(payload);
      navigate(`/clientes/${resultId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-col gap-4" style={{ maxWidth: 800 }}>
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>{modoEdicion ? 'Editar cliente' : 'Nuevo cliente'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-col gap-4">
        <div className="card">
          <div className="card-title">Identificación</div>
          <div className="form-row">
            <label className="form-label">
              Tipo de documento *
              <select className="input" value={form.tipo_documento} onChange={(e) => handleTipoDocumento(e.target.value as FormState['tipo_documento'])}>
                <option value="DNI">DNI</option>
                <option value="CUIT">CUIT</option>
                <option value="CUIL">CUIL</option>
              </select>
            </label>
            <label className="form-label">
              Número de documento *
              <input
                className={`input${errors.numero_documento ? ' error' : ''}`}
                value={form.numero_documento}
                onChange={(e) => handleNumeroDocumento(e.target.value)}
                placeholder={form.tipo_documento === 'DNI' ? '12345678' : '20-12345678-9'}
              />
              {errors.numero_documento && <span className="field-error">{errors.numero_documento}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label" style={{ flex: 2 }}>
              Apellido y nombre / Razón social *
              <input
                className={`input${errors.razon_social ? ' error' : ''}`}
                value={form.razon_social}
                onChange={(e) => setField('razon_social', e.target.value)}
                placeholder="García Juan Carlos"
              />
              {errors.razon_social && <span className="field-error">{errors.razon_social}</span>}
            </label>
            <label className="form-label">
              Nombre fantasía
              <input className="input" value={form.nombre_fantasia} onChange={(e) => setField('nombre_fantasia', e.target.value)} placeholder="Opcional" />
            </label>
          </div>
          <div className="form-row">
            <label className="form-label" style={{ maxWidth: 220 }}>
              Condición fiscal *
              <select className="input" value={form.condicion_fiscal} onChange={(e) => setField('condicion_fiscal', e.target.value as any)}>
                <option value="Consumidor Final">Consumidor Final</option>
                <option value="Monotributo">Monotributo</option>
                <option value="RI">Resp. Inscripto</option>
                <option value="Exento">Exento</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Contacto</div>
          <div className="form-row">
            <label className="form-label">
              Teléfono
              <input className={`input${errors.telefono ? ' error' : ''}`} value={form.telefono} onChange={(e) => setField('telefono', e.target.value)} placeholder="11-1234-5678" />
              {errors.telefono && <span className="field-error">{errors.telefono}</span>}
            </label>
            <label className="form-label">
              Teléfono adicional
              <input className={`input${errors.telefono_adicional ? ' error' : ''}`} value={form.telefono_adicional} onChange={(e) => setField('telefono_adicional', e.target.value)} placeholder="11-9999-8888" />
              {errors.telefono_adicional && <span className="field-error">{errors.telefono_adicional}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">
              Email
              <input className="input" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="cliente@email.com" />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Domicilio</div>
          <div className="form-row">
            <label className="form-label" style={{ flex: 2 }}>
              Calle
              <input className="input" value={form.calle} onChange={(e) => setField('calle', e.target.value)} placeholder="Av. Corrientes" />
            </label>
            <label className="form-label" style={{ maxWidth: 110 }}>
              Número
              <input className="input" value={form.numero} onChange={(e) => handleNumeroLocal(e.target.value)} placeholder="1234" />
            </label>
            <label className="form-label">
              Aclaración
              <input className="input" value={form.aclaracion} onChange={(e) => setField('aclaracion', e.target.value)} placeholder="Depto 3B" />
            </label>
          </div>
          <DireccionGeo
            value={form.direccion}
            onChange={(v) => setField('direccion', v)}
          />
          {errors.codigo_postal && <span className="field-error">{errors.codigo_postal}</span>}
        </div>

        <div className="card">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.habilita_cuenta_corriente}
              onChange={(e) => setField('habilita_cuenta_corriente', e.target.checked)}
            />
            <span>Habilitar cuenta corriente</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : modoEdicion ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Correr todos los tests**

```
cd packages/client && npx vitest run
```

Esperado: todos PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/renderer/views/clientes/ClienteForm.tsx
git commit -m "feat(ClienteForm): calle/numero/aclaracion, tel adicional, máscara CUIT/DNI, validaciones"
```

---

## Task 6: usePosSession — estado de cliente + tipo formaPago expandido

**Files:**
- Modify: `packages/client/src/renderer/hooks/usePosSession.ts`
- Modify: `packages/client/src/renderer/hooks/__tests__/usePosSession.test.tsx`

- [ ] **Step 1: Escribir los nuevos tests (RED)**

En `packages/client/src/renderer/hooks/__tests__/usePosSession.test.tsx`, agregar al final del `describe('usePosSession', ...)`:

```typescript
  it('inicia con clienteId = CONSUMIDOR_FINAL_ID y clienteInfo = null', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());
    expect(result.current.clienteId).toBe('cf000000-0000-0000-0000-000000000001');
    expect(result.current.clienteInfo).toBeNull();
  });

  it('setCliente actualiza clienteId y clienteInfo', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    act(() => {
      result.current.setCliente('c-123', { razon_social: 'Juan García', habilita_ccc: false });
    });

    expect(result.current.clienteId).toBe('c-123');
    expect(result.current.clienteInfo?.razon_social).toBe('Juan García');
  });

  it('setCliente con habilita_ccc=false y formaPago=cuenta_corriente resetea a efectivo', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    // Primero, seleccionar cliente con CCC y setear forma de pago
    act(() => {
      result.current.setCliente('c-ccc', { razon_social: 'Empresa CCC', habilita_ccc: true });
      result.current.setFormaPago('cuenta_corriente');
    });
    expect(result.current.formaPago).toBe('cuenta_corriente');

    // Cambiar a cliente sin CCC: debe resetear forma de pago
    act(() => {
      result.current.setCliente('c-noccc', { razon_social: 'Sin CCC', habilita_ccc: false });
    });
    expect(result.current.formaPago).toBe('efectivo');
  });

  it('reset() vuelve clienteId a CONSUMIDOR_FINAL_ID', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    act(() => {
      result.current.setCliente('c-123', { razon_social: 'Juan', habilita_ccc: false });
    });
    act(() => { result.current.reset(); });

    expect(result.current.clienteId).toBe('cf000000-0000-0000-0000-000000000001');
    expect(result.current.clienteInfo).toBeNull();
  });
```

- [ ] **Step 2: Correr tests para verificar que fallan (RED)**

```
cd packages/client && npx vitest run src/renderer/hooks/__tests__/usePosSession.test.tsx
```

Esperado: los 4 nuevos tests FAIL.

- [ ] **Step 3: Implementar cambios en usePosSession**

En `packages/client/src/renderer/hooks/usePosSession.ts`:

**Cambiar el tipo de `formaPago`** (línea `const [formaPago, setFormaPago]`):
```typescript
const [formaPago, setFormaPago] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'cuenta_corriente'>('efectivo');
```

**Agregar estado de cliente** después de la declaración de `formaPago`:
```typescript
const [clienteId, setClienteIdState] = useState<string>(CONSUMIDOR_FINAL_ID);
const [clienteInfo, setClienteInfo] = useState<{ razon_social: string; habilita_ccc: boolean } | null>(null);
```

**Agregar función `setCliente`** antes de `addLinea`:
```typescript
function setCliente(id: string, info: { razon_social: string; habilita_ccc: boolean } | null) {
  setClienteIdState(id);
  setClienteInfo(info);
  if (!info?.habilita_ccc) setFormaPago(prev => prev === 'cuenta_corriente' ? 'efectivo' : prev);
}
```

**En `confirmar()`**, reemplazar `cliente_id: CONSUMIDOR_FINAL_ID` por `cliente_id: clienteId`.

**En `reset()`**, agregar al final:
```typescript
setClienteIdState(CONSUMIDOR_FINAL_ID);
setClienteInfo(null);
```

**En el `return` del hook**, agregar `clienteId`, `clienteInfo`, `setCliente`:
```typescript
return {
  cajaActiva,
  lines,
  descuentoGlobalPct,
  formaPago,
  totales,
  loading,
  error,
  clienteId,
  clienteInfo,
  setCliente,
  addLinea,
  updateCantidad,
  updateDescuentoLinea,
  removeLine,
  setDescuentoGlobal: setDescuentoGlobalPct,
  setFormaPago,
  confirmar,
  reset,
  clearError: () => setError(null),
};
```

- [ ] **Step 4: Correr tests (GREEN)**

```
cd packages/client && npx vitest run src/renderer/hooks/__tests__/usePosSession.test.tsx
```

Esperado: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/renderer/hooks/usePosSession.ts
git add packages/client/src/renderer/hooks/__tests__/usePosSession.test.tsx
git commit -m "feat(usePosSession): estado cliente seleccionable, tipo formaPago incluye cuenta_corriente"
```

---

## Task 7: PosClienteSelector + PosTotalsPanel + PosView

**Files:**
- Create: `packages/client/src/renderer/views/pos/PosClienteSelector.tsx`
- Create: `packages/client/src/renderer/views/pos/__tests__/PosClienteSelector.test.tsx`
- Modify: `packages/client/src/renderer/views/pos/PosTotalsPanel.tsx`
- Modify: `packages/client/src/renderer/views/pos/PosView.tsx`

- [ ] **Step 1: Escribir tests para PosClienteSelector (RED)**

Crear `packages/client/src/renderer/views/pos/__tests__/PosClienteSelector.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PosClienteSelector } from '../PosClienteSelector';
import { CONSUMIDOR_FINAL_ID } from '../../../hooks/usePosSession';

const mockClientes = [
  { id: 'c-1', razon_social: 'Juan García', tipo_documento: 'DNI', numero_documento: '12345678', habilita_cuenta_corriente: false },
  { id: 'c-2', razon_social: 'Empresa CCC SA', tipo_documento: 'CUIT', numero_documento: '20111111112', habilita_cuenta_corriente: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    cliente: { list: vi.fn().mockResolvedValue(mockClientes) },
  };
});

function renderSelector(props?: Partial<Parameters<typeof PosClienteSelector>[0]>) {
  const onSeleccionar = vi.fn();
  render(
    <PosClienteSelector
      clienteId={CONSUMIDOR_FINAL_ID}
      clienteInfo={null}
      onSeleccionar={onSeleccionar}
      {...props}
    />,
  );
  return { onSeleccionar };
}

describe('PosClienteSelector', () => {
  it('muestra "Consumidor Final" por defecto', () => {
    renderSelector();
    expect(screen.getByText('Consumidor Final')).toBeInTheDocument();
  });

  it('muestra botón Cambiar cuando está en modo CF', () => {
    renderSelector();
    expect(screen.getByRole('button', { name: /cambiar/i })).toBeInTheDocument();
  });

  it('al hacer click en Cambiar muestra el input de búsqueda', async () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /cambiar/i }));
    expect(screen.getByPlaceholderText(/buscar cliente/i)).toBeInTheDocument();
  });

  it('al buscar filtra por razon_social y muestra resultados', async () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /cambiar/i }));
    const input = screen.getByPlaceholderText(/buscar cliente/i);
    fireEvent.change(input, { target: { value: 'García' } });
    await waitFor(() => expect(screen.getByText('Juan García')).toBeInTheDocument());
    expect(screen.queryByText('Empresa CCC SA')).not.toBeInTheDocument();
  });

  it('al seleccionar un cliente llama onSeleccionar con id e info', async () => {
    const { onSeleccionar } = renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /cambiar/i }));
    const input = screen.getByPlaceholderText(/buscar cliente/i);
    fireEvent.change(input, { target: { value: 'Empresa' } });
    await waitFor(() => expect(screen.getByText('Empresa CCC SA')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Empresa CCC SA'));
    expect(onSeleccionar).toHaveBeenCalledWith('c-2', { razon_social: 'Empresa CCC SA', habilita_ccc: true });
  });

  it('muestra nombre del cliente seleccionado y botón ✕', () => {
    renderSelector({
      clienteId: 'c-1',
      clienteInfo: { razon_social: 'Juan García', habilita_ccc: false },
    });
    expect(screen.getByText('Juan García')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument();
  });

  it('botón ✕ llama onSeleccionar con CONSUMIDOR_FINAL_ID y null', () => {
    const { onSeleccionar } = renderSelector({
      clienteId: 'c-1',
      clienteInfo: { razon_social: 'Juan García', habilita_ccc: false },
    });
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(onSeleccionar).toHaveBeenCalledWith(CONSUMIDOR_FINAL_ID, null);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan (RED)**

```
cd packages/client && npx vitest run src/renderer/views/pos/__tests__/PosClienteSelector.test.tsx
```

Esperado: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar PosClienteSelector**

Crear `packages/client/src/renderer/views/pos/PosClienteSelector.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { CONSUMIDOR_FINAL_ID } from '../../hooks/usePosSession';

type ClienteInfo = { razon_social: string; habilita_ccc: boolean };

type Props = {
  clienteId: string;
  clienteInfo: ClienteInfo | null;
  onSeleccionar: (id: string, info: ClienteInfo | null) => void;
};

type ClienteRow = {
  id: string;
  razon_social: string;
  tipo_documento: string;
  numero_documento: string;
  habilita_cuenta_corriente: boolean;
};

export function PosClienteSelector({ clienteId, clienteInfo, onSeleccionar }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [query, setQuery] = useState('');
  const [todos, setTodos] = useState<ClienteRow[]>([]);

  useEffect(() => {
    if (!buscando) return;
    (window as any).ferreteria.cliente.list().then((list: ClienteRow[]) => {
      setTodos(list.filter(c => c.id !== CONSUMIDOR_FINAL_ID));
    });
  }, [buscando]);

  const filtrados = query.trim()
    ? todos.filter(c =>
        c.razon_social.toLowerCase().includes(query.toLowerCase()) ||
        c.numero_documento.includes(query),
      ).slice(0, 10)
    : todos.slice(0, 10);

  function seleccionar(c: ClienteRow) {
    onSeleccionar(c.id, { razon_social: c.razon_social, habilita_ccc: c.habilita_cuenta_corriente });
    setBuscando(false);
    setQuery('');
  }

  function resetear() {
    onSeleccionar(CONSUMIDOR_FINAL_ID, null);
    setBuscando(false);
    setQuery('');
  }

  const esConsumidorFinal = clienteId === CONSUMIDOR_FINAL_ID;

  if (buscando) {
    return (
      <div style={{ position: 'relative' }}>
        <input
          autoFocus
          className="input"
          placeholder="Buscar cliente..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onBlur={() => setTimeout(() => setBuscando(false), 150)}
          style={{ width: '100%' }}
        />
        {filtrados.length > 0 && (
          <ul style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6,
            maxHeight: 220, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}>
            {filtrados.map(c => (
              <li
                key={c.id}
                onMouseDown={() => seleccionar(c)}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ fontWeight: 600 }}>{c.razon_social}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.tipo_documento} {c.numero_documento}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div className="font-bold" style={{ marginTop: 4, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {esConsumidorFinal ? 'Consumidor Final' : (clienteInfo?.razon_social ?? 'Consumidor Final')}
      </div>
      {esConsumidorFinal ? (
        <button
          type="button"
          onClick={() => setBuscando(true)}
          style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}
        >
          Cambiar
        </button>
      ) : (
        <button
          type="button"
          onClick={resetear}
          aria-label="✕"
          style={{ fontSize: 13, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr tests PosClienteSelector (GREEN)**

```
cd packages/client && npx vitest run src/renderer/views/pos/__tests__/PosClienteSelector.test.tsx
```

Esperado: todos PASS.

- [ ] **Step 5: Actualizar PosTotalsPanel**

Reemplazar `packages/client/src/renderer/views/pos/PosTotalsPanel.tsx` con:

```typescript
type FormaPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'cuenta_corriente';

type Props = {
  totales: { subtotalCentavos: number; descuentoGlobalCentavos: number; totalCentavos: number; ajusteRedondeoCentavos: number } | null;
  descuentoGlobalPct: number;
  formaPago: FormaPago;
  onDescuentoGlobal: (pct: number) => void;
  onFormaPago: (fp: FormaPago) => void;
  onConfirmar: () => void;
  canOverride: boolean;
  loading: boolean;
  linesCount: number;
  habilitaCcc: boolean;
};

function formatPeso(centavos: number) {
  return (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FORMAS_PAGO_BASE = [
  { value: 'efectivo' as const, label: 'Efectivo' },
  { value: 'transferencia' as const, label: 'Transferencia' },
  { value: 'tarjeta' as const, label: 'Tarjeta' },
];

const FORMA_PAGO_CCC = { value: 'cuenta_corriente' as const, label: 'Cta. Cte.' };

export function PosTotalsPanel({ totales, descuentoGlobalPct, formaPago, onDescuentoGlobal, onFormaPago, onConfirmar, canOverride, loading, linesCount, habilitaCcc }: Props) {
  const formasPago = habilitaCcc ? [...FORMAS_PAGO_BASE, FORMA_PAGO_CCC] : FORMAS_PAGO_BASE;

  return (
    <div className="flex-col">
      <div>
        <div className="srow">
          <span className="sl">Subtotal</span>
          <span className="sv num">$ {totales ? formatPeso(totales.subtotalCentavos) : '0,00'}</span>
        </div>
        {totales && totales.descuentoGlobalCentavos > 0 && (
          <div className="srow">
            <span className="sl">Descuento global</span>
            <span className="sv num pos">− $ {formatPeso(totales.descuentoGlobalCentavos)}</span>
          </div>
        )}
        <div className="srow total">
          <span className="sl">TOTAL</span>
          <span className="sv num" style={{ color: 'var(--accent)' }}>$ {totales ? formatPeso(totales.totalCentavos) : '0,00'}</span>
        </div>
        {totales && totales.ajusteRedondeoCentavos !== 0 && (
          <div className="text-muted text-xs" style={{ textAlign: 'right', padding: '4px var(--pad)' }}>
            Redondeo: {totales.ajusteRedondeoCentavos > 0 ? '+' : ''}$ {formatPeso(totales.ajusteRedondeoCentavos)}
          </div>
        )}
      </div>

      {canOverride && (
        <div style={{ padding: '0 var(--pad) 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="text-muted" style={{ fontSize: 13, flex: 1 }}>Desc. global %</span>
          <input type="number" value={descuentoGlobalPct} min={0} max={100}
            onChange={e => onDescuentoGlobal(parseFloat(e.target.value) || 0)}
            className="input num" style={{ width: 70 }}
          />
        </div>
      )}

      <div style={{ padding: 'var(--pad)', borderTop: '1px solid var(--line)' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>Forma de pago</div>
        <div className="seg">
          {formasPago.map(fp => (
            <button key={fp.value} type="button" className={formaPago === fp.value ? 'on' : ''} onClick={() => onFormaPago(fp.value)}>
              {fp.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 var(--pad) var(--pad)' }}>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={loading || linesCount === 0}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16, ...(linesCount === 0 ? { background: 'var(--line)', boxShadow: 'none' } : {}) }}
        >
          {loading ? 'Procesando...' : 'Confirmar venta'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Actualizar PosView**

En `packages/client/src/renderer/views/pos/PosView.tsx`, hacer los siguientes cambios:

1. Agregar `PosClienteSelector` al import:
```typescript
import { PosClienteSelector } from './PosClienteSelector';
```

2. Extraer `clienteId`, `clienteInfo`, `setCliente` del hook:
```typescript
const {
  cajaActiva, lines, descuentoGlobalPct, formaPago, totales,
  loading, error, clienteId, clienteInfo, setCliente,
  addLinea, updateCantidad, updateDescuentoLinea,
  removeLine, setDescuentoGlobal, setFormaPago, confirmar, reset, clearError,
} = usePosSession();
```

3. Reemplazar el bloque estático del cliente:
```tsx
{/* ANTES: */}
<div className="font-bold" style={{ marginTop: 4 }}>Consumidor Final</div>

{/* DESPUÉS: */}
<PosClienteSelector
  clienteId={clienteId}
  clienteInfo={clienteInfo}
  onSeleccionar={setCliente}
/>
```

4. Agregar prop `habilitaCcc` a `PosTotalsPanel`:
```tsx
<PosTotalsPanel
  totales={totales}
  descuentoGlobalPct={descuentoGlobalPct}
  formaPago={formaPago}
  onDescuentoGlobal={setDescuentoGlobal}
  onFormaPago={setFormaPago}
  onConfirmar={handleConfirmar}
  canOverride={can('precio.override')}
  loading={loading}
  linesCount={lines.length}
  habilitaCcc={clienteInfo?.habilita_ccc ?? false}
/>
```

- [ ] **Step 7: Correr todos los tests**

```
cd packages/client && npx vitest run
```

Esperado: todos PASS, incluyendo los tests de PosView existentes.

- [ ] **Step 8: Commit final**

```bash
git add packages/client/src/renderer/views/pos/PosClienteSelector.tsx
git add packages/client/src/renderer/views/pos/__tests__/PosClienteSelector.test.tsx
git add packages/client/src/renderer/views/pos/PosTotalsPanel.tsx
git add packages/client/src/renderer/views/pos/PosView.tsx
git commit -m "feat(POS): selector de cliente, CCC como forma de pago cuando cliente lo habilita"
```

---

## Task 8: Verificación final

- [ ] **Step 1: Suite completa**

```
cd packages/client && pnpm test
```

Esperado: todos los tests PASS. La suite completa (`vitest run` + `test-node.cjs`) debe quedar verde.

- [ ] **Step 2: Commit de cierre**

Si no hay nada pendiente, el branch ya está listo. Registrar en memoria el estado completado.
