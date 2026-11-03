import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';

// Revisión 2026-10-20 (P1): el renderer no tenía ErrorBoundary: una excepción de render dejaba la
// ventana de Electron en blanco, en pleno POS. Estos componentes reemplazan SOLO la pantalla que
// falla (el menú y los providers —por ejemplo el carrito del POS— siguen en pie).

export type FallbackProps = { error: Error; reintentar: () => void };

/** Aviso presentacional. No muestra el mensaje técnico: se registra en consola. */
export function PantallaError({ reintentar, alReiniciar }: Readonly<{ reintentar?: () => void; alReiniciar?: () => void }>) {
  return (
    <div role="alert" className="card" style={{ maxWidth: 560, margin: '3rem auto', padding: '1.5rem' }}>
      <h2 style={{ margin: '0 0 .5rem', fontSize: '1.1rem', fontWeight: 700 }}>Algo salió mal en esta pantalla</h2>
      <p style={{ margin: '0 0 1rem', opacity: 0.85 }}>
        El resto de la aplicación sigue funcionando. Podés reintentar o ir a otra sección del menú.
        Si el problema se repite, avisá a soporte.
      </p>
      <div className="flex gap-2" style={{ display: 'flex', gap: '.5rem' }}>
        {reintentar && <button type="button" className="btn-primary" onClick={reintentar}>Reintentar</button>}
        {alReiniciar && <button type="button" className="btn-secondary" onClick={alReiniciar}>Reiniciar la aplicación</button>}
      </div>
    </div>
  );
}

type Props = {
  children: ReactNode;
  /** Cuando cambia (p. ej. la ruta), un error previo se descarta y se vuelve a intentar. */
  resetKey?: unknown;
  fallback?: (props: FallbackProps) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Muestra además un botón que recarga la ventana (para el nivel de toda la aplicación). */
  recargable?: boolean;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && !Object.is(prev.resetKey, this.props.resetKey)) {
      this.setState({ error: null });
    }
  }

  private reintentar = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback({ error, reintentar: this.reintentar });
    return (
      <PantallaError
        reintentar={this.reintentar}
        {...(this.props.recargable ? { alReiniciar: () => window.location.reload() } : {})}
      />
    );
  }
}

/** `errorElement` de react-router: sin esto, un error en el shell muestra la pantalla por defecto. */
export function ErrorDeRuta() {
  const error = useRouteError();
  console.error('[ErrorDeRuta]', error);
  return <PantallaError alReiniciar={() => window.location.reload()} />;
}
