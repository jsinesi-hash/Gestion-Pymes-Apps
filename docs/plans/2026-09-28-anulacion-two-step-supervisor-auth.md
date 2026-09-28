# Reusar SupervisorAuthModal en anulaciones (Retail + Elaborados) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la duplicación del formulario "motivo + credenciales de Supervisor" en `AnulacionModal` (Retail) y `AnularProduccionModal` (Elaborados), convirtiendo cada uno en un flujo de 2 pasos que reusa `SupervisorAuthModal` de `@core/ui` sin modificarlo.

**Architecture:** Cada modal pasa de "un formulario con 3 campos" a una máquina de 2 estados locales (`'motivo' | 'auth'`). El paso `motivo` conserva el copy/título propio de cada dominio y solo pide el campo Motivo (botón "Continuar"). El paso `auth` delega 100% a `<SupervisorAuthModal>` tal cual existe hoy — mismas props (`onConfirm`, `onCancel`) — replicando el patrón que ya usa `CajaCierreView.tsx`. Cancelar/Escape en el paso `auth` vuelve al paso `motivo` (preserva el texto tipeado); Cancelar/Escape en el paso `motivo` cierra todo el flujo.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react (jsdom) para tests de renderer.

**Spec:** `docs/specs/2026-09-28-anulacion-two-step-supervisor-auth-design.md`

---

### Task 1: Reescribir `AnulacionModal` (Retail) con TDD

**Files:**
- Modify: `apps/retail/src/renderer/views/pos/AnulacionModal.tsx`
- Test: `apps/retail/src/renderer/views/pos/__tests__/AnulacionModal.test.tsx`

- [ ] **Step 1: Reemplazar el contenido de test por la versión de 2 pasos**

Reemplazar todo el contenido de `apps/retail/src/renderer/views/pos/__tests__/AnulacionModal.test.tsx` por:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnulacionModal } from '../AnulacionModal';

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    venta: { anular: vi.fn().mockResolvedValue({}) },
  };
});

function avanzarAMotivo(motivo = 'Error de precio') {
  fireEvent.change(screen.getByPlaceholderText(/motivo/i), { target: { value: motivo } });
  fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
}

describe('AnulacionModal', () => {
  it('paso inicial: muestra campo motivo y no muestra credenciales de supervisor', () => {
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByPlaceholderText(/motivo/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/usuario supervisor/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña supervisor/i)).not.toBeInTheDocument();
  });

  it('llama onCancel al clickar Cancelar en el paso motivo', () => {
    const onCancel = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('llama onCancel al presionar Escape en el paso motivo', () => {
    const onCancel = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('muestra error si motivo está vacío y no avanza de paso', () => {
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByText(/el motivo es obligatorio/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/usuario supervisor/i)).not.toBeInTheDocument();
  });

  it('avanza al paso de credenciales cuando el motivo es válido', () => {
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    avanzarAMotivo();
    expect(screen.getByLabelText(/usuario supervisor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña supervisor/i)).toBeInTheDocument();
  });

  it('cancelar en el paso de credenciales vuelve al paso motivo preservando el valor', () => {
    const onCancel = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={onCancel} />);
    avanzarAMotivo('Error de precio');
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/motivo/i)).toHaveValue('Error de precio');
  });

  it('llama venta:anular con motivo y credenciales y luego onSuccess', async () => {
    const onSuccess = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={onSuccess} onCancel={vi.fn()} />);
    avanzarAMotivo('Error de precio');

    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'admin1234' } });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() => expect((window as any).ferreteria.venta.anular).toHaveBeenCalledWith({
      venta_id: 'v-1',
      motivo: 'Error de precio',
      supervisor_credenciales: { nombre_usuario: 'admin', password: 'admin1234' },
    }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('muestra error unificado de supervisor inválido del backend', async () => {
    (window as any).ferreteria.venta.anular = vi.fn().mockRejectedValue(new Error('SUPERVISOR_INVALIDO'));
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    avanzarAMotivo('Motivo');

    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() =>
      expect(screen.getByText(/usuario o contraseña incorrectos, o no es supervisor/i)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd apps/retail && pnpm exec vitest run --config vitest.config.ts src/renderer/views/pos/__tests__/AnulacionModal.test.tsx`
Expected: FAIL — el componente actual no tiene botón "Continuar" ni oculta las credenciales en el paso inicial (assertions de `queryByLabelText(...).not.toBeInTheDocument()` fallan porque hoy están siempre visibles).

- [ ] **Step 3: Reescribir `AnulacionModal.tsx` con el flujo de 2 pasos**

Reemplazar todo el contenido de `apps/retail/src/renderer/views/pos/AnulacionModal.tsx` por:

```tsx
import { useState } from 'react';
import { useEscapeToClose, SupervisorAuthModal } from '@core/ui';

type Props = {
  ventaId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

type Step = 'motivo' | 'auth';

export function AnulacionModal({ ventaId, onSuccess, onCancel }: Readonly<Props>) {
  const [motivo, setMotivo] = useState('');
  const [step, setStep] = useState<Step>('motivo');
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onCancel, step === 'motivo');

  function handleContinuar() {
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }
    setError(null);
    setStep('auth');
  }

  async function handleAuthConfirm({ nombre_usuario, password }: { nombre_usuario: string; password: string }) {
    await (globalThis as any).ferreteria.venta.anular({
      venta_id: ventaId,
      motivo: motivo.trim(),
      supervisor_credenciales: { nombre_usuario, password },
    });
    onSuccess();
  }

  if (step === 'auth') {
    return <SupervisorAuthModal onConfirm={handleAuthConfirm} onCancel={() => setStep('motivo')} />;
  }

  return (
    <div className="modal-overlay" role="dialog"> {/* NOSONAR */}
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Anular venta</span>
        </div>
        <div className="modal-body">
          <p className="text-muted text-sm">Esta acción es irreversible. Se revertirán stock y caja.</p>
          <div className="field">
            <label htmlFor="anulacion-motivo">Motivo</label>
            <input id="anulacion-motivo" className="input" type="text" placeholder="Motivo de anulación"
              value={motivo} onChange={e => { setMotivo(e.target.value); setError(null); }} autoFocus />
          </div>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn-danger" onClick={handleContinuar}>Continuar</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd apps/retail && pnpm exec vitest run --config vitest.config.ts src/renderer/views/pos/__tests__/AnulacionModal.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Confirmar que `VentaDetalleModal.test.tsx` sigue en verde (mockea `AnulacionModal` completo, no debería verse afectado)**

Run: `cd apps/retail && pnpm exec vitest run --config vitest.config.ts src/renderer/views/caja/__tests__/VentaDetalleModal.test.tsx`
Expected: PASS (sin cambios)

- [ ] **Step 6: Commit**

```bash
git add apps/retail/src/renderer/views/pos/AnulacionModal.tsx apps/retail/src/renderer/views/pos/__tests__/AnulacionModal.test.tsx
git commit -m "$(cat <<'EOF'
refactor(retail): AnulacionModal reusa SupervisorAuthModal en 2 pasos

Elimina el formulario de credenciales duplicado: el motivo se pide en
un primer paso propio del dominio y las credenciales de Supervisor
las pide SupervisorAuthModal de @core/ui sin modificar, replicando el
patrón ya usado en CajaCierreView. Unifica el mensaje de error de
SUPERVISOR_INVALIDO.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Reescribir `AnularProduccionModal` (Elaborados) con TDD

**Files:**
- Modify: `apps/elaborados/src/renderer/views/produccion/ProduccionView.tsx`
- Test: `apps/elaborados/src/renderer/views/produccion/ProduccionView.test.tsx`

- [ ] **Step 1: Actualizar el test de "Anular" al flujo de 2 pasos**

En `apps/elaborados/src/renderer/views/produccion/ProduccionView.test.tsx`, reemplazar el test `'"Anular" abre el modal y al enviar llama a produccion.anular con las credenciales de supervisor'` (líneas 105-123) por:

```tsx
  it('"Anular" abre el modal y al enviar llama a produccion.anular con las credenciales de supervisor', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('PR-C1-000001')).toBeInTheDocument());

    const filaConfirmada = screen.getByText('PR-C1-000001').closest('tr')!;
    fireEvent.click(within(filaConfirmada).getByRole('button', { name: /anular/i }));

    const dialogMotivo = screen.getByRole('dialog');
    fireEvent.change(within(dialogMotivo).getByLabelText(/motivo/i), { target: { value: 'Error de carga' } });
    fireEvent.click(within(dialogMotivo).getByRole('button', { name: /continuar/i }));

    const dialogAuth = screen.getByRole('dialog');
    fireEvent.change(within(dialogAuth).getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(within(dialogAuth).getByLabelText(/contraseña supervisor/i), { target: { value: 'secreta123' } });
    fireEvent.click(within(dialogAuth).getByRole('button', { name: /^autorizar$/i }));

    await waitFor(() => expect(mockAnular).toHaveBeenCalledWith({
      id: '1',
      motivo: 'Error de carga',
      supervisor_credenciales: { nombre_usuario: 'admin', password: 'secreta123' },
    }));
  });

  it('cancelar en el paso de credenciales de "Anular" vuelve al paso motivo preservando el valor', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('PR-C1-000001')).toBeInTheDocument());

    const filaConfirmada = screen.getByText('PR-C1-000001').closest('tr')!;
    fireEvent.click(within(filaConfirmada).getByRole('button', { name: /anular/i }));

    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Error de carga' } });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.getByLabelText(/usuario supervisor/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(mockAnular).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/motivo/i)).toHaveValue('Error de carga');
    expect(screen.queryByLabelText(/usuario supervisor/i)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd apps/elaborados && pnpm exec vitest run --config vitest.config.ts src/renderer/views/produccion/ProduccionView.test.tsx`
Expected: FAIL — hoy no existe un botón "Continuar" en `AnularProduccionModal` (todo está en un único paso) y las credenciales están siempre visibles.

- [ ] **Step 3: Reescribir `AnularProduccionModal` dentro de `ProduccionView.tsx`**

En `apps/elaborados/src/renderer/views/produccion/ProduccionView.tsx`:

1. Cambiar la línea de import (línea 2) de:

```tsx
import { useAuth, useEscapeToClose, useToast } from '@core/ui';
```

a:

```tsx
import { useAuth, useEscapeToClose, useToast, SupervisorAuthModal } from '@core/ui';
```

2. Reemplazar toda la función `AnularProduccionModal` (líneas 146-204) por:

```tsx
function AnularProduccionModal({ produccion, onClose, onAnular }: {
  produccion: ProduccionRow;
  onClose: () => void;
  onAnular: (payload: { id: string; motivo: string; supervisor_credenciales: { nombre_usuario: string; password: string } }) => Promise<void>;
}) {
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [step, setStep] = useState<'motivo' | 'auth'>('motivo');
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose, step === 'motivo');

  function handleContinuar(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }
    setError(null);
    setStep('auth');
  }

  async function handleAuthConfirm({ nombre_usuario, password }: { nombre_usuario: string; password: string }) {
    await onAnular({
      id: produccion.id,
      motivo: motivo.trim(),
      supervisor_credenciales: { nombre_usuario, password },
    });
    toast.success('Producción anulada');
    onClose();
  }

  if (step === 'auth') {
    return <SupervisorAuthModal onConfirm={handleAuthConfirm} onCancel={() => setStep('motivo')} />;
  }

  return (
    <div role="dialog" className="modal-overlay">
      <form className="modal" onSubmit={handleContinuar}>
        <div className="modal-header"><span className="modal-title">Anular producción {produccion.numero}</span></div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="anular-motivo">Motivo *</label>
            <input id="anular-motivo" className="input" type="text" required value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setError(null); }} autoFocus />
          </div>
          <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>Requiere autorización de un Supervisor.</p>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">Continuar</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd apps/elaborados && pnpm exec vitest run --config vitest.config.ts src/renderer/views/produccion/ProduccionView.test.tsx`
Expected: PASS (8 tests: los 6 originales + los 2 nuevos/reescritos de "Anular")

- [ ] **Step 5: Commit**

```bash
git add apps/elaborados/src/renderer/views/produccion/ProduccionView.tsx apps/elaborados/src/renderer/views/produccion/ProduccionView.test.tsx
git commit -m "$(cat <<'EOF'
refactor(elaborados): AnularProduccionModal reusa SupervisorAuthModal en 2 pasos

Mismo refactor que AnulacionModal (Retail): el motivo se pide en un
paso propio y las credenciales las pide SupervisorAuthModal de
@core/ui sin modificar. De paso corrige el mensaje de
SUPERVISOR_INVALIDO, que antes usaba `.includes(...)` en vez de
comparación exacta, divergiendo del mensaje del resto de la app.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Verificación completa (suites + navegación manual)

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Typecheck del monorepo**

Run: `pnpm typecheck`
Expected: sin errores en ninguno de los packages/apps tocados.

- [ ] **Step 2: Suite completa de Retail**

Run: `cd apps/retail && pnpm test`
Expected: PASS (typecheck + vitest run + test-node.cjs --serial, todo en verde).

- [ ] **Step 3: Suite completa de Elaborados**

Run: `cd apps/elaborados && pnpm test`
Expected: PASS (typecheck + vitest run + test-node.cjs --serial, todo en verde).

- [ ] **Step 4: Navegación manual en Retail**

Run: `pnpm dev` (desde la raíz del repo, levanta `ferreteria-client`)

Recorrido: Caja → Dashboard → abrir una venta confirmada → botón "Cancelar venta" →
1. Dejar el motivo vacío y clickear "Continuar" → debe mostrar "El motivo es obligatorio" y no avanzar.
2. Completar el motivo → "Continuar" → debe mostrar el formulario de usuario/contraseña de Supervisor.
3. Clickear "Cancelar" en ese paso → debe volver al paso de motivo con el texto preservado.
4. Avanzar de nuevo, ingresar una contraseña incorrecta → debe mostrar "Usuario o contraseña incorrectos, o no es Supervisor."
5. Ingresar credenciales válidas de un Supervisor → la venta debe anularse (badge ANULADA en el detalle).

Detener el server (`Ctrl+C` en la terminal donde corre `pnpm dev`) al terminar.

- [ ] **Step 5: Navegación manual en Elaborados**

Run: `pnpm dev:elaborados` (desde la raíz del repo, levanta `elaborados-client`)

Recorrido: Producción → fila con estado "Confirmada" → botón "Anular" → repetir los mismos 5 pasos del punto anterior (motivo vacío, completar motivo, cancelar vuelve a motivo, contraseña incorrecta, éxito) y verificar que la fila pasa a estado "Anulada".

Detener el server al terminar.

- [ ] **Step 6: Confirmar estado limpio del working tree**

Run: `git status`
Expected: working tree limpio (todos los cambios ya commiteados en los Tasks 1 y 2); si `pnpm dev`/`pnpm typecheck` generaron artefactos no versionados (p. ej. `.vite/`), confirmar que están en `.gitignore` y no aparecen como untracked relevantes.
