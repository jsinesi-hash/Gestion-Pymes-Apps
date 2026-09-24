// Placeholder de pantalla de inicio propia de Elaborados. E1 no la usa en `routes/index.tsx`:
// el índice ('/') resuelve con `InicioRedirect` del core, que hoy siempre cae en
// `navegacionElaborados.inicioFallback` ('/caja' — ver src/common/navegacion.ts), así que este
// componente no está montado todavía. Se scaffoldea acá porque el plan de Task C4 lo lista
// entre los archivos a crear, para que E2+ (dashboard propio de Heladería) tenga dónde
// empezar sin repetir la duda de arquitectura. No agregar una ruta que lo use sin confirmar
// primero el diseño (CLAUDE.md §Navegación — evitar el patrón de componente huérfano).
export function Inicio() {
  return (
    <div className="page">
      <h1>Heladería</h1>
      <p>Pantalla de inicio pendiente de diseño (E2+).</p>
    </div>
  );
}
