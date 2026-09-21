# PERF-3 — Editor de permisos por rol: análisis y opciones

> Documento de trabajo para el **futuro ADR de permisos**. Consolida lo evaluado y analizado
> durante la Fase 3 (auditoría UX/Seguridad, ítem 5). **Decisión de producto abierta** — no se
> cierra sin confirmación (CLAUDE.md §11). Mockups asociados:
> `docs/perf3-permisos-mockup-opcion-B.html` (opción B, editable).

**Fecha:** 2026-09-10 · **Estado:** análisis, sin decidir · **Relacionados:** ADR-008 (roles),
ADR-027 (baja del PIN), ADR-081/082 (Fase 3), CLAUDE.md §5/§8.

---

## 1. Contexto y problema

Los permisos por rol son **datos** (tabla `rol_permiso`, N:M entre `rol` y `permiso`), pero hoy
solo se cambian **en código**: los arrays `PERMISOS` y `OPERADOR_PERMISOS` en
`src/main/auth/seed.ts`. El Supervisor no tiene forma de ver ni ajustar quién puede qué desde la
app; depende de la matriz documentada en CLAUDE.md §8, que además ya quedó desactualizada (dice
28 permisos; hoy son **29** — `precio.aprobar` de ADR-049 se sumó después).

PERF-3 (Fase 3, ítem 5) propone "pantalla para editar permisos por rol desde la UI". Es una
**decisión de producto**, no solo técnica, por dos razones:

1. Son **2 roles de sistema** (`es_sistema = true`): Operador y Supervisor. No hay roles
   custom. La flexibilidad que aporta un editor es limitada por diseño.
2. Tocar permisos toca **invariantes de seguridad**: no dejar al sistema sin administrador, no
   romper flujos esenciales, y no poder desactivar al último Supervisor (ADR-008).

## 2. La trampa técnica central: `runSeed` es aditivo

`runSeed` corre en **cada arranque** y es **aditivo**: reinserta en `rol_permiso` todo lo que
declaran `PERMISOS`/`OPERADOR_PERMISOS` si falta. Consecuencia directa:

> Si un editor de UI **borra** de `rol_permiso` un permiso que el seed otorga, al siguiente
> arranque `runSeed` lo **vuelve a agregar**. La edición no persiste.

Por eso "editar permisos" **no es** simplemente insertar/borrar filas en `rol_permiso`. Requiere
una capa que sobreviva al seed (ver opción B).

Además, hay **tests que afirman el conteo exacto** de permisos por rol
(`auth/__tests__/seed.test.ts`, `ipc/__tests__/auth.ipc.test.ts`). Cualquier cambio al modelo de
permisos obliga a revisarlos.

## 3. Opciones evaluadas

### Opción A — Matriz RBAC de solo lectura

Pantalla nueva en el grupo **Administración** (gateada por `usuario.administrar`, solo
Supervisor) que muestra una tabla **roles × permisos** leída en vivo de `rol_permiso`. Nada
editable.

- **Alcance:** 1 handler de lectura (`join rol × permiso × rol_permiso`) + 1 pantalla React + las
  3 cosas de navegación (ruta en `routes/index.tsx`, ítem en `NAV`, entrada en `CRUMBS`).
- **Sin migración. Sin tocar `seed.ts`. Sin escritura → sin riesgo de romper RBAC.**
- **Valor:** el Supervisor ve quién puede qué sin depender del doc; base visual para B.
- **Costo:** bajo. **Riesgo:** casi nulo.

### Opción B — Edición acotada con guardas

Igual que A pero con **toggles** por rol/permiso, barra de "cambios sin guardar" (Guardar /
Descartar) y **guardas de invariante** (candados en permisos intocables). Mockup:
`docs/perf3-permisos-mockup-opcion-B.html`.

Para que la edición **persista** pese al seed aditivo, hacen falta:

1. **Tabla de overrides** (p. ej. `rol_permiso_override` con `rol_id`, `permiso_id`, `otorgado`
   bool) → **migración aditiva** (retrocompatible, ADR-042).
2. **`runSeed` refactorizado** para que el estado final = **seed base + overrides** (siembra la
   base y luego aplica los overrides), de modo que la UI no "mienta" al reiniciar.
3. **Guardas de invariante** (reglas de negocio nuevas, con tests):
   - Ningún cambio puede dejar la capacidad de administrar (`usuario.administrar`) sin al menos
     un rol que la tenga → no bloquearse fuera de la administración.
   - Definir el conjunto de **permisos intocables** por flujo esencial (candidatos:
     `venta.crear`, `caja.operar`, `producto.consultar`) y bloquearlos en la UI.
   - Preservar la invariante existente "no desactivar al último Supervisor" (ADR-008).
4. **Revisar los tests de conteo exacto** de permisos: pasan a depender de overrides.

- **Valor:** flexibilidad real de RBAC sin recompilar.
- **Costo:** alto (migración + refactor de seed + guardas + tests + UI con estado).
- **Riesgo:** alto — es el sistema de permisos; un error deja al usuario sin acceso a admin.
- **Recomendación:** **ADR y sesión dedicados**. No colgar de un ADR de otra temática.

### Opción C — No hacerlo

Dejar los permisos solo-código y documentar el motivo: 2 roles de sistema, seed aditivo, ROI
bajo frente al riesgo. La matriz vive en CLAUDE.md §8 (mantenerla al día — corregir a 29
permisos).

## 4. Nombres amigables (decisión de diseño transversal, aprobada)

Independientemente de A/B/C, mostrar códigos como `config.fiscal` al usuario es malo. Se acordó
**centralizar un mapa `codigo → etiqueta amigable`** (estilo opción de menú) como fuente única,
reutilizable por cualquier pantalla que muestre permisos. Etiquetas propuestas:

| Código | Etiqueta amigable |
|--------|-------------------|
| `venta.crear` | Vender (POS) |
| `venta.anular` | Anular ventas |
| `precio.override` | Modificar precio en la venta |
| `caja.operar` | Abrir/cerrar caja y movimientos |
| `stock.entrada` | Registrar entradas de stock |
| `stock.ajustar` | Ajustar stock (conteo/merma) |
| `producto.crear` | Crear productos |
| `producto.editar` | Editar productos |
| `producto.consultar` | Consultar el catálogo |
| `compra.recibir` | Recibir compras |
| `proveedor.pagar` | Pagar a proveedores |
| `proveedor.gestionar` | Gestionar proveedores y órdenes de compra |
| `ctacte.cobrar` | Cobrar cuenta corriente |
| `precio.aprobar` | Aprobar lotes de precios |
| `remito.crear` | Emitir remitos |
| `remito.conformar` | Conformar remitos |
| `remito.anular` | Anular remitos |
| `transportista.gestionar` | Gestionar transportistas |
| `presupuesto.crear` | Crear presupuestos |
| `presupuesto.emitir` | Emitir presupuestos |
| `presupuesto.anular` | Anular presupuestos |
| `export.basico` | Exportar datos (básico) |
| `export.supervisor` | Exportar datos (completo) |
| `dashboard.ver` | Ver dashboard y reportes |
| `import.masiva` | Importación masiva |
| `usuario.administrar` | Administrar usuarios |
| `config.fiscal` | Configuración fiscal y parámetros |
| `backup.crear` | Crear backups |
| `backup.restaurar` | Restaurar backups |

> El mapa se implementa con un **test de cobertura** que falla si algún código de `PERMISOS` no
> tiene etiqueta (previene drift al agregar permisos). Es groundwork: cuando se encare A o B, la
> pantalla lo consume directamente.

## 5. Recomendación

- **Nombres amigables:** centralizar el mapa ya (aprobado), con test de cobertura.
- **A vs B vs C:** decisión del usuario. A es barata y segura (podría entrar en un ADR chico o
  junto a otro trabajo de admin). B merece su **propio ADR y sesión** por la migración + refactor
  de seed + guardas. C es válido dado que son 2 roles de sistema.
- **Estado actual (2026-09-10):** el usuario difirió la pantalla de permisos a un **ADR futuro
  dedicado**; se dejan este análisis y el mockup B como insumos.
