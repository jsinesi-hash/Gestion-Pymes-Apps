# Ferretería — Sistema de Gestión

Sistema de gestión integral para una ferretería, **offline-first**: cliente de escritorio
(Electron + React + SQLite como fuente de verdad local) con sincronización a nube planificada
(Node.js + PostgreSQL, Release 4). Cubre POS, inventario con QR y lector 1D/2D, caja,
compras, cuentas corrientes y facturación electrónica.

Stack TypeScript de punta a punta. Dos roles: Operador y Supervisor. Entregas incrementales
en cinco releases, cada uno desplegable y en verde.

---

## Cómo arrancar el proyecto

### Requisitos

- **Node.js** 22.x — ver `.nvmrc` para la versión exacta
- **pnpm** 9.x: `npm install -g pnpm`
- Windows, macOS o Linux con soporte Electron

### Instalación

```bash
git clone https://github.com/jsinesi-hash/ferreteria-app.git
cd ferreteria-app
pnpm install
```

### Rebuild del módulo nativo de SQLite

`better-sqlite3` es un módulo nativo que debe compilarse contra la versión de Node
que lo va a usar. Electron 32 bundlea Node 22, que puede diferir del Node del sistema.

**Antes de `pnpm dev` (para Electron):**
```bash
pnpm --filter ferreteria-client rebuild:electron
```

**Antes de `pnpm test` (para el Node del sistema):**
```bash
pnpm --filter ferreteria-client rebuild:node
```

Si el Node del sistema es Node 22.x, no hay conflicto y ningún rebuild extra es necesario.

### Levantar en modo desarrollo

```bash
pnpm --filter ferreteria-client dev
```

### Correr tests

```bash
pnpm --filter ferreteria-client test
```

### Seed de datos de ejemplo

Carga 35 productos, 18 ubicaciones, 8 clientes, 3 proveedores, ventas y movimientos de caja
para tener la app con contenido realista desde el primer arranque:

```bash
pnpm --filter ferreteria-client seed:dev
```

> La base SQLite se crea automáticamente en `userData` de Electron al arrancar.
> No se versiona. El seed es el mecanismo de datos iniciales de desarrollo.

---

## Estructura del monorepo

```
packages/
  client/    — Electron + React (renderer Vite, main Node.js, SQLite)
  shared/    — Tipos TypeScript y esquema Drizzle compartidos
```

## Documentación del proyecto

| Documento | Descripción |
|-----------|-------------|
| `CLAUDE.md` | Contexto permanente: stack, modelo de datos, RBAC, reglas de negocio, ADRs |
| `DECISIONES.md` | Registro de decisiones tomadas durante el desarrollo |
| `ARCHITECTURE.md` | Diagrama de arquitectura del sistema |
| `docs/Prompt-1.X.txt` | Prompts de desarrollo por fase (P1.4 → P1.11) |
| `docs/Mockups/` | Referencias visuales de UI por pantalla |

## Releases

- **R1** — Núcleo local (POS, stock, caja, QR, importación masiva) ✅ en construcción
- **R2** — Facturación electrónica AFIP/ARCA
- **R3** — Compras y crédito
- **R4** — Nube + sincronización
- **R5** — Reportes consolidados

## Notas para el desarrollador

- La integración fiscal AFIP/ARCA (R2) usa certificados digitales que van en `userData`
  de Electron, **nunca en el repositorio**.
- El lector de códigos de barras opera como HID (plug-and-play); no requiere driver.
- Toda operación escribe primero en SQLite local. La nube consolida pero no bloquea (offline-first).
