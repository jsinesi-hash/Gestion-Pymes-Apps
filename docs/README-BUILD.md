# Build, Distribución y Actualización — Ferretería

## Comandos principales

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Iniciar en modo desarrollo (hot-reload, electron-forge) |
| `pnpm test` | Correr todos los tests (renderer + main process) |
| `pnpm seed:base` | Sembrar datos base en la DB de producción (primer arranque manual) |
| `pnpm dist` | Empaquetar → `dist/Ferretería-Setup-<version>.exe` |
| `pnpm release` | Empaquetar y publicar en GitHub Releases (feed de auto-update) |

> Todos los comandos se ejecutan desde `packages/client/` salvo `pnpm install` (raíz del monorepo).

## Proceso de build

```powershell
# 1. Instalar dependencias (raíz del monorepo)
pnpm install

# 2. Recompilar módulos nativos para Electron
pnpm rebuild:electron

# 3. Generar instalador NSIS
pnpm dist
# → dist/Ferretería-Setup-<version>.exe
# → dist/latest.yml          (feed de auto-update)
# → dist/Ferretería-Setup-<version>.exe.blockmap
```

## Checklist pre-release

- [ ] Tests en verde: `pnpm test`
- [ ] Versión actualizada en `packages/client/package.json` (campo `"version"`)
- [ ] Branch correcto: parche sale de `release/1.0.x`, feature de `main` (ver ADR-042)
- [ ] Tag git creado: `git tag v<version>`
- [ ] `geo-cache/` actualizado si hay nuevas localidades: `pnpm seed:geo` (online)

## Checklist de verificación en VM/PC limpia

Probar en una VM Windows 10 **sin** instalar previamente la app y **sin** red de desarrollo.

- [ ] El `.exe` instala sin errores y sin requerir privilegios especiales
- [ ] La app abre y muestra la pantalla de login
- [ ] La DB existe en `%APPDATA%\ferreteria-client\ferreteria.db`
- [ ] Hay datos de seed:base: al menos 24 provincias, rol SUPERVISOR/OPERADOR y usuario `admin`
- [ ] **No hay datos de seed:demo** (productos de prueba, ventas ficticias)
- [ ] No hay archivos `.db-wal` ni `.db-shm` arrastrados desde dev
- [ ] Desinstalar y reinstalar con un `.exe` más nuevo conserva la DB (datos del usuario intactos)

## Firma de código (SmartScreen)

La app **no está firmada** en esta etapa. Al instalar, Windows mostrará el aviso:

> "Windows protegió tu PC"

Instruir al cliente: hacer clic en **"Más información"** → **"Ejecutar de todas formas"**.

La firma de código se evalúa como mejora post-v1.0 (requiere certificado EV ~$500 USD/año).

## Auto-update

Si la PC tiene internet, la app chequea GitHub Releases al arrancar y notifica cuando hay una versión nueva. Al reiniciar, el nuevo instalador NSIS actualiza la app en forma silenciosa conservando la DB.

Para actualizaciones sin internet: descargar `Ferretería-Setup-<nueva-version>.exe` y ejecutarlo — los datos en `%APPDATA%\ferreteria-client\` quedan intactos.

## seed:base vs seed:demo

| Script | Cuándo corre | Qué siembra |
|--------|-------------|-------------|
| `seed:base` | Automáticamente en el primer arranque de la app (flag `sistema.seed_base_aplicado`) | Roles, permisos, usuario `admin`, IVA 21%, unidades base, provincias/localidades |
| `seed:demo` | Solo en desarrollo (`pnpm seed:dev`) | Catálogo de prueba, ventas ficticias, personas de ejemplo |

`seed:demo` **nunca** corre en la app distribuida.
