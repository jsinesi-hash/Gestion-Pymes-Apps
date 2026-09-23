import { useAuth } from '../auth/AuthContext';
import { usePreferencias } from '../hooks/usePreferencias';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

type Tema = 'claro' | 'oscuro';
type Acento = 'amber' | 'blue' | 'green' | 'violet' | 'brick';
type Font = 'Hanken Grotesk' | 'Inter' | 'IBM Plex Sans' | 'Atkinson Hyperlegible' | 'Nunito' | 'Barlow Semi Condensed';
type Skin = 'actual' | 'maximizar' | 'confortable';

const ACENTO_COLORS: Record<Acento, string> = {
  amber:  '#E8730A',
  blue:   '#2563EB',
  green:  '#1F9D55',
  violet: '#7C3AED',
  brick:  '#B23A2E',
};

const fonts: { value: Font; label: string; sub: string }[] = [
  { value: 'Hanken Grotesk',        label: 'Hanken Grotesk',        sub: 'Moderna y geométrica' },
  { value: 'Inter',                 label: 'Inter',                 sub: 'Interfaz densa y legible' },
  { value: 'IBM Plex Sans',         label: 'IBM Plex Sans',         sub: 'Técnica y con carácter' },
  { value: 'Atkinson Hyperlegible', label: 'Atkinson Hyperlegible', sub: 'Máxima legibilidad' },
  { value: 'Nunito',                label: 'Nunito',                sub: 'Redondeada y cálida' },
  { value: 'Barlow Semi Condensed', label: 'Barlow Semi Condensed', sub: 'Condensada, más datos' },
];

const skins: { value: Skin; label: string; sub: string }[] = [
  { value: 'actual',      label: 'Actual',               sub: 'Equilibrado, como hasta ahora' },
  { value: 'maximizar',   label: 'Maximizar información', sub: 'Denso y compacto: más datos en pantalla' },
  { value: 'confortable', label: 'Confortable',          sub: 'Espacioso y moderno' },
];

// ADR-086: la densidad se deriva del modo (el Modo reemplazó al control de Densidad).
export function densidadDeSkin(skin: string): 'comfortable' | 'compact' {
  return skin === 'maximizar' ? 'compact' : 'comfortable';
}

function applyToDOM(prefs: { tema: string; acento: string; ui_font: string; skin: string }) {
  const html = document.documentElement;
  html.setAttribute('data-theme', prefs.tema);
  html.setAttribute('data-accent', prefs.acento);
  html.setAttribute('data-skin', prefs.skin);
  html.setAttribute('data-density', densidadDeSkin(prefs.skin));
  html.style.setProperty('--ui-font', prefs.ui_font);
}

export function AppearanceDrawer({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const { preferencias, guardar } = usePreferencias();

  useEscapeToClose(onClose);

  const current = preferencias ?? {
    tema: session?.preferencias?.tema ?? 'claro',
    acento: session?.preferencias?.acento ?? 'amber',
    ui_font: session?.preferencias?.ui_font ?? 'Hanken Grotesk',
    skin: session?.preferencias?.skin ?? 'actual',
  };

  async function handleChange(update: Partial<typeof current>) {
    const next = { ...current, ...update };
    applyToDOM(next);
    // Enviar SOLO los campos de apariencia que edita el drawer. `current` puede ser la fila
    // completa de preferencias (incluye `favoritos` como string JSON y `pantalla_inicio`);
    // reenviar esos campos hace que el handler corra normalizarFavoritos() sobre un string y
    // lance, el await rechaza y setPreferencias nunca corre → el tema cambia (applyToDOM)
    // pero el botón no queda seleccionado.
    await guardar({
      tema: next.tema,
      acento: next.acento,
      ui_font: next.ui_font,
      skin: next.skin,
    });
  }

  return (
    <>
      <div className={`scrim open`} onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-header">
          Apariencia
          <button onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="drawer-body">

          <div>
            <div className="card-title" style={{ padding: '0 0 10px' }}>Tema</div>
            <div className="seg">
              {(['claro', 'oscuro'] as Tema[]).map(t => (
                <button key={t} className={current.tema === t ? 'on' : ''} onClick={() => handleChange({ tema: t })}>
                  {t === 'claro' ? '☀ Claro' : '◐ Oscuro'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="card-title" style={{ padding: '0 0 10px' }}>Color de acento</div>
            <div className="swatches">
              {(Object.keys(ACENTO_COLORS) as Acento[]).map(a => (
                <div key={a} className={`sw${current.acento === a ? ' on' : ''}`}
                  style={{ background: ACENTO_COLORS[a] }}
                  onClick={() => handleChange({ acento: a })}
                  title={a}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="card-title" style={{ padding: '0 0 10px' }}>Tipografía</div>
            <div className="font-opts">
              {fonts.map(f => (
                <button key={f.value} className={`font-opt${current.ui_font === f.value ? ' on' : ''}`}
                  style={{ fontFamily: f.value }}
                  onClick={() => handleChange({ ui_font: f.value })}>
                  <div className="fn">{f.label}</div>
                  <div className="fs">{f.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="card-title" style={{ padding: '0 0 10px' }}>Modo</div>
            <div className="font-opts">
              {skins.map(s => (
                <button key={s.value} className={`font-opt${current.skin === s.value ? ' on' : ''}`}
                  onClick={() => handleChange({ skin: s.value })}>
                  <div className="fn">{s.label}</div>
                  <div className="fs">{s.sub}</div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
