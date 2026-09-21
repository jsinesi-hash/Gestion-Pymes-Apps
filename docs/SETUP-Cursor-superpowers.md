# Setup — Superpowers en Cursor

> Guía para configurar y ejecutar el desarrollo del Sistema de Gestión de Ferretería con
> **Cursor + Superpowers**. Superpowers es un **plugin/framework de skills** (no un SDK):
> se instala en Cursor y sus skills se activan automáticamente.

---

## Requisitos
- Cursor instalado.
- Una carpeta para el repositorio del proyecto.

---

## Paso 1 — Instalar Superpowers en Cursor
1. Abrí Cursor y abrí el panel **Agent chat**.
2. Ejecutá: `/add-plugin superpowers` (o buscá "superpowers" en el marketplace de plugins).
3. Confirmá la instalación. Las skills se activan solas; no hay que configurar nada más.

> Las carpetas/archivos del propio Superpowers las gestiona Cursor (caché de plugins). Vos
> solo creás los archivos de tu proyecto.

**Verificación:** en una sesión nueva pedí "ayudame a planificar una feature". Si el agente
arranca aclarando requisitos en vez de escribir código, quedó bien instalado.

---

## Paso 2 — Estructura del proyecto (dónde va cada archivo)

```
ferreteria-app/                 ← raíz del repo (se abre en Cursor)
├── AGENTS.md                   ← contexto del proyecto (contenido del CLAUDE.md)
├── docs/                       ← documentación del proyecto
│   ├── PRD-ferreteria.md
│   ├── TechSpec-ferreteria.md
│   ├── Sistema-Diseno-ferreteria.md
│   ├── ADR-Log-ferreteria.md
│   ├── RFC-001-ferreteria.md
│   ├── Acta-Definiciones-ferreteria.md
│   ├── System-Prompts-desarrollo-ferreteria.md
│   └── mockups/
│       ├── mockup-pos-ferreteria.html
│       └── mockup-pos-ferreteria-v2.html
└── (código generado por Superpowers: packages/app, packages/db, packages/core)
```

### Archivo de contexto: AGENTS.md (clave para Cursor)
- **Cursor lee `AGENTS.md`** (y/o `.cursor/rules/*.mdc`), no `CLAUDE.md`.
- Guardá el contenido del `CLAUDE.md` que armamos como **`AGENTS.md` en la raíz**.
- Las instrucciones del proyecto (`AGENTS.md`) **tienen prioridad** sobre la metodología
  genérica de Superpowers.
- Si además usás Claude Code, mantené `CLAUDE.md` y `AGENTS.md` con el mismo contenido.

---

## Paso 3 — Abrir el proyecto
`File > Open Folder` → seleccioná `ferreteria-app/`. Cursor ya tiene Superpowers activo y
leerá `AGENTS.md`.

---

## Paso 4 — Arrancar la fase P1.0 (Bootstrap)
1. En el Agent chat, pegá el prompt **P1.0 — Bootstrap** (de `System-Prompts-desarrollo-ferreteria.md`).
2. Superpowers hará: preguntas → spec → plan de implementación.
3. Revisá el plan; confirmá la estructura del monorepo (pnpm workspaces) y la config de
   Drizzle + SQLite.
4. Decí "go" para que ejecute con TDD (RED-GREEN-REFACTOR).

---

## Paso 5 — Iterar por fases
- Una fase por sesión/branch, en orden estricto (P1.0 → P1.1 → … → R5).
- Validá cada fase con el **checklist de fin de fase** (apéndice del documento de prompts).
- Dejá que las instrucciones de `AGENTS.md` mantengan al agente dentro de las decisiones
  ya tomadas (no reintroducir decisiones cerradas; no implementar lo que está fuera de
  alcance).

---

## Notas
- "SDK" vs plugin: Superpowers se usa como plugin dentro de Cursor; no se programa contra
  un SDK. El *Claude Agent SDK* es otra cosa (construir un agente por código) y no aplica
  a este flujo.
- Actualización del plugin: Cursor/Superpowers suele actualizar de forma automática; si no,
  reinstalá desde el marketplace.
