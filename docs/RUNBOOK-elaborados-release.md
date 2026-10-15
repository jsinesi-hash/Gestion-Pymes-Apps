# RUNBOOK — Elaborados (heladería) 1.0.0: build, instalación y verificación

> App: `elaborados-client` (Electron + React + better-sqlite3 + Drizzle), Windows 10/11, instalador NSIS.
> Complementa `docs/RUNBOOK-release-e-instalacion.md` (Retail). Decisiones: ADR-107…112.
> Política de este release: **instalación manual** (sin auto-update, sin publicación, sin firma de código).

---

## 1. Dónde viven los datos

- Base: `%APPDATA%\elaborados-client\elaborados.db` (+ `-wal`/`-shm`); config de terminal: `config.json` en la misma carpeta; backups previos a migrar: `backups\pre-migration\`.
- **Nunca** dentro de la carpeta de instalación. Reinstalar/actualizar el `.exe` **no toca los datos**.
- El instalador **no desinstala los datos**: `deleteAppDataOnUninstall: false` (ADR-111). Para empezar de cero hay que borrar esa carpeta a mano (o restaurar un backup).
- El instalador no lleva ninguna BD adentro: la primera instalación arranca limpia.

## 2. Construir el instalador (máquina de desarrollo)

```bash
pnpm dist:elaborados        # = rebuild:electron + electron-forge package + electron-builder (NSIS)
# → apps/elaborados/dist/Heladeria-Setup-1.0.0.exe
cd apps/elaborados && pnpm smoke   # humo del instalador (ver §3)
```

Notas de entorno (ADR-111):
- Esta PC **no tiene Visual Studio**: no se puede compilar `better-sqlite3` desde fuente. El `better-sqlite3` del `node_modules` raíz debe estar ya compilado para **Electron** (NMV 128). Si corriste `pnpm rebuild:node`, volvé con `pnpm rebuild:electron` (necesita las ventanas de Electron/`pnpm dev` cerradas: si no, `EPERM` al reemplazar el `.node`). El humo falla si el ABI es el equivocado.
- Tras el build, para correr tests del main con Electron no hace falta tocar nada; para tests con Node del sistema, `pnpm rebuild:node` (ver CLAUDE.md).
- Versión: `apps/elaborados/package.json` → `version`. El nombre del archivo del instalador sale de ahí.

## 3. Humo automático (`pnpm smoke`)

Extrae el instalador con 7za (sin instalar nada), arranca el `.exe` con un `userData` temporal y exige: geo-cache presente en `resources/`, ningún `.db` dentro del paquete, **11 migraciones** aplicadas (las que haya en `_journal.json`), usuario `admin`, cliente Consumidor Final, 3 impuestos y ~4000 localidades. Sale con código ≠ 0 si algo falta. Se debe correr antes de entregar cualquier instalador.

## 4. Primera instalación en la PC de la heladería

1. Ejecutar `Heladeria-Setup-1.0.0.exe` (instala por usuario; crea acceso directo en el escritorio). Windows puede mostrar SmartScreen por no estar firmado: "Más información → Ejecutar de todas formas".
2. Primer arranque (tarda unos segundos: crea la BD, migra, siembra permisos, impuestos, categorías de venta, grupo Sabores, geografía).
3. Ingresar con el usuario inicial (`admin` / la contraseña inicial definida en `packages/core-main/src/auth/seed.ts`, línea del usuario `admin`) y **cambiarla de inmediato** en Mi cuenta.
4. Crear los usuarios reales (Sistema → Usuarios) y, si corresponde, el Operador.
5. Datos del negocio — dos caminos:
   - **Directo:** cargar insumos (Stock → Artículos), recetas y producción, categorías, modificadores/sabores y productos de venta (Carta), listas de precio, proveedores y clientes desde la UI.
   - **Con demo:** Sistema → **Datos demo** → *Cargar catálogo demo* (solo sobre un catálogo vacío) para probar; *Vaciar datos demo* lo borra antes de operar. Si algo demo ya tuvo ventas, compras, movimientos de stock, producciones o recetas propias, el vaciado se **bloquea** con un mensaje que dice qué lo impide (ADR-110).
6. Abrir caja (Caja) antes de vender; el POS lo exige.
7. Configurar backups: Sistema → Backup/Restore → crear un backup y guardarlo fuera de la PC (pendrive/nube). Hacerlo al cierre de cada día es la política recomendada.

## 5. Actualizar a una versión nueva

Sin auto-update: copiar el nuevo `Heladeria-Setup-<v>.exe` y ejecutarlo encima. Los datos quedan; las migraciones corren solas al abrir (con backup automático previo en `userData\backups\pre-migration`). Antes de actualizar: crear un backup manual desde la app.

## 6. Checklist de verificación en PC limpia (obligatoria antes de entregar)

- [ ] Se instala sin errores y crea el acceso directo; el icono/nombre es "Heladería".
- [ ] Abre y muestra el login; ingresa con `admin`.
- [ ] Existe `%APPDATA%\elaborados-client\elaborados.db` y la app no depende de internet (probar con la red desconectada).
- [ ] Sistema → Datos demo → cargar → el POS muestra 8 productos; vaciar → vuelve a vacío.
- [ ] Desinstalar desde Configuración de Windows **no** borra `%APPDATA%\elaborados-client`.
- [ ] Reinstalar encima conserva usuarios, ventas y caja.
- [ ] Backup → restaurar sobre una copia: los datos vuelven.

## 7. Checklist de recorrido funcional E1–E4 (verificación manual con la app)

Marcar cada ítem; anotar cualquier error visible, texto en inglés/código crudo, pantalla sin datos o comportamiento raro.

**E1 — plataforma**
- [ ] Login/logout; Operador no ve Usuarios, Roles ni Datos demo; Supervisor sí.
- [ ] Mi cuenta: cambiar contraseña y preferencias de apariencia (tema, modo, acento).
- [ ] Clientes: crear (nombre y apellido), editar, ver detalle; habilitar cuenta corriente con límite.
- [ ] Cuentas corrientes: registrar un cobro; ver saldo y movimientos.
- [ ] Caja: abrir, movimiento manual (retiro/aporte), cerrar con diferencia (pide Supervisor sobre el umbral).

**E2 — inventario elaborado**
- [ ] Stock → Artículos: alta de insumo, de elaborado y de reventa; baja lógica.
- [ ] Stock → Conteo: ajustar un artículo y "Tacho vacío" en un elaborado.
- [ ] Producción: definir receta, producir un lote (baja insumos, sube el elaborado); anular con Supervisor.
- [ ] Carta: categorías, grupo de modificadores/sabores (min/max/recargo), producto de venta con componentes y grupos.

**E3 — venta**
- [ ] POS: producto sin sabores se agrega y cotiza; pote con 1–3 sabores (reparto) y con recargo.
- [ ] Descuento de línea y global; redondeo a $1 sobre el total.
- [ ] Cobro: efectivo con vuelto; tarjeta con recargo; pago mixto; cuenta corriente sobre el límite (pide Supervisor).
- [ ] Ticket: lista todos los medios; imprimir (vista de impresión).
- [ ] Sin stock: la reventa bloquea; el granel avisa y deja stock negativo.
- [ ] Pedidos: guardar (alias + observaciones), listar, retomar, confirmar al entregar, descartar.
- [ ] Anular una venta desde el ticket y desde Caja (Supervisor); el stock vuelve.

**E4 — gestión**
- [ ] Compras: proveedor rápido y compra de insumos (costo promedio ponderado); anular con Supervisor.
- [ ] Proveedores: alta/edición completa; baja.
- [ ] Listas de precio: crear lista con % y precio absoluto; asignarla a un cliente; el POS muestra el precio de la lista **en las tarjetas** y cotiza lo mismo.
- [ ] Reportes: ventas (margen), productos y sabores, stock; exportar CSV/XLSX.
- [ ] Backup/Restore: crear y restaurar.

## 8. Pendientes conocidos del release 1.0.0

- **Ícono propio:** `assets/icon.ico` es hoy el mismo de Retail.
- **Firma de código:** sin firma; SmartScreen advierte.
- **Prueba en PC limpia** (§6) y **recorrido manual** (§7) a cargo del usuario; los hallazgos se corrigen con test + ADR.
- **Riesgo hermano en Retail:** `apps/retail/src/main/base-seed/index.ts` usa `require.main === module` y se importa desde `startup.ts` (queda dentro del bundle del main). Es el mismo patrón que causó el bug de `geo.ts` (ADR-111). Revisar antes del próximo release de Retail.
- Fuera de alcance de 1.0.0: auto-update, importación masiva por CSV, sync (R4), ARCA (R2), promociones, recálculo masivo.
