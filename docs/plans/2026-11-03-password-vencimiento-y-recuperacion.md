# Plan — Vencimiento de contraseña a los 30 días, mail obligatorio y recuperación por mail

**Fecha:** 2026-11-03 · **Estado:** aprobado por el usuario. PR 1 implementado (ADR-136) y PR 2 implementado (ADR-137)

## Pedido

> «recuperación de contraseña por mail, que tiene que ser obligatorio para los nuevos usuarios,
> solicitar cambio de contraseña cada 30 días.»

## Decisiones ya tomadas por el usuario

| Tema | Decisión |
|---|---|
| Alcance de apps | **Retail primero.** Retail ya tiene SMTP (nodemailer, config en `parametros_sistema`, clave en `safeStorage`). El núcleo define una interfaz para enviar el correo y Retail la implementa. Elaborados recibe el vencimiento de 30 días y el mail obligatorio, pero no la recuperación por mail hasta tener su propio SMTP. |
| Usuarios existentes sin mail | Se les **pide el mail al próximo login**, antes de entrar. Los usuarios nuevos no se pueden crear sin mail. |
| Vencimiento | **30 días, para todos** (Supervisores incluidos), cambio **obligatorio al vencer**. El plazo de los usuarios actuales empieza el día de la migración. |

## Qué hay hoy (verificado en el código)

- `usuario.email` existe (migración 0001) pero es opcional; `usuarioCreateHandler` lo acepta vacío.
- No hay fecha del último cambio de contraseña: hace falta una columna y una migración **en cada app**
  (el esquema `usuario` es del núcleo, `@core/db`).
- `loginHandler` (`packages/core-main/src/ipc/auth.ts`) valida credenciales, aplica el límite de
  intentos y crea la sesión. `usuarioChangePasswordHandler` cambia la clave exigiendo la actual.
- El correo solo existe en Retail (`apps/retail/src/main/agenda/canales/email.ts`, `smtp-config.ts`,
  `seguridad/smtp-secret.ts`). Elaborados no tiene nada.
- El generador de migraciones de Retail está desactualizado (ver memoria del proyecto): las migraciones
  nuevas se escriben a mano, con su entrada en `meta/_journal.json`.

## Principio de diseño: sin sesión no hay forma de saltearse el bloqueo

Si el login creara la sesión y el renderer mostrara una pantalla «obligatoria», cualquier canal IPC que
use `getSession()` directamente quedaría accesible. En cambio, cuando la contraseña venció o falta el
mail, **el login verifica las credenciales pero no crea la sesión**: responde con un error específico
(`PASSWORD_VENCIDA` o `EMAIL_REQUERIDO`) y el renderer muestra el paso correspondiente, que vuelve a
enviar las credenciales a un canal propio que las verifica de nuevo (con el mismo límite de intentos) y
recién entonces completa el login.

## PR 1 — `password_changed_at`, vencimiento de 30 días y mail obligatorio

1. **Esquema.** `usuario.password_changed_at` (`integer`, timestamp, nullable) en `@core/db`.
   Migración a mano en Retail y en Elaborados: `ALTER TABLE usuario ADD COLUMN password_changed_at integer`
   y `UPDATE usuario SET password_changed_at = strftime('%s','now')` (los usuarios actuales no quedan
   bloqueados de golpe). Aditiva y retrocompatible (ADR-042).
2. **Política.** Módulo puro en el núcleo: `PASSWORD_VIGENCIA_DIAS = 30`, `passwordVencida(changedAt, ahora)`
   y validación de formato de mail. Sin `changedAt` (nulo) cuenta como vencida.
3. **Alta y cambios.** `usuarioCreateHandler` exige mail válido (`EMAIL_REQUERIDO` / `EMAIL_INVALIDO`).
   Todo lugar que cambia la contraseña (`usuarioChangePasswordHandler`, alta, restablecimiento por
   Supervisor) actualiza `password_changed_at`. Un restablecimiento hecho por un Supervisor deja la
   contraseña **vencida** (el usuario debe cambiarla en su primer ingreso).
4. **Login.** Con credenciales correctas: contraseña vencida → `PASSWORD_VENCIDA`; mail vacío →
   `EMAIL_REQUERIDO`; ninguna sesión se crea. El orden es: vencida primero, mail después.
5. **Canales nuevos** (núcleo, pre-sesión, con límite de intentos): `auth:cambiarPasswordVencida`
   (`nombreUsuario`, `passwordActual`, `passwordNueva`) y `auth:completarEmail` (`nombreUsuario`,
   `password`, `email`). Ambos verifican credenciales y, si todo está bien, devuelven la sesión.
   La nueva contraseña pasa por la política existente y no puede ser igual a la actual.
6. **Renderer (`@core/ui`).** `LoginView` reconoce los dos errores y muestra el paso de cambio de
   contraseña o de carga de mail. `ConfigMiCuenta` muestra los días que quedan. `ConfigUsuarios`
   pide el mail en el alta.
7. **Tests.** Política pura; login (vencida, sin mail, ambas, ninguna); cambio forzado y carga de mail
   (credenciales malas cuentan para el límite, política de contraseña, no reutilizar la actual);
   alta sin mail; restablecimiento deja la clave vencida; `LoginView`; migraciones aplican en ambas
   apps. ADR + `Estado.md` en el mismo PR.

## PR 2 — Recuperación por mail (Retail)

1. **Esquema.** Tabla `recuperacion_password` en `@core/db` (id, `usuario_id`, `codigo_hash`,
   `expira_en`, `intentos`, `usado`, `creado_en`) y migración en ambas apps. Estado operativo local:
   sin campos de sincronización.
2. **Flujo.** Código numérico de **6 dígitos** enviado por mail, válido **15 minutos**, de un solo uso,
   máximo **5 intentos**. Se guarda solo su hash. Pedir un código nuevo invalida el anterior.
3. **Canales** (núcleo, pre-sesión): `auth:recuperacionDisponible` (¿hay un enviador de correo
   configurado?), `auth:recuperarSolicitar` (`identificador`) y `auth:recuperarConfirmar`
   (`identificador`, `codigo`, `passwordNueva`).
4. **Sin enumeración de usuarios.** `recuperarSolicitar` responde siempre lo mismo, exista o no el
   usuario o tenga o no mail. El pedido tiene su propio límite (3 por 15 minutos por usuario).
5. **Al confirmar.** Cambia la contraseña con la política vigente, actualiza `password_changed_at`,
   marca el código como usado y levanta el bloqueo por intentos de ese usuario.
6. **Envío.** El núcleo define `EnviadorCorreo` (`enviar({ para, asunto, texto })`); Retail lo implementa
   con la configuración SMTP y la clave de `safeStorage` que ya existen. Sin enviador (Elaborados, o
   Retail sin SMTP configurado) el enlace «Olvidé mi contraseña» no se muestra.
7. **Renderer.** Enlace en `LoginView` y un modal de dos pasos (pedir código, ingresar código y
   contraseña nueva).
8. **Offline.** La app sigue siendo offline-first: sin internet el correo no sale y se muestra un
   aviso claro. La salida de emergencia es que un Supervisor restablezca la contraseña (PR 1).
9. **Tests.** Generación y vencimiento del código, un solo uso, tope de intentos, no enumeración,
   límite de pedidos, hash en base, políticas de contraseña, levanta el bloqueo, enviador fallido,
   `recuperacionDisponible`, UI. ADR + `Estado.md`.

## Riesgos y límites declarados

- **La recuperación solo es tan segura como el buzón del usuario**, y depende de internet y de un SMTP
  bien configurado. Es una decisión de producto aceptada al pedirla.
- **El código viaja por correo en texto claro** (inherente al canal). Mitigado con 15 minutos,
  un solo uso y 5 intentos.
- **Un Supervisor sin mail ni acceso queda en manos de otro Supervisor** (no se puede desactivar al
  último, ADR-008). Si el único Supervisor olvida la clave y no hay SMTP, hay que restaurar un backup;
  no se agrega ninguna puerta trasera.
- Los hashes de contraseña siguen en la base local: el vencimiento y la recuperación protegen el uso
  normal de la app, no a quien ya tiene acceso al archivo `.db`.
- Los tests de UI no prueban la app real: queda **sin verificar en `pnpm dev`** hasta que se pruebe con
  la carpeta aislada (`GESTION_USER_DATA_DIR`).

## Fuera de este plan

Historial de contraseñas, bloqueo por reutilización, segundo factor, recuperación para Elaborados,
mover el SMTP al núcleo. El lockout persistente (rama `feat/lockout-login-persistente`, sin cambios)
queda en cola.
