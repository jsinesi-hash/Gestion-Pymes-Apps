import { inicioDelDia, finDelDia, ymdLocal } from '@ferreteria/shared';
import type { RangeKey } from '../hooks/usePeriod';

const LABELS: { key: RangeKey; label: string }[] = [
  { key: 'hoy',       label: 'Hoy' },
  { key: 'semana',    label: 'Semana' },
  { key: 'mes',       label: 'Mes' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'custom',    label: 'Personalizado' },
];

type Props = {
  active: RangeKey;
  onChange: (k: RangeKey) => void;
  customFrom?: Date | undefined;
  customTo?: Date | undefined;
  onCustomChange?: ((from: Date, to: Date) => void) | undefined;
};

export function PeriodSelector({ active, onChange, customFrom, customTo, onCustomChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {LABELS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: active === key ? 'var(--accent)' : 'transparent',
            color: active === key ? '#fff' : 'inherit',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
          }}
        >
          {label}
        </button>
      ))}
      {active === 'custom' && onCustomChange && (
        <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginLeft: '0.25rem' }}>
          <input
            type="date"
            className="input"
            style={{ padding: '0.15rem 0.4rem', fontSize: '0.8rem' }}
            value={customFrom ? ymdLocal(customFrom) : ''}
            onChange={e => {
              const d = inicioDelDia(e.target.value);
              onCustomChange(d, customTo ?? d);
            }}
          />
          <span className="text-muted">—</span>
          <input
            type="date"
            className="input"
            style={{ padding: '0.15rem 0.4rem', fontSize: '0.8rem' }}
            value={customTo ? ymdLocal(customTo) : ''}
            onChange={e => {
              const d = finDelDia(e.target.value);
              onCustomChange(customFrom ?? d, d);
            }}
          />
        </span>
      )}
    </div>
  );
}
