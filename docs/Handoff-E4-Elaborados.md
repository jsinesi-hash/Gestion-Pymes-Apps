# Traspaso — Elaborados E4 (para retomar en otra sesión)

> **HISTÓRICO (2026-11-03).** E4 se completó con los ADR-102…106 (cierre en ADR-112) y la «Deuda previa» de abajo se
> auditó en el ADR-144: las cinco entradas ya estaban resueltas en el código. Se conserva por el contexto de
> decisiones y las convenciones; no es una lista de pendientes.

**Fecha:** 2026-10-14 · **Punto de partida:** `main` con E1–E3 completos (ADR-091…101). Último merge: PR #13
(E3d-2). No hay ramas de trabajo abiertas.

## Qué sigue: E4 — gestión
Según el spec de la familia (`docs/superpowers/specs/2026-09-22-elaborados-heladeria-design.md`: §3 tabla de planes,
§4.3 modelo, §5.2/5.3 promociones al core, §7.1 permisos) y el requisito R6 del cliente (el primer corte incluye
**compras de insumos, listas de precios y reportes**):

1. **Compras de insumos.** Tablas `compra` (`CP-C1-000001`, proveedor, comprobante del proveedor en texto libre,
   `total_centavos`, estado `confirmada|anulada`) y `compra_item` (artículo, cantidad, costo unitario, subtotal).
   Confirmar = `movimiento_articulo` de entrada (`motivo: 'compra'`, ya existe en el enum) con **costo promedio
   ponderado** (`costoPromedioEntrada` en `main/domain/costo.ts`; con stock ≤ 0 el costo nuevo es el que entra).
   Anular una compra exige Supervisor (`verificarSupervisor`). Permisos propuestos: `compra.registrar`
   (Operador + Supervisor). Fuera de alcance: OC/recepción parcial.
2. **Listas de precios.** `lista_precio` (header) **pasa a `@core/db`** y `cliente.lista_precio_id` vuelve a ser FK
   dura (cierra la sub-decisión de soft FK de ADR-091); `producto_venta_precio` (SCD tipo 2, índice único parcial
   `WHERE fecha_hasta IS NULL` solo en la migración) en la app; `resolverListaEfectiva` y hook `onListaCreada` en el
   core. `venta:cotizar`/`confirmar` deben resolver el precio por la **lista efectiva del cliente** (hoy el precio es
   `producto_venta.precio_centavos`): el payload necesitará `cliente_id` en `cotizar`. Los recargos premium de sabor
   **no** varían por lista. Conectar los slots `cargarListasPrecio` de `ClienteForm`/`ClienteDetalle` (core-ui).
3. **Reportes y export.** Ventas por período/medio de pago/producto/sabor, stock negativo (el reporte que R2
   prometió), consumo y margen (precio vs costo). Registry de exportadores del core
   (`registrarExportador(clave, queryAll, permiso)`). **Todo punto de lectura debe filtrar el estado de `venta`
   explícitamente** (`en_espera` y `descartada` no cuentan).
4. **CRUD de proveedor** con hook `onProveedorActualizado` (Retail registra ahí los lotes de precio vía
   `producto_proveedor`).

**Cómo arrancar (acordado con el usuario para E3, repetible):** `superpowers:brainstorming` → spec → plan escrito →
`superpowers:subagent-driven-development`. E4 es grande: **partirlo en planes/PRs chicos** (sugerencia: compras →
listas de precio (con la promoción al core y Retail como oráculo) → reportes/export → proveedores), cada uno
mergeable y con su ADR (**el próximo número libre es 102**). Preguntas para el brainstorm: partición exacta,
qué reportes necesita realmente la heladería, si las compras llevan IVA/comprobante estructurado, y cómo se
gestionan los proveedores desde Elaborados.

## Deuda previa — RESUELTA (ver ADR-144)
- **Editar sabores tras la primera venta probablemente rompe:** `grupoModificadorOpcionSetHandler` (E2) borra y
  reinserta las opciones con FK activas (`venta_linea_modificador` las referencia). Arreglar con upsert por id /
  baja lógica **antes de uso real**.
- `STOCK_INSUFICIENTE:<nombre>` ya viaja desde el backend pero el mensaje de `core-ui/lib/errores.ts` no muestra el
  nombre; los códigos de dominio de `ProduccionView` no están en `errores.ts` (con el cambio de
  `SupervisorAuthModal` hoy caen al mensaje genérico).
- Ticket de Retail: muestra un solo medio de pago (el resultado de `venta:confirmar` no trae `venta_pago`).
- `ventaCatalogoHandler` hace consultas en cascada (1 + P×(1+2G)); faltan índices en `venta_linea.venta_id` y
  `venta_linea_modificador.venta_linea_id`; `crearImpresorHtml` no cierra la ventana si `loadURL` rechaza.
- `ClienteSelector` guarda el nombre del cliente en estado interno (hoy el POS le pasa `nombre`).

## Convenciones que no se deben romper
- `venta.descuento_global` es un **porcentaje** (ambas apps); el renderer **no calcula precios** (todo viene de
  `venta:cotizar`); dinero en **centavos** en tablas nuevas; `exactOptionalPropertyTypes` activo (spreads
  condicionales); todo handler async de UI lleva `catch` + `traducirError` con `role="alert"`; el core nunca
  depende de una app; mover al core por regla de tres con Retail como oráculo (sus tests no se editan).

## Entorno (gotchas)
- `git pull/push` pelado falla (Git Credential Manager cachea la cuenta equivocada): usar
  `git -c credential.helper= -c credential.helper='!gh auth git-credential' <pull|push …>`; cuenta activa de `gh`:
  `jsinesi-hash`. Los PR se mergean con `gh pr merge --rebase --delete-branch` y luego `pull --ff-only`.
- Tests de main bajo Electron: `node scripts/test-node.cjs [--serial] <ruta>` (NMV 128; si falla con "Could not
  locate the bindings file": `pnpm rebuild:electron`). Los gates largos (suites completas en serie) los corre quien
  coordina, no un subagente.
- `docs/superpowers/` está **gitignoreado**: los specs y planes de E1–E3 existen solo en la máquina de quien los
  escribió. El resumen de cada decisión vive en los ADR 091–101 y en `Estado.md`.
- Seeds de Elaborados: `pnpm seed:dev:elaborados` desde la raíz (app cerrada; usa el `dist` de `@core/*`: si se
  tocó `packages/*/src`, `pnpm -r build` antes).
- Conteos de referencia al cierre de E3 (para detectar regresiones): core-ui 40 · Retail renderer 925 / main 1598 ·
  Elaborados renderer 174 / main 160.
