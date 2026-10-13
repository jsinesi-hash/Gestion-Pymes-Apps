# ADR-099 — Elaborados: carga inicial de datos (seed base, `seed:dev` y atajo en el POS)

**Estado:** Aceptado — implementado y mergeado a `main` (PR #11, 2026-10-13)
**Fecha:** 2026-10-13
**Plan:** `docs/superpowers/plans/2026-10-13-elaborados-carga-inicial.md`
**Precedentes:** spec de la familia §7.3 (perfil y seed), ADR-093 (seed demo de heladería), ADR-098 (POS).

## Contexto

Al probar el POS (ADR-098) la pantalla salía vacía ("No hay productos cargados"). Una instalación de
Elaborados arrancaba con solo impuestos y el cliente Consumidor Final: el spec de la familia (§7.3) prometía
un "seed base del rubro (categorías de venta y grupo Sabores)" que nunca se implementó, no existía un
equivalente al `pnpm seed:dev` de Retail y el catálogo demo solo se podía cargar con un botón escondido en
Carta → Productos de venta (visible únicamente con esa lista vacía). El usuario había pedido "una siembra como
la de Retail" y no se había hecho.

## Decisión (paridad con Retail)

1. **Seed base del rubro, una sola vez por BD.** `runBaseRubroHeladeria(db)` crea (find-or-create por nombre)
   las categorías de venta Helados, Palitos, Tortas, Licuados y Cucuruchos (orden 1–5) y el grupo de
   modificadores "Sabores" sin opciones. Corre desde `runStartup` detrás de la clave nueva
   `sistema.seed_rubro_aplicado` en `parametros_sistema`. Se usa una clave **propia** y no el flag existente
   `sistema.seed_base_aplicado` porque las instalaciones ya sembradas lo tienen en `true` y nunca habrían
   recibido las categorías; y es "una vez" y no "cada arranque" para que no reaparezca lo que un Supervisor
   haya renombrado o desactivado.
2. **El seed demo convive con el base.** Su guard pasó de "existe alguna categoría" (que el seed base anulaba
   siempre) a "existe algún `producto_venta`", y reutiliza por nombre las categorías y el grupo Sabores en
   lugar de duplicarlos.
3. **CLI como Retail:** `pnpm seed:base` y `pnpm seed:dev` en `apps/elaborados` (Electron con
   `ELECTRON_RUN_AS_NODE=1` + `tsx`, mismo NMV que `better-sqlite3`). Abren la BD **fuera de Electron**
   (`DB_PATH` o `%APPDATA%/elaborados-client/elaborados.db`), migran y siembran.
   - `seed:base`: migraciones + auth + impuestos + Consumidor Final + seed base del rubro.
   - `seed:dev`: lo anterior + login admin + catálogo demo de heladería + 6 clientes de ejemplo (2 con
     cuenta corriente habilitada: uno con límite chico de $20.000 para probar el pedido de Supervisor y otro
     holgado de $500.000) + 3 ventas de ejemplo (pote de 3 sabores en efectivo, palito con tarjeta y licuados a
     cuenta corriente). **La caja queda abierta** para entrar directo al POS.
   - **Idempotente y sin `--force`** (diferencia consciente con Retail): cada paso se saltea si ya hay datos de su
     tipo. Para empezar de cero se borra el archivo de la BD. Un `--force` que borre catálogo, ventas y clientes
     respetando FKs y libros inmutables es un riesgo que hoy no se justifica.
4. **Atajo en el POS vacío:** con catálogo vacío, un Supervisor ve el botón "Cargar catálogo demo de
   heladería" (llama a `demoCatalog.seedHeladeria` y recarga el catálogo del hook, sin recargar la página); quien
   no puede gestionar productos lee "Pedile a un Supervisor…". Se mantiene el link a Carta.

## Consecuencias
- **Prerrequisito del CLI:** igual que el seed de Retail, usa el `dist` de `@core/*` y `@ferreteria/shared`;
  si se edita `packages/*/src` hay que recompilar (`pnpm -r build`) antes de `seed:dev`. Los tests usan alias a
  `src` y no tienen ese problema.
- El seed demo siembra el "Pote 1/2 kg" con hasta 3 sabores; el "Pote 1/4 kg" admite 2 (configuración del demo
  de E2), por eso la venta demo de 3 sabores usa el de 1/2 kg.
- El CLI deja la sesión del admin en memoria del proceso, que termina; los tests limpian la sesión.

## Verificación
Tests: seed base (3), convivencia con el demo (2), startup con el flag (2), clientes demo, ventas demo y
`ejecutarSeedDev` end-to-end (9), y atajo del POS (3). **Prueba real del CLI** contra BD temporal con `DB_PATH`:
la primera corrida sembró 8 productos de venta, 5 categorías, 6 clientes demo, 3 ventas y 1 caja abierta; la
segunda no duplicó nada ("ya sembrado"); `seed:base` sobre otra BD temporal dejó 5 categorías, 1 grupo Sabores,
3 impuestos, 1 usuario y Consumidor Final, sin productos ni ventas.
