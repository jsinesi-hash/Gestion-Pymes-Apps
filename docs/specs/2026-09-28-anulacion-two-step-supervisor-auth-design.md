# Spec: Reusar SupervisorAuthModal en las anulaciones (Retail y Elaborados)

**Fecha:** 2026-09-28
**Estado:** Aprobado — listo para implementar

---

## Contexto

`AnulacionModal` (Retail, `apps/retail/src/renderer/views/pos/AnulacionModal.tsx`) y
`AnularProduccionModal` (Elaborados, dentro de
`apps/elaborados/src/renderer/views/produccion/ProduccionView.tsx`) reimplementan cada
uno, desde cero, el mismo formulario de "motivo + credenciales de Supervisor" que ya
existe como componente reusable en `@core/ui`:
`packages/core-ui/src/views/caja/SupervisorAuthModal.tsx` (consumido hoy por
`CajaCierreView.tsx`).

Duplicación concreta detectada por un review de calidad durante Elaborados E2 (Task 17):
- Ambos modales tienen sus propios campos `nombre_usuario`/`password` y su propia
  validación.
- El mensaje de error para `SUPERVISOR_INVALIDO` está duplicado y **diverge**:
  `SupervisorAuthModal` y `AnulacionModal` usan comparación exacta (`msg ===
  'SUPERVISOR_INVALIDO'`); `AnularProduccionModal` usa `msg.includes(...)`.

`CajaCierreView.tsx` ya resuelve un problema equivalente (acción sensible que requiere
motivo/observaciones + autorización de Supervisor) con un patrón de **dos pasos**: la
vista junta sus propios datos (`Observaciones`) y luego abre `SupervisorAuthModal` sin
modificar, solo para pedir credenciales. Este spec extiende ese mismo patrón a los dos
modales de anulación.

---

## Decisiones de diseño

- **Sin cambios en `@core/ui`.** `SupervisorAuthModal` se reusa tal cual existe hoy —
  mismas props (`onConfirm`, `onCancel`), mismo texto, mismo botón "Autorizar", mismo
  mensaje unificado para `SUPERVISOR_INVALIDO`.
- **Cada modal de anulación pasa a ser una máquina de 2 estados** (`'motivo' | 'auth'`),
  sin componente compartido nuevo para el paso de motivo: son ~15 líneas por app con
  copy propio (título, texto explicativo, color de botón). Generalizarlo repetiría el
  mismo problema que se está resolviendo (parametrizar en exceso un componente por 2
  usos).
  - **Paso `motivo`**: el modal actual tal cual (título, texto de advertencia, campo
    Motivo), pero el botón de acción pasa a decir **"Continuar"** en vez de "Anular
    venta"/"Anular" — ese click todavía no ejecuta la acción destructiva, solo avanza a
    pedir credenciales. Dejar el label actual sería engañoso.
  - **Paso `auth`**: renderiza `<SupervisorAuthModal onConfirm={...} onCancel={...} />`.
    `onConfirm` recibe `{ nombre_usuario, password }`, llama al bridge IPC combinando
    esas credenciales con el `motivo` guardado del paso anterior, y en éxito dispara
    `onSuccess` (Retail) / `toast.success(...)` + `onClose` (Elaborados).
- **Cancelar/Escape en el paso `auth` vuelve al paso `motivo`** (no cierra todo el
  modal), preservando el motivo ya tipeado. Esto replica 1:1 el comportamiento ya
  existente de `CajaCierreView` (`onCancel={() => setAuthModal(false)}` vuelve a la
  vista de cierre con las Observaciones intactas, no cierra la pantalla). Se logra
  pasando `onCancel={() => setStep('motivo')}` a `SupervisorAuthModal` en vez del
  `onCancel`/`onClose` externo.
  - Consecuencia aceptada: para cerrar todo el flujo desde el paso `auth` hace falta
    cancelar dos veces (una vuelve a `motivo`, la siguiente cierra). Mismo trade-off que
    ya acepta `CajaCierreView`.
- **Cancelar/Escape en el paso `motivo`** sigue llamando al `onCancel`/`onClose` externo
  y cierra todo el modal — sin cambios respecto al comportamiento actual.
- **Efecto colateral positivo:** al delegar la traducción de `SUPERVISOR_INVALIDO` a
  `SupervisorAuthModal`, el mensaje de error queda unificado en ambas apps
  (`"Usuario o contraseña incorrectos, o no es Supervisor."`), resolviendo la
  divergencia de mensajes detectada en el review.

---

## Cambios por archivo

### 1. `apps/retail/src/renderer/views/pos/AnulacionModal.tsx`

Reescribir como máquina de 2 estados. Firma pública sin cambios: `{ ventaId, onSuccess,
onCancel }`.

```typescript
type Props = { ventaId: string; onSuccess: () => void; onCancel: () => void };

// estado interno: motivo, step ('motivo' | 'auth'), error
// paso 'motivo': igual al modal actual, botón "Continuar" (antes "Anular venta")
//   - valida motivo no vacío antes de avanzar a 'auth' (mismo mensaje de error que hoy)
// paso 'auth': <SupervisorAuthModal onConfirm={handleAuthConfirm} onCancel={() => setStep('motivo')} />
//   - handleAuthConfirm({ nombre_usuario, password }) llama
//     ferreteria.venta.anular({ venta_id, motivo: motivo.trim(), supervisor_credenciales })
//     y en éxito llama onSuccess()
// useEscapeToClose(onCancel, step === 'motivo') — Escape en paso motivo cierra todo;
//   en paso auth, el Escape lo maneja SupervisorAuthModal internamente (vuelve a motivo)
```

`import { SupervisorAuthModal } from '@core/ui';` se agrega; el resto de imports no
cambia.

### 2. `apps/elaborados/src/renderer/views/produccion/ProduccionView.tsx`

Misma transformación en la función interna `AnularProduccionModal`. Firma sin cambios:
`{ produccion, onClose, onAnular }`.

```typescript
// paso 'motivo': igual al modal actual (título "Anular producción {numero}", campo
//   Motivo, texto "Requiere autorización de un Supervisor."), botón "Continuar"
//   (antes "Anular")
// paso 'auth': <SupervisorAuthModal onConfirm={handleAuthConfirm} onCancel={() => setStep('motivo')} />
//   - handleAuthConfirm({ nombre_usuario, password }) llama
//     onAnular({ id: produccion.id, motivo: motivo.trim(), supervisor_credenciales })
//     y en éxito: toast.success('Producción anulada') + onClose()
```

Se agrega `SupervisorAuthModal` al import ya existente de `'@core/ui'` (junto a
`useAuth`, `useEscapeToClose`, `useToast`).

---

## Tests

### `apps/retail/src/renderer/views/pos/__tests__/AnulacionModal.test.tsx`

Reescribir los casos existentes para el flujo de 2 pasos (TDD, RED-GREEN):

| # | Escenario | Assertion clave |
|---|-----------|----------------|
| 1 | Paso inicial | Muestra campo Motivo; NO muestra campos de usuario/contraseña |
| 2 | Cancelar en paso motivo | Click "Cancelar" → `onCancel` llamado |
| 3 | Escape en paso motivo | `onCancel` llamado |
| 4 | Motivo vacío | Click "Continuar" sin motivo → error "El motivo es obligatorio"; no avanza de paso |
| 5 | Avanza a paso auth | Motivo válido + "Continuar" → aparecen campos "Usuario Supervisor"/"Contraseña Supervisor" (de `SupervisorAuthModal`) |
| 6 | Cancelar en paso auth vuelve a motivo | En paso auth, click "Cancelar" → reaparece el campo Motivo con el valor preservado; `onCancel` externo NO llamado |
| 7 | Flujo completo exitoso | Motivo → Continuar → credenciales → Autorizar → `ferreteria.venta.anular` llamado con `{venta_id, motivo, supervisor_credenciales}`; luego `onSuccess()` |
| 8 | Error de backend `SUPERVISOR_INVALIDO` | Mensaje unificado `"Usuario o contraseña incorrectos, o no es Supervisor."` visible en paso auth |

`VentaDetalleModal.test.tsx` mockea `AnulacionModal` completo (`vi.mock('../../pos/AnulacionModal', ...)`) — no requiere cambios.

### `apps/elaborados/src/renderer/views/produccion/ProduccionView.test.tsx`

El único test que ejercita `AnularProduccionModal` ("Anular" abre el modal y al enviar
llama a produccion.anular...") se reescribe con el mismo flujo de 2 pasos: click
"Anular" en la fila → campo Motivo → "Continuar" → aparecen campos de
`SupervisorAuthModal` → completar → "Autorizar" → assert `mockAnular` llamado con
`{id, motivo, supervisor_credenciales}`.

---

## Verificación manual (no reemplazable por tests)

Por §Navegación de `CLAUDE.md`: correr `pnpm dev` en cada app y navegar como lo haría el
usuario.

- **Retail:** Caja → Dashboard → abrir una venta confirmada → "Cancelar venta" → probar
  motivo vacío (error), completar motivo → Continuar → cancelar credenciales (vuelve a
  motivo con el texto preservado) → reabrir credenciales → probar contraseña incorrecta
  (mensaje unificado) → completar con Supervisor válido → confirma anulación.
- **Elaborados:** Producción → fila con estado "Confirmada" → "Anular" → mismo recorrido
  (motivo vacío, Continuar, cancelar vuelve a motivo, contraseña incorrecta, éxito).

---

## Archivos afectados (resumen)

| Archivo | Acción |
|---------|--------|
| `apps/retail/src/renderer/views/pos/AnulacionModal.tsx` | Reescribir (2 pasos, reusa `SupervisorAuthModal`) |
| `apps/retail/src/renderer/views/pos/__tests__/AnulacionModal.test.tsx` | Reescribir casos de test |
| `apps/elaborados/src/renderer/views/produccion/ProduccionView.tsx` | Reescribir `AnularProduccionModal` (2 pasos) |
| `apps/elaborados/src/renderer/views/produccion/ProduccionView.test.tsx` | Reescribir caso de test de "Anular" |

**Sin cambios:** `packages/core-ui/src/views/caja/SupervisorAuthModal.tsx`,
`CajaCierreView.tsx`, preload/bridge de ninguna de las dos apps, handlers IPC.
