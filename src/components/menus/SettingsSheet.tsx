import { useGame, type Settings } from '../../store/gameStore'
import { Icon } from '../common/Icon'

function Segmented<K extends keyof Settings>({ k, options }: { k: K; options: [Settings[K], string][] }) {
  const value = useGame((s) => s.settings[k])
  const set = useGame((s) => s.setSetting)
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={String(v)} className={value === v ? 'is-on' : ''} onClick={() => set(k, v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

interface Props {
  onClose: () => void
  inGame: boolean
  onRestart?: () => void
  /** In game: opens the scene's story log. */
  onLog?: () => void
  /** Opens Rookie's standing (rank, money, people, gear). */
  onStanding?: () => void
  info?: string
}

export function SettingsSheet({ onClose, inGame, onRestart, onLog, onStanding, info }: Props) {
  const settings = useGame((s) => s.settings)
  const set = useGame((s) => s.setSetting)
  const toMenu = useGame((s) => s.toMenu)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="sheet__head">
          <h2>{inGame ? 'Paused' : 'Settings'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="row">
          <span>Sound</span>
          <button className={`toggle ${settings.sound ? 'is-on' : ''}`} onClick={() => set('sound', !settings.sound)} aria-pressed={settings.sound}>
            <span />
          </button>
        </div>
        <label className="row">
          <span>Music</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={(e) => set('music', Number(e.target.value))} />
        </label>
        <label className="row">
          <span>Effects</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={(e) => set('sfx', Number(e.target.value))} />
        </label>
        <label className="row">
          <span>Voices</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.voice ?? 1} onChange={(e) => set('voice', Number(e.target.value))} />
        </label>
        <div className="row row--stack">
          <span>Text speed</span>
          <Segmented k="textSpeed" options={[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']]} />
        </div>
        <div className="row row--stack">
          <span>Graphics</span>
          <Segmented k="quality" options={[['auto', 'Auto'], ['high', 'High'], ['low', 'Low'], ['lite', 'Battery']]} />
        </div>
        <div className="row row--stack">
          <span>Renderer</span>
          <Segmented k="renderer" options={[['auto', 'Auto (WebGPU)'], ['webgl2', 'WebGL 2']]} />
        </div>
        <p className="sheet__note">Graphics and renderer changes apply the next time a scene loads.</p>

        {inGame && (
          <div className="sheet__actions">
            {onStanding && (
              <button className="btn btn--gold" onClick={onStanding}>
                <Icon name="fist" size={16} /> Standing
              </button>
            )}
            {onLog && (
              <button className="btn btn--ghost" onClick={onLog}>
                <Icon name="log" size={16} /> Story log
              </button>
            )}
            {onRestart && (
              <button className="btn btn--ghost" onClick={onRestart}>
                <Icon name="replay" size={16} /> Restart scene
              </button>
            )}
            <button className="btn btn--ghost" onClick={toMenu}>
              <Icon name="home" size={16} /> Main menu
            </button>
          </div>
        )}
        {info && <p className="sheet__info">{info}</p>}
      </div>
    </div>
  )
}
