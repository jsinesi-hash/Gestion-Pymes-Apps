# Sistema de Diseño — Software de Gestión de Ferretería

> Guía de UI/UX para construir la interfaz con Claude Code + superpowers. Define la
> dirección visual, los tokens, los componentes y los patrones de interacción. Acompaña
> al `CLAUDE.md` (contexto de negocio) como **guía de diseño cerrada**.
>
> Ejemplos navegables de referencia: `mockup-pos-ferreteria.html` y
> `mockup-pos-ferreteria-v2.html` (este último es el canónico: incluye navegación y menú
> de apariencia).

---

## 1. Dirección de diseño

**Utilitaria-profesional refinada.** Es una herramienta de trabajo de uso intensivo en
mostrador, no una web de marketing. Principios:

1. **Legibilidad primero.** Tamaños cómodos, alto contraste, números tabulares alineados.
2. **Keyboard-first.** Toda acción frecuente tiene atajo; el foco va al campo de escaneo.
3. **Color con intención.** El acento se reserva para lo accionable (escaneo, cobrar,
   selección activa). El resto es neutro para no fatigar en jornadas largas.
4. **Identidad de ferretería.** Acento ámbar/herramienta por defecto (evoca taller),
   sobre neutros cálidos.
5. **Offline-aware.** La UI comunica estado de conexión y sincronización sin alarmar.
6. **Densidad ajustable.** El comercio elige cuánta información por pantalla.

---

## 2. Tokens de color

Implementar como CSS custom properties con conmutación por `data-theme`. Valores exactos
(tomados del mockup canónico):

### 2.1 Neutros — tema claro
```css
:root{
  --bg:#F4F2EE;        /* fondo de la app */
  --surface:#FFFFFF;   /* paneles, barras */
  --surface-2:#FAF8F4; /* campos, filas alternas, hover */
  --line:#E3DED5;      /* bordes y separadores */
  --ink:#1C1A17;       /* texto principal */
  --ink-2:#5C564D;     /* texto secundario */
  --ink-3:#8A8479;     /* texto terciario / placeholders / labels */
  --ok:#2E7D52;        /* éxito / caja abierta / descuentos */
  --danger:#C0392B;    /* error / quitar / faltante */
}
```

### 2.2 Neutros — tema oscuro
```css
[data-theme="dark"]{
  --bg:#15140F; --surface:#1E1C16; --surface-2:#262319; --line:#322E24;
  --ink:#F2EFE8; --ink-2:#B7B0A3; --ink-3:#7C766B;
  --ok:#5FD699; --danger:#F0746A;
}
```

### 2.3 Acentos seleccionables por el usuario
Cada acento define `--accent`, `--accent-strong` y `--accent-soft` (este último difiere
entre claro y oscuro). Ámbar es el predeterminado.

| Acento | --accent | --accent-strong | soft (claro) | soft (oscuro) |
|--------|----------|-----------------|--------------|---------------|
| Ámbar (default) | `#E8730A` | `#C85E00` | `#FBE6D2` | `#3A2A17` |
| Azul | `#2563EB` | `#1D4FD7` | `#DBE5FF` | `#16233F` |
| Verde | `#1F9D55` | `#178045` | `#D6F0DF` | `#16301F` |
| Violeta | `#7C3AED` | `#6A2BD0` | `#EADDFD` | `#2A1B40` |
| Ladrillo | `#B23A2E` | `#982F24` | `#F6DCD8` | `#3A1E1A` |

> Regla: al cambiar de tema hay que reasignar `--accent-soft` (claro vs oscuro). El acento
> activo y la sombra del botón primario (`rgba(accent,.3)`) se recalculan juntos.

### 2.4 Semánticos de estado

Además de `--ok` y `--danger` (§2.1/§2.2), la paleta define un tercer semántico:

```css
:root{ --warn:#B4690E; }              /* advertencia / atención, sin bloquear */
[data-theme="oscuro"]{ --warn:#E0A23A; }
```

- **--warn:** advertencias que **no** bloquean la operación — stock bajo mínimo, precio
  "sin confirmar" (ADR-040), arqueo con diferencia bajo el umbral, remito pendiente de
  conformar. Si la condición impide continuar, no es `--warn`: es `--danger`.

> **La paleta semántica es exactamente ésta: `--ok`, `--warn`, `--danger`.** No existen
> `--success`, `--error`, `--color-success`, `--color-warning` ni variantes `-bg` / `-text`.
> Un `var(--success, #2E7D52)` pinta siempre el fallback y queda fuera del cambio de tema:
> se ve bien y está roto. Ver §12.

### 2.5 Uso del color
- **Acento:** campo de escaneo (borde), botón Cobrar, forma de pago activa, ítem de
  navegación activo (`--accent-soft` de fondo + `--accent-strong` de texto).
- **--ok:** chip "caja abierta", descuentos (en verde), confirmaciones.
- **--warn:** ver §2.4.
- **--danger:** quitar línea, errores de validación, faltante de arqueo.
- Nunca usar acento para texto largo ni para fondos amplios.

---

## 3. Tipografía

### 3.1 Fuentes
- **Interfaz (seleccionable por el usuario, 3 opciones de métrica similar):**
  **Hanken Grotesk** (default), **Figtree**, **Onest**. Elegidas con x-height y ancho
  comparables para que **cambiar de fuente no reacomode el layout**.
- **Números (fija, no configurable): JetBrains Mono**, `font-variant-numeric: tabular-nums`.
  Se usa en todo importe, cantidad, código, fecha y total. Garantiza alineación de columnas.

```css
:root{ --ui-font:'Hanken Grotesk'; }
body{ font-family: var(--ui-font), 'Figtree','Onest', system-ui, sans-serif; }
.num{ font-family:'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
```

> Stack de respaldo común a las tres para evitar saltos si una no carga.

**`--ui-font` es un token de primera clase**, igual que los de color: la fuente de interfaz
se lee siempre con `var(--ui-font)` y nunca se nombra literalmente en un componente. Lo
escribe el drawer de Apariencia (§8) sobre `:root` a partir de `usuario_preferencias.ui_font`.
La fuente de los **números** no es un token porque no es configurable (§3.1): `.num` la fija.

> ⚠️ **Desvío vigente:** `global.css` arranca con `--ui-font:'Archivo'`, no con
> `'Hanken Grotesk'` como dice este documento. Registrado en la bitácora (2026-07-24), sin
> resolver — es una decisión de diseño, no una errata.

### 3.2 Escala tipográfica
| Rol | Tamaño | Peso | Notas |
|-----|--------|------|-------|
| Total a cobrar | 32–34px | 700 | mono, `letter-spacing:-.02em` |
| Título de pantalla / módulo | 16–17px | 700–800 | `letter-spacing:-.01em` |
| Nombre de producto / cliente | 15px | 700 | |
| Cuerpo / celdas de tabla | 14–14.5px | 400–600 | |
| Secundario / totales | 13–13.5px | 400–500 | color `--ink-2` |
| Código de producto / metadatos | 11–12px | 400 | mono, color `--ink-3` |
| Label / encabezado de columna | 11px | 600–700 | UPPERCASE, `letter-spacing:.08–.1em`, `--ink-3` |
| Sección de navegación | 10px | 700 | UPPERCASE, `letter-spacing:.12em` |

---

## 4. Espaciado, radios, sombras y densidad

```css
:root{
  --radius:14px;  /* paneles */
  --pad:16px;     /* padding interno de paneles y celdas */
  --rowpad:12px;  /* alto de fila de tabla */
  --shadow: 0 1px 2px rgba(28,26,23,.06), 0 8px 24px rgba(28,26,23,.06);
}
[data-theme="oscuro"]{ --shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.35); }
[data-density="compact"]{ --pad:10px; --rowpad:8px; --radius:11px; }
```

Los cuatro son **tokens estructurales**: se consumen con `var(--x)`, nunca replicando el
valor. Son los únicos tokens que conmutan por **densidad**, no por tema — salvo `--shadow`,
que conmuta por tema y no por densidad.

| Token | Rol | Conmutación |
|-------|-----|-------------|
| `--radius` | Radio de esquina de paneles y contenedores. | densidad |
| `--pad` | Padding interno de paneles y celdas. | densidad |
| `--rowpad` | Padding vertical de fila de tabla (define el alto de fila). | densidad |
| `--shadow` | Sombra de elevación de paneles, drawers y modales. | tema |

- **Densidad** conmutable por usuario (Cómoda / Compacta) afectando `--pad`, `--rowpad`,
  `--radius`.
- **Radios:** paneles `--radius`; controles internos 8–12px; chips/píldoras 999px.
- **Sombras:** una sola elevación, en `--shadow`. La sombra del botón primario es la
  excepción: se deriva del acento (`rgba(accent,.3)`, §2.3) y por eso no sale de este token.
- **Escala de espacio base:** múltiplos de 4 (4/8/12/16/20/24).

---

## 5. Layout

Estructura de tres zonas con roles fijos (ver ADR de navegación / RFC):

```
┌────────┬───────────────────────────────────────────┐
│        │  TOP BAR: título · búsqueda global · sesión│
│ SIDE   ├───────────────────────────────────────────┤
│ BAR    │  CONTENIDO            │  PANEL CONTEXTUAL   │
│ (nav)  │  (módulo activo)      │  (derecha, opcional)│
│        │                       │                     │
└────────┴───────────────────────┴─────────────────────┘
```
- **Sidebar izquierda (≈218px, colapsable a 64px):** navegación entre módulos, agrupada
  por secciones (Operación / Catálogo / Comercial / Sistema). Único lugar de navegación
  global.
- **Top bar:** título del módulo + breadcrumb, búsqueda global centrada, contexto de
  sesión (caja, usuario) y botón de apariencia.
- **Panel contextual derecho:** SOLO acciones de la pantalla actual (ej. totales + cobrar
  del POS). No es navegación.
- **Drawers (paneles deslizables desde la derecha):** para utilidades como Apariencia.
- **Responsive:** bajo ~900px la sidebar se vuelve overlay y el panel derecho sube arriba.

---

## 6. Componentes

### 6.1 Botón primario (Cobrar / acción principal)
Fondo `--accent`, texto blanco, radius 12px, peso 700, sombra `rgba(accent,.3)`. Incluye
el atajo en `<kbd>`. Hover → `--accent-strong`.
```html
<button class="cobrar">Cobrar e imprimir <kbd>F9</kbd></button>
```

### 6.2 Botón secundario / icon button
Fondo `--surface-2`, borde `--line`, texto `--ink`. Hover → borde y texto `--accent`.
Tamaño táctil mínimo 38–40px.

### 6.3 Campo de escaneo (componente estrella del POS)
Borde 2px `--accent`, fondo `--surface-2`, ícono de barras, input mono 17–18px, cursor
parpadeante. Siempre enfocado al entrar al POS. El lector inyecta texto + Enter.

### 6.4 Chip / píldora de estado
Píldora 999px, fondo `--surface-2`, borde `--line`. Variante con punto `--ok` para "caja
abierta". Para usuario/rol, texto `--ink`.

### 6.5 Tabla de ítems
Encabezados sticky UPPERCASE 11px `--ink-3`; filas con `--rowpad`; hover `--surface-2`;
importes a la derecha en mono; fila nueva con animación `flash` (de `--accent-soft` a
transparente). Botón quitar (✕) en `--ink-3`, hover `--danger`.

### 6.6 Panel de totales
Filas label/valor; descuentos en `--ok`; separador `--line`; bloque "Total a cobrar"
destacado en `--surface-2` con el monto en mono 32–34px. Muestra siempre IVA incluido y
ajuste por redondeo.

### 6.7 Selector de forma de pago
Grilla de 4 (Efectivo / Transferencia / Tarjeta / Cta. Cte.). Botón activo en `--accent`
con texto blanco; resto neutro. Ícono arriba + label abajo.

### 6.8 Navegación lateral (sidebar)
Ítem: ícono 19–20px + label 14px peso 600. Activo: fondo `--accent-soft`, texto
`--accent-strong` (claro) / `--accent` (oscuro). Secciones con encabezado micro UPPERCASE.
Colapsable (oculta labels y secciones, deja íconos).

### 6.9 Control segmentado (segmented)
Para opciones excluyentes (tema, densidad). Contenedor `--surface-2` con borde; botón
activo `--accent`/blanco.

### 6.10 Drawer de apariencia
Panel 340px desde la derecha + scrim translúcido. Contiene los controles de
personalización (ver sección 8).

### 6.11 Búsqueda global
En la top bar, fondo `--surface-2`, ícono lupa, placeholder "Buscar producto, cliente,
comprobante…". Atajo sugerido: `/` o `Ctrl+K`.

---

## 7. Patrones de interacción y teclado

### 7.1 Mapa de atajos (POS)
| Tecla | Acción |
|-------|--------|
| `F2` | Foco a buscar/escanear |
| `F4` | Cambiar/identificar cliente |
| `F6` | Descuento |
| `F9` | Cobrar e imprimir |
| `Esc` | Cancelar venta en curso |
| `Supr` | Quitar línea seleccionada |
| `/` o `Ctrl+K` | Búsqueda global |

### 7.2 Comportamiento del lector
El lector entra como HID (teclado): inyecta el código y un Enter. El campo de escaneo lo
captura, resuelve el producto y agrega la línea (animación `flash`). Distinguir por formato
si es QR de producto vs EAN del fabricante.

### 7.3 Foco
Al entrar al POS, foco automático en el campo de escaneo. Tras cada alta de línea, el foco
vuelve al campo. Anillo de foco visible (accesibilidad) en todos los controles.

### 7.4 Autorizaciones del Supervisor
Cuando una acción requiere autorización (exceso de crédito, sobre-recepción, cierre con
diferencia, override de precio), abrir un **modal de autorización** que pide credenciales
del Supervisor; al confirmar, la acción procede y queda registrada. Patrón visual: modal
centrado con ícono de candado en `--accent`.

---

## 8. Personalización (menú de Apariencia)

- **Alcance: por usuario.** Las preferencias se guardan asociadas al `Usuario` (no a la
  terminal). Sugerencia de modelo: tabla `UsuarioPreferencias` (o columnas en `Usuario`)
  con `tema`, `acento`, `ui_font`, `densidad`.
- **Configurable:** Tema (claro/oscuro), Acento (5 opciones), Tipografía de interfaz
  (3 opciones de métrica similar), Densidad (cómoda/compacta).
- **NO configurable (blindado):** la fuente de los números (siempre JetBrains Mono), para
  no perder la alineación tabular. La nota del drawer lo comunica al usuario.
- **Aplicación:** los controles cambian los tokens/atributos en vivo (`data-theme`,
  `data-density`, `--accent*`, `--ui-font`). Al iniciar sesión se cargan las preferencias
  del usuario.

---

## 9. Estados de la interfaz

| Estado | Patrón |
|--------|--------|
| **Vacío** | Mensaje breve + ícono tenue + acción sugerida (ej. "Escaneá el primer producto"). |
| **Cargando** | Skeletons en tablas/paneles; nunca bloquear el campo de escaneo. |
| **Error de validación** | Borde `--danger` en el campo + mensaje corto debajo. |
| **Sin conexión (offline)** | Indicador discreto en top bar ("Sin conexión · se sincronizará"); NO bloquea la operación. |
| **Sincronizando / pendiente** | Ícono sutil con contador de operaciones en outbox; verde al quedar al día. |
| **Sin stock** | Bloqueo de la venta del ítem con mensaje claro (regla dura). |
| **Requiere Supervisor** | Modal de autorización (sección 7.4). |

---

## 10. Accesibilidad

- Contraste mínimo AA en texto sobre fondos (verificar acentos sobre `--surface`).
- Foco visible en todos los controles (anillo `--accent`).
- Objetivos táctiles/clic ≥ 38px.
- No comunicar estado solo por color (acompañar con ícono/texto: ej. caja abierta = punto
  verde + texto).
- Tamaño de fuente base cómodo (14px+) por el uso prolongado.

---

## 11. Ejemplos de referencia

- **`mockup-pos-ferreteria-v2.html`** — ejemplo canónico: sidebar + top bar + POS + drawer
  de apariencia funcionando (tema, acento, fuente, densidad en vivo). Usar como fuente de
  verdad visual.
- **`mockup-pos-ferreteria.html`** — primera versión (POS con toggle claro/oscuro), útil
  como referencia del panel de totales y la barra de atajos inferior.

### 11.1 Ejemplo: aplicar acento al cambiar de tema (JS)
```js
function applyAccent(name){
  const p = ACCENTS[name];
  root.style.setProperty('--accent', p.a);
  root.style.setProperty('--accent-strong', p.s);
  const dark = root.getAttribute('data-theme') === 'dark';
  root.style.setProperty('--accent-soft', dark ? p.softD : p.softL);
}
```

### 11.2 Ejemplo: estructura mínima de pantalla
```html
<nav class="side">…navegación de módulos…</nav>
<div class="shell">
  <header>…título · búsqueda · sesión · apariencia…</header>
  <main>
    <section class="panel">…contenido del módulo…</section>
    <aside class="rightcol">…panel contextual (opcional)…</aside>
  </main>
</div>
```

---

## 12. Indicaciones para superpowers

- Implementar los tokens como **CSS custom properties** centralizadas; nada de colores
  hardcodeados en componentes.
- Construir una **biblioteca de componentes** (React) que consuma los tokens: Button,
  IconButton, Chip, ScanField, DataTable, TotalsPanel, PaymentSelector, SidebarNav,
  TopBar, Drawer, Segmented, Swatch, AuthModal, EmptyState, Skeleton.
- El tema/acento/fuente/densidad se aplican a nivel raíz (atributos `data-*` y variables),
  no por componente.
- Respetar el blindaje de la fuente numérica y las reglas de uso del color (sección 2.5).
- Tomar `mockup-pos-ferreteria-v2.html` como referencia visual y de comportamiento.

---

## 13. Bitácora

Cambios sobre **este documento**. El sistema de diseño describe una intención; `global.css`
es la implementación. Cuando divergen, la divergencia se anota acá antes de resolverse — no
se "arregla" el documento para que coincida con el código ni al revés sin decisión.

### 2026-07-24 — Remediación AUD-20260723, Lote 0

Origen: auditoría `docs/Auditoria/AUDIT-20260723.md`, hallazgo 016.

**Agregado**

1. **Bitácora creada.** El documento terminaba en §12 sin registro de cambios, pese a que
   `global.css` había incorporado tokens no documentados. A2 la exige poblada si hubo cambios.
2. **§2.4 "Semánticos de estado"** — documenta **`--warn`** (claro `#B4690E` / oscuro
   `#E0A23A`) y su criterio de uso frente a `--danger`. Se agregó además la regla explícita
   de que la paleta semántica es cerrada (`--ok` / `--warn` / `--danger`), porque el renderer
   había desarrollado tres vocabularios paralelos para el mismo concepto
   (`--success`, `--color-success`, …) — hallazgo AUD-20260723-009, que se corrige en el
   Lote 3 de la remediación. El "Uso del color" pasó de §2.4 a **§2.5**; la referencia de §12
   se actualizó.
3. **§4 — tabla de tokens estructurales** con `--radius`, `--pad`, `--rowpad` y **`--shadow`**,
   y su eje de conmutación (densidad vs. tema). `--shadow` no existía como token: §4 daba los
   dos valores de sombra en prosa, lo que invitaba a copiarlos literales en cada componente.
4. **§3.1 — `--ui-font` explicitado como token de primera clase**, con quién lo escribe
   (drawer de Apariencia, §8, desde `usuario_preferencias.ui_font`) y por qué la fuente
   numérica no es token.

**Precisión sobre el hallazgo.** AUD-016 afirma que los seis tokens (`--pad`, `--radius`,
`--rowpad`, `--shadow`, `--warn`, `--ui-font`) no estaban documentados. Verificado contra el
texto: `--pad`, `--radius` y `--rowpad` ya aparecían en el bloque CSS de §4 y `--ui-font` en
el de §3.1 — estaban **dentro de ejemplos de código, pero fuera del vocabulario de tokens**,
que sólo §2 presentaba como registro. Realmente ausentes: **`--warn` y `--shadow`**. Los seis
quedan ahora documentados como tokens nombrados, con rol y conmutación.

**Divergencias doc ↔ `global.css` detectadas y NO resueltas en este lote** (son decisiones de
diseño, no erratas; requieren definición del PO):

| § | Documento | `global.css` |
|---|-----------|--------------|
| 2.2 | selector `[data-theme="dark"]` | `[data-theme="oscuro"]` |
| 2.3 | `--accent-soft` distinto en tema oscuro (5 valores) | **no implementado**: no hay override oscuro de los acentos |
| 2.3 | azul `#1D4FD7`/`#DBE5FF`, verde `#178045`/`#D6F0DF`, violeta `#6A2BD0`/`#EADDFD`, ladrillo `#982F24`/`#F6DCD8` | `#1D4ED8`/`#DBEAFE`, `#166534`/`#DCFCE7`, `#6D28D9`/`#EDE9FE`, `#9B1C1C`/`#FEE2E2` |
| 3.1 | `--ui-font:'Hanken Grotesk'` (default) | `--ui-font:'Archivo'` |

Corregido en el documento por ser transcripción y no decisión: `--rowpad` pasó de `13px`
(documentado) a `12px` (implementado). El resto queda como está, anotado acá.
