# Documentación — Ferretería-app

> Índice de la documentación del proyecto. Ver el esquema completo (estructura de carpetas, estrategia de reutilización, plan por lotes) en [`Prompts/00-Esquema-Maestro-Documentacion.md`](Prompts/00-Esquema-Maestro-Documentacion.md).

## Estado

Esta carpeta se reconstruyó el 2026-08-21 después de que su contenido anterior se perdiera (nunca había sido commiteado a git; no se pudo determinar la causa — ver detalle en la sesión de esa fecha). Lo recuperado:

- ✅ **Esquema maestro** — restaurado textual, sin pérdida ([`Prompts/00-Esquema-Maestro-Documentacion.md`](Prompts/00-Esquema-Maestro-Documentacion.md)).
- ✅ **Manual de Usuario** — borrador original restaurado ([`Prompts/Manual-de-Usuario-Ferreteria.md`](Prompts/Manual-de-Usuario-Ferreteria.md)) y versión final con capturas reales insertadas ([`Usuario/manual-usuario.md`](Usuario/manual-usuario.md)).
- ✅ **39 capturas de pantalla** de la app actual en [`Usuario/assets/`](Usuario/assets/), tomadas vía CDP (Chrome DevTools Protocol) contra la app real con datos de desarrollo.
- ⬜ **Glosario, matriz de trazabilidad, documentación técnica (SDD), diagramas** — no se habían leído completos antes de perderse, así que no son recuperables; quedan pendientes de generar desde cero (Lote 2 en adelante del plan del esquema maestro).

## Mapa

```
docs/Documentacion/
├─ README.md                    # este archivo
├─ Prompts/                     # prompts y borradores fuente (no se sobreescriben sin mostrar diff)
│  ├─ 00-Esquema-Maestro-Documentacion.md
│  └─ Manual-de-Usuario-Ferreteria.md
├─ Usuario/                     # Manual de Usuario — versión final
│  ├─ manual-usuario.md
│  └─ assets/                   # capturas de pantalla (39 archivos)
└─ Tecnica/                     # SDD — pendiente de generar (Lote 2)
```
