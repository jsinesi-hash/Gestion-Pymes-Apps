# Esquema maestro de documentación — Ferretería-app

> Documento raíz que define **qué documentos existen**, **qué contiene cada uno**, **qué diagramas se producen** y **cómo se reutiliza el contenido entre ellos** sin duplicarlo.
> Sistema documentado: POS + inventario offline-first (Electron + React + TypeScript + SQLite/Drizzle, monorepo pnpm), gobernado por ADRs.

---

## 1. Principio rector: docs-as-code + single source of truth

La documentación vive **en el repo**, bajo `/docs/documentacion` (subcarpeta propia para no sumar al desorden existente de `/docs`), versionada junto al código y sujeta a los mismos PRs. Esto resuelve el problema que pediste (reutilizar / que se complementen) por construcción:

- **Un solo origen por pieza de contenido.** Cada término, cada diagrama, cada caso de uso tiene **un único lugar** donde se define. Los demás documentos lo *referencian por ID*, no lo copian.
- **Diagramas como código** (Mermaid para lo liviano, PlantUML/C4 para lo estructural). Un `.mmd`/`.puml` se incrusta tanto en el manual como en la doc técnica → si cambia el sistema, se edita **un** archivo.
- **Trazabilidad por identificadores.** Requisito → Caso de uso → Pantalla del manual → ADR → Test comparten un esquema de IDs (ver §6). Así el manual y la doc técnica quedan "cosidos" y ninguno queda huérfano cuando el sistema evoluciona.
- **Derivar, no dibujar a mano** lo que el código ya sabe: el DER y el diccionario de datos se generan desde el schema Drizzle; los estados fiscales desde la máquina real. Menos deriva entre doc y realidad.

### Estructura de carpetas propuesta

```
/docs/documentacion
├─ README.md                     # Mapa/índice de toda la documentación (punto de entrada)
├─ glosario.md                   # Diccionario de dominio — ÚNICA fuente de términos
├─ manual-usuario/               # Doc 1 — orientado a usuario final, por rol
│  ├─ 00-indice.md
│  ├─ 01-primeros-pasos.md
│  ├─ 10-pos-ventas.md
│  ├─ 20-catalogo.md
│  ├─ 30-caja.md
│  ├─ 40-facturacion.md          # R2
│  ├─ 50-compras-proveedores.md  # R3
│  ├─ 90-preguntas-frecuentes.md
│  └─ assets/                    # Capturas — compartidas con la doc técnica
├─ tecnica/                      # Doc 2 — Software Design Document (SDD)
│  ├─ 00-vision-alcance.md
│  ├─ 10-arquitectura.md         # Vistas C4 + despliegue
│  ├─ 20-modelo-datos.md         # DER + diccionario de datos
│  ├─ 30-casos-de-uso.md         # UML use case + especificaciones
│  ├─ 40-flujos-y-secuencias.md  # Actividad / secuencia / BPMN
│  ├─ 50-maquinas-estado.md      # Estados (fiscal, venta, backup)
│  ├─ 60-modulos/                # Un archivo por módulo (POS, Catálogo, Fiscal…)
│  └─ 70-no-funcionales.md       # Seguridad, backup, performance, offline
├─ operacion/                    # Doc 3 — instalación y operación (runbook)
│  ├─ instalacion.md
│  ├─ backup-restore.md
│  └─ actualizacion.md
├─ diagrams/                     # ÚNICA fuente de diagramas (.mmd / .puml)
│  ├─ c4-contexto.puml
│  ├─ c4-contenedores.puml
│  ├─ der.mmd
│  ├─ uc-*.puml
│  ├─ seq-*.puml
│  └─ state-*.mmd
└─ trazabilidad.md               # Matriz RF ↔ UC ↔ pantalla ↔ ADR ↔ test

# Quedan en su ubicación actual (docs/), se referencian, no se mueven ni duplican:
#   docs/DECISIONES.md   — ADR log (YA EXISTE)
#   docs/ESTADO.md       — Estado vivo (YA EXISTE)
```

---

## 2. El set de documentos

| # | Documento | Audiencia | Responde a | Formato |
|---|---|---|---|---|
| 1 | **Manual de Usuario** | Cajero, depósito, supervisor | "¿Cómo hago X?" | MD → PDF/HTML por rol |
| 2 | **Documentación Técnica (SDD)** | Vos + agente IA + futuro dev | "¿Cómo está construido y por qué?" | MD + diagramas en repo |
| 3 | **Guía de Instalación y Operación** | Quien instala/mantiene | "¿Cómo lo pongo en marcha y lo cuido?" | MD |
| 4 | **Glosario / Diccionario de dominio** | Todos | "¿Qué significa este término?" | MD — fuente única |
| 5 | **Matriz de Trazabilidad** | Vos (gestión) | "¿Está todo cubierto y probado?" | MD/tabla |
| 6 | **ADR Log** (`DECISIONES.md`) | Vos + agente | "¿Por qué se decidió así?" | Ya existe |
| 7 | **Estado vivo** (`ESTADO.md`) | Vos + agente | "¿En qué punto estamos?" | Ya existe |

Los documentos 4–7 son el **tejido conectivo**: el glosario alimenta a 1 y 2; la trazabilidad los ata; los ADR justifican lo que la doc técnica describe.

---

## 3. Manual de Usuario — estructura

Orientado a tareas y por rol (los roles del sistema: **cajero/vendedor**, **encargado de depósito**, **supervisor**). Lenguaje simple, castellano rioplatense, cero jerga técnica.

- **Portada + control de versiones** (versión del sistema que documenta, ej. v1.0.0)
- **Introducción**: qué es el sistema, para qué sirve, qué NO hace
- **Primeros pasos**: instalación asistida, login usuario/contraseña, mapa de pantallas (sidebar por grupos: Catálogo, Abastecimiento, Clientes, Reportes, Configuración)
- **Guía por rol** (índice de "qué puede hacer cada uno")
- **Módulos operativos** (uno por capítulo, con paso a paso + capturas):
  - Punto de venta (venta, pagos mixtos, vuelto, ventas en espera, confirmar venta)
  - Catálogo de productos (alta, SKU, categorías, marcas, etiquetas/impresión)
  - Caja (apertura/cierre de turno)
  - Facturación AFIP/ARCA *(R2)*
  - Compras y proveedores, cuenta corriente de clientes *(R3)*
  - Copias de seguridad y restauración
- **Preguntas frecuentes y resolución de problemas**
- **Glosario para el usuario** (subset del glosario general, en lenguaje llano)

**Convención clave para reutilizar:** cada capítulo del manual abre con una línea oculta/metadato `implementa: UC-XXX-NN`. El "paso a paso" del manual es el *happy path* del caso de uso, contado en modo instrucción. Misma verdad, dos niveles de detalle, un origen conceptual.

---

## 4. Documentación Técnica (SDD) — estructura

Sigue una espina dorsal tipo IEEE-1016 / arc42, adaptada:

1. **Visión y alcance**: propósito, actores, límites del sistema, releases (R1–R4)
2. **Restricciones y decisiones**: invariantes de arquitectura (centavos enteros, soft-delete, UUID PK, IPC por entidad, parámetros en `parametros_sistema`) → enlazan a los ADR correspondientes
3. **Arquitectura** (vistas C4):
   - Contexto (sistema ↔ usuario ↔ ARCA/AFIP ↔ nube R4)
   - Contenedores (Electron main / renderer React / SQLite local / SDK fiscal)
   - Componentes por módulo
   - **Despliegue** (Windows 10, WAL db, instalador NSIS, `safeStorage` para certificados)
4. **Modelo de datos**: DER + diccionario de datos (derivados del schema Drizzle)
5. **Casos de uso**: diagrama UML de casos de uso por actor + especificación tabular de cada UC (precondiciones, flujo principal, alternativos, postcondiciones)
6. **Flujos y comportamiento**: diagramas de actividad / secuencia / BPMN de los procesos críticos
7. **Máquinas de estado**: comprobante fiscal (7 estados / CAE async), estados de venta (`en_espera`/`descartada`/confirmada), backup/restore
8. **Vista por módulos**: un archivo por módulo con su IPC, entidades, reglas
9. **Atributos de calidad (no funcionales)**: offline-first, seguridad (scrypt, AES-256-GCM, `safeStorage`), integridad fiscal, respaldo, performance, testing (Vitest/SonarCloud)
10. **Anexos**: contratos IPC, formato `.fbk`, convención SKU (Luhn), numeración de documentos internos

---

## 5. Inventario de diagramas (UML + alternativas)

Cada uno vive **una sola vez** en `/docs/diagrams` y se incrusta donde haga falta. Notación elegida por adecuación, no por dogma:

| ID | Diagrama | Notación | Fuente de verdad | Se usa en |
|---|---|---|---|---|
| C4-1 | Contexto del sistema | C4 / PlantUML | manual (dibujo) | Técnica, Manual (intro) |
| C4-2 | Contenedores | C4 / PlantUML | manual | Técnica |
| C4-3 | Componentes por módulo | C4 / PlantUML | manual | Técnica (por módulo) |
| DEP-1 | Despliegue | UML deployment | manual | Técnica, Operación |
| DER-1 | Modelo entidad-relación | Mermaid ER / dbdiagram | **generado del schema** | Técnica |
| UC-* | Casos de uso por actor | UML use case | manual | Técnica, Manual (referencia) |
| SEQ-venta | Secuencia: confirmar venta atómica | UML sequence | manual | Técnica |
| SEQ-cae | Secuencia: solicitud CAE async | UML sequence | manual | Técnica (Fiscal) |
| SEQ-backup | Secuencia: backup hot `.fbk` | UML sequence | manual | Técnica, Operación |
| ACT-* | Actividad/flujo: venta, caja, compra | UML activity / BPMN | manual | Técnica, Manual |
| STATE-fiscal | Máquina 7 estados comprobante | UML state | manual | Técnica (Fiscal) |
| STATE-venta | Estados de venta | UML state | manual | Técnica |
| NAV-1 | Mapa de navegación / sitemap de pantallas | Mermaid flowchart | manual | **Manual y Técnica** (bisagra entre ambos) |
| CLS-dominio | Clases/entidades del dominio (`packages/shared`) | UML class | manual | Técnica |

> **Alternativas a UML donde conviene:** C4 para arquitectura (más legible que diagramas de componentes UML puros), BPMN para procesos de negocio (venta, reabastecimiento), y ER "de base de datos" para el DER. UML se reserva para casos de uso, secuencia, estados y clases.

---

## 6. Estrategia de reutilización y trazabilidad

Esto es lo que hace que "ambos se complementen" en vez de divergir.

**Esquema de IDs compartido:**
- Requisito funcional: `RF-<módulo>-NN` (ej. `RF-POS-03`)
- Caso de uso: `UC-<módulo>-NN` (ej. `UC-POS-01 Registrar venta`)
- Pantalla del manual: `PANT-<módulo>-NN`
- Decisión: `ADR-0NN` (ya en uso)
- Test: `TEST-<módulo>-NN` (Vitest)

**Matriz de trazabilidad** (`trazabilidad.md`): una fila por requisito, columnas RF → UC → Pantalla → ADR → Test. De un vistazo ves qué está especificado pero sin manual, o implementado sin test. Como PMP, es tu tablero de completitud de alcance.

**Reglas de no-duplicación:**
1. Los **términos** se definen solo en `glosario.md`. Manual y técnica linkean.
2. Los **diagramas** se definen solo en `/docs/diagrams`. Todo lo demás los incrusta.
3. Las **decisiones** se justifican solo en `DECISIONES.md`. La técnica las referencia, no reargumenta.
4. El **happy path** de un UC se escribe una vez; el manual lo cuenta en modo tarea, la técnica en modo especificación, ambos apuntando al mismo `UC-ID`.
5. Las **capturas** viven en un `assets/` compartido.

---

## 7. Toolchain sugerido (para ejecutar en el repo con Claude Code)

- **Markdown** como formato base (diff-eable, versionable).
- **Mermaid** embebido para diagramas livianos (GitHub lo renderiza nativo).
- **PlantUML + C4-PlantUML** para arquitectura y secuencia.
- **DER generado** desde Drizzle (script `drizzle-kit` / introspección) → `.mmd`, para que no se desincronice del schema real.
- **Exportables** del manual: MkDocs Material o Pandoc → PDF/HTML por rol, desde los mismos `.md`.
- Todo entra por PR y pasa por el mismo control que el código (incluí "actualizar docs" como gate en los prompts de Superpowers, igual que ya hacés con migraciones).

---

## 8. Plan de ejecución sugerido (por lotes, respetando phase-gate)

1. **Lote 0 — Andamiaje**: crear `/docs/documentacion`, `README.md`, `glosario.md` semilla, `trazabilidad.md` vacía. *(sin código, se puede acá o en repo)*
2. **Lote 1 — Manual de Usuario R1**: módulos ya funcionales (POS, Catálogo, Caja, Backup). *(arrancamos ahora)*
3. **Lote 2 — Técnica base**: visión, arquitectura C4, DER generado, diccionario de datos. *(en el repo, Code leyendo el fuente)*
4. **Lote 3 — Casos de uso + flujos R1** y matriz de trazabilidad inicial.
5. **Lote 4 — Máquinas de estado + módulo Fiscal (R2)** cuando esté cerrado.
6. **Lote 5 — Compras/Clientes (R3)** y exportables (PDF/HTML) + publicación.

---

*Este esquema es agnóstico del entorno. La doc técnica (lotes 2–5) conviene ejecutarla con Claude Code apuntando al repo, para que DER, casos de uso y arquitectura salgan del código real y no de reconstrucción.*
