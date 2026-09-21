# ESTADO DEL PROYECTO — Sistema de Gestión de Ferretería

> Fuente de verdad sobre qué está hecho, qué está en curso y qué viene después.
> Actualizar al completar cada fase o tomar una decisión de diseño significativa.

**Última actualización:** 2026-07-03
**Tests actuales:** 725 (227 renderer + 498 node process) — todos verdes

---

## Release actual: R3 (Compras y Crédito) — en curso

---

## Fases completadas (R1 completo + R3 parcial)

### R1 — Núcleo local

| Fase | Descripción | Tests | Estado |
|------|-------------|-------|--------|
| P1.0 | Bootstrap monorepo: Electron + React + SQLite + Drizzle + vitest, login/sesión, RBAC seed | — | ✅ |
| P1.1 | Esquema completo (migración 0000_init.sql): todas las tablas de R1 | — | ✅ |
| P1.2 | ABM Ubicaciones (UbicacionesDeposito, handler CRUD) | — | ✅ |
| P1.3 | ABM Catálogo: Categorías, Marcas, Productos (lista + detalle + precio) | — | ✅ |
| P1.4 | Stock: MovimientoStock, Existencias, StockListado, modal entrada | 128 | ✅ |
| P1.5 | Localización por QR: escaneo en input, ruta `/localizar`, handler | 157 | ✅ |
| P1.6 | Listas de precios: ABM + motor precio + PrecioPanel en ProductoDetalle | 219 | ✅ |
| P1.7 | Caja: apertura, movimientos, cierre con autorización Supervisor | 244 | ✅ |
| P1.8 | POS/Venta: venta atómica, anulación, hook usePosSession, selector de cliente | 284 | ✅ |
| P1.9 | Importación masiva CSV: wizard 3 pasos, 5 entidades, guard Supervisor | 328 | ✅ |
| P1.10 | Reposición sugerida: vista `/stock/reabastecimiento`, guard doble | 350 | ✅ |
| P1.11 | Dashboard local: bento layout Supervisor, 3 handlers IPC paralelos | 375 | ✅ |
| P1.12 | Exportación CSV/XLSX: 3 capas, 7 entidades, ExportarButton en 4 vistas | 308* | ✅ |

*308 al momento de implementar P1.12; luego subió a 669+ por fixes de calidad.

### Iteraciones de mantenimiento

| Iteración | Descripción | Estado |
|-----------|-------------|--------|
| Iter-01 | 13 bug fixes: POS cursor, Kardex signo, Stock redesign, Config passwords | ✅ |
| Iter-02 | Importación enriquecida: 16 columnas CSV, UPDATE con stock condicional y CPP | ✅ |
| Sonar-01 | Correcciones masivas SonarCloud: 6 BLOCKERs + CC + quality issues (93 archivos) | ✅ |

### R3 — Compras y Crédito (en curso)

| Fase | Descripción | Estado |
|------|-------------|--------|
| P3.0 | Migración 0009: campos domicilio extendido cliente/proveedor | ✅ |
| P3.1 | Utils validación/formato documentos (formatDocumento, validarDocumento, etc.) | ✅ |
| P3.2 | Fix DireccionGeo: dropdown localidad via React portal | ✅ |
| P3.3 | ProveedorForm mejorado: calle/numero/aclaracion, tel adicional, máscara CUIT | ✅ |
| P3.4 | ClienteForm mejorado: ídem Proveedor | ✅ |
| P3.5 | POS: selector de cliente, CCC como forma de pago | ✅ |
| P3.6 | Catálogo geográfico (provincias/departamentos/localidades) — ADR-024 | ✅ |
| P3.7 | SKU interno con check digit Luhn — ADR-025 | ✅ |
| P-ADR027 | Impresión de etiquetas por lote (ADR-027) | ✅ |

---

## Próximas fases (backlog confirmado)

- **R3** compras: Órdenes de Compra (ADR-017), recepción de mercadería (ADR-018), cuenta corriente clientes
- **R2** fiscal: facturación AFIP/ARCA (ADR-013 pendiente), CAE, comprobantes A/B/C
- **R4** nube + sync: backend Node + PostgreSQL, outbox, conflictos (ADR-012)
- **R5** reportes consolidados, preparación multi-sucursal

---

## ADR abiertos

| ADR | Título | Estado |
|-----|--------|--------|
| ADR-013 | Ubicación integración fiscal (cliente vs nube) | Propuesto — decidir en R2 |

## ADR cerrados (no reabrir sin nuevo ADR)

ADR-001 a ADR-012, ADR-014 a ADR-016, ADR-017 a ADR-025, ADR-027

---

## Convenciones técnicas vigentes

- **NMV:** Electron 32 = NMV 128; Node 24 sistema = NMV 137. `pnpm rebuild:electron` antes de dev, `pnpm rebuild:node` antes de tests.
- **Tests renderer:** `vitest run` bajo jsdom (rápidos, sin módulos nativos).
- **Tests main:** `node scripts/test-node.cjs` bajo Electron (`ELECTRON_RUN_AS_NODE=1`).
- **IPC:** todo bajo `window.ferreteria.<namespace>.*`. Namespaces: `catalogo`, `stock`, `caja`, `pos`, `precios`, `config`, `backup`, `restore`, `geo`, `export`, `importar`, `etiquetas` (nuevo).
- **Precios:** centavos en toda la lógica; formateo solo en render.
- **Migraciones:** `packages/client/src/main/db/migrations/`. Última: `0009_personas_v2.sql`.
- **Permisos:** guard doble (renderer + IPC handler). Permiso `import.masiva` solo Supervisor.
