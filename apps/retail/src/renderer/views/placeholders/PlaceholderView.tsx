import { useLocation } from 'react-router-dom';

export function PlaceholderView() {
  const { pathname } = useLocation();
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2 style={{ textTransform: 'capitalize', fontWeight: 700 }}>{pathname.replace('/', '')}</h2>
      <p className="text-muted" style={{ marginTop: '0.5rem' }}>Proximamente</p>
    </div>
  );
}
