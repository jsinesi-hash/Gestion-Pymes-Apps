# Plan — SMTP al núcleo y recuperación de contraseña en Elaborados

**Fecha:** 2026-11-03 · **Estado:** aprobado por el usuario. PR 1 implementado (ADR-142); PR 2 (Elaborados) pendiente

## Pedido y contexto

El ADR-137 dejó la recuperación de contraseña por mail solo en Retail, porque Retail es la única app con
SMTP. Quedó anotado como pendiente: «recuperación para Elaborados (requiere mover el SMTP al núcleo)».
El usuario pidió seguir con eso. Este plan es para revisarlo antes de escribir código.

## Qué hay hoy (verificado en el código)

**Retail tiene todo el SMTP, repartido en 6 archivos (~380 líneas) y 4 de tests:**

| Pieza | Archivo | Qué hace |
|---|---|---|
| Lectura de la configuración | `agenda/canales/smtp-config.ts` | lee `smtp_host/port/secure/from/user` de `parametros_sistema` |
| Clave del servidor | `seguridad/smtp-secret.ts` | la guarda cifrada con `safeStorage` en `userData/smtp-secret.bin` (ADR-048) |
| Enviador de la recuperación | `seguridad/enviador-correo.ts` | implementa `EnviadorCorreo` del núcleo (ADR-137) |
| Handlers IPC | `ipc/smtp.ts` | `smtp:getConfig`, `setConfig`, `setPassword`, `probar` (usa `nodemailer`) |
| Pantalla | `renderer/views/config/ConfigSmtp.tsx` | Configuración → Email / SMTP |
| Canal de la agenda | `agenda/canales/email.ts` | avisos de cierre de caja; importa los de arriba |

- Importan estos módulos: `agenda/canales/email.ts`, `ipc/smtp.ts`, `enviador-correo.ts`, `index.ts`,
  la ruta `config/smtp`, el preload (`smtp` en `canales.ts`) y la navegación (ítem y crumb).
- **Elaborados no tiene nada de esto.** Su `parametros_sistema` no tiene las claves `smtp_*`.
- **`parametrosSetHandler` solo hace `UPDATE`** (no inserta). Las filas `smtp_*` las siembra la migración
  `0027_adr048_cierre_email` de Retail. En Elaborados, `smtp:setConfig` no guardaría nada y no daría error.
  Hace falta una migración que las siembre.
- **Empaquetado:** en las dos apps solo `better-sqlite3` es externo en `vite.main.config.mts`; el resto
  (p. ej. `exceljs`, que ya viene del núcleo) se incluye en el bundle del main. `nodemailer` es JS puro:
  moverlo al núcleo no requiere tocar `forge.config.ts`.
- `config.fiscal` (el permiso de la pantalla SMTP) es un permiso del núcleo: lo tiene el Supervisor de ambas apps.

## Diseño

El SMTP es universal (lo necesita toda app con recuperación de contraseña) y no cambia de forma entre
apps: va al núcleo, con el mismo patrón de seams que ya usan caja, backup y el enviador.

### PR 1 — Mover el SMTP al núcleo (sin cambiar el comportamiento de Retail)

1. **`@core/main`:** `correo/smtp-config.ts`, `correo/smtp-secret.ts` (mismo archivo `smtp-secret.bin`, así
   que las instalaciones actuales de Retail siguen funcionando sin migrar nada), `correo/enviador-smtp.ts`
   (`crearEnviadorSmtp` y `crearEnviadorSmtpReal`) e `ipc/smtp.ts`.
2. **`registerCoreHandlers`** registra los cuatro canales `smtp:*` y usa por defecto el enviador SMTP real.
   La opción `enviadorCorreo` se mantiene como override. Las apps dejan de registrar `smtp:*` y de pasar el
   enviador.
3. **`nodemailer`** (y `@types/nodemailer`) pasa a las dependencias de `@core/main`. El lockfile se edita **a
   mano** (solo las líneas del importador); no se corre `pnpm install` filtrado ni completo: rompió el
   `node_modules` hoisted la última vez (ver memoria del proyecto).
4. **`@core/preload`:** el namespace `smtp` pasa a `coreCanales`, tipado. Se saca de
   `apps/retail/src/preload/canales.ts` (si no, `BRIDGE_COLISION` al arrancar).
5. **`@core/ui`:** `ConfigSmtp` se mueve y se exporta. Retail importa de `@core/ui`.
6. **Retail:** `agenda/canales/email.ts` importa del núcleo; se borran los archivos movidos; `index.ts` deja
   de registrar `registerSmtpHandlers` y de pasar `enviadorCorreo`.
7. **Tests:** `smtp-secret.test.ts` y `enviador-correo.test.ts` pasan al núcleo (Node); `smtp.handlers.test.ts`
   pasa a `*.db.test.ts` del núcleo (sembrando las 5 claves, porque el esquema generado no trae filas);
   `email-adapter.test.ts` y `ConfigSmtp.test.tsx` se quedan en Retail con los imports nuevos. El test de
   cableado de Retail se reemplaza por uno del registrador: registra los 4 canales `smtp:*` y usa el
   enviador real por defecto. Nada pierde cobertura.

### PR 2 — Elaborados

1. **Migración `0013` (a mano):** `INSERT OR IGNORE` de las 5 claves `smtp_*` con los mismos valores y
   descripciones que `0027` de Retail, más la entrada en el journal.
2. **Navegación:** ruta `config/smtp`, ítem «Email / SMTP» en el grupo Sistema con permiso `config.fiscal` y
   su crumb. El test `nav.test.tsx` de Elaborados ya verifica que ruta, ítem y crumb existan los tres.
3. **Efecto:** con el SMTP configurado por un Supervisor, `recuperacionDisponible` da verdadero y el login de
   Elaborados ofrece «Olvidé mi contraseña»; sin configurar, no se ofrece (igual que en Retail).
4. **Tests:** guardar la configuración en Elaborados persiste (la regresión del `UPDATE` sin fila); con SMTP
   configurado la recuperación está disponible de punta a punta contra la base de Elaborados; la ruta es
   alcanzable. ADR y `Estado.md`.

## Riesgos y límites

- **El lockfile:** editar a mano es la única forma segura que conozco acá. Se verifica corriendo las suites,
  no reinstalando.
- **No hay envío real verificado:** ni en Retail (ADR-137) ni en Elaborados. Los tests usan un transporte
  falso. Probar con un SMTP real queda a cargo del usuario.
- **Empaquetado de Elaborados sin verificar:** por el análisis de externos debería funcionar sin cambios,
  pero no se puede generar el instalador en este entorno.
- **Sin migración de datos en Retail:** la clave del SMTP queda en el mismo archivo y la configuración en
  las mismas filas. Un rollback del PR 1 es seguro.
- La agenda por mail (avisos de cierre de caja) sigue siendo solo de Retail; este plan no la mueve.

## Preguntas abiertas (con mi propuesta)

1. **¿Uno o dos PRs?** Propongo dos: el 1 es un movimiento mecánico sin cambio visible; el 2 es el cambio
   funcional. Si el 1 sale mal, el 2 no corre riesgo y se puede revertir por separado.
2. **¿El Supervisor de Elaborados configura el SMTP desde la propia app?** Propongo que sí, en
   Configuración → Email / SMTP, sin valores por defecto ni servidor propio.

## Fuera de este plan

Mover la agenda por mail, presets por proveedor (Gmail, Outlook), OAuth, plantillas de mail, y cualquier
cambio en el flujo de la recuperación (ADR-137).
