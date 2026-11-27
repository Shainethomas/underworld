import { audio } from '../engine/audio'
import { CHAPTER, useGame } from '../game/store'
import { Icon } from './Icon'

const soon = (what: string) => {
  audio.play('tick')
  const s = useGame.getState()
  useGame.setState({ toasts: [...s.toasts.slice(-3), { id: Date.now(), text: `${what} — coming soon`, kind: 'objective' }] })
}

/** Top bar: identity, level, currencies, menu. */
export function TopBar() {
  const player = useGame((s) => s.player)
  const pct = Math.round((player.xp / player.xpToNext) * 100)
  return (
    <header className="topbar">
      <div className="topbar__portrait">
        <img src="/assets/images/portrait_rookie.png" alt="" />
      </div>
      <div className="topbar__id">
        <span className="topbar__name">{player.name}</span>
        <span className="topbar__lv">
          Lv. {player.level}
          <span className="topbar__xp">
            <i style={{ width: `${Math.max(4, pct)}%` }} />
          </span>
        </span>
      </div>
      <button className="pill" aria-label={`Cash ${player.cash.toLocaleString()}, get more`} onClick={() => soon('Store')}>
        <Icon name="cash" />
        <span className="pill__val">{player.cash.toLocaleString()}</span>
        <span className="pill__plus">
          <Icon name="plus" />
        </span>
      </button>
      <button className="pill" aria-label={`Gems ${player.gold}, get more`} onClick={() => soon('Store')}>
        <Icon name="gem" />
        <span className="pill__val">{player.gold}</span>
        <span className="pill__plus">
          <Icon name="plus" />
        </span>
      </button>
      <button
        className="topbar__menu"
        aria-label="Menu"
        onClick={() => {
          audio.play('tick')
          useGame.getState().setSettingsOpen(true)
        }}
      >
        <Icon name="menu" />
      </button>
    </header>
  )
}

/** Chapter ribbon + current objective, top-left of the scene window. Tap for the full list. */
export function ObjectiveChip() {
  const open = useGame((s) => s.objectivesOpen)
  const objectives = useGame((s) => s.objectives)
  const index = CHAPTER.objectives.findIndex((o) => objectives[o.id] === 'active')
  const active = CHAPTER.objectives[index]
  return (
    <button
      className={`objective ${open ? 'objective--open' : ''}`}
      onClick={() => {
        audio.play('tick')
        useGame.getState().setObjectivesOpen(!open)
      }}
    >
      <span className="objective__chapter">
        Chapter {CHAPTER.number} — {CHAPTER.title}
      </span>
      {active && (
        <span className="objective__current">
          <Icon name="target" />
          {active.text} ({index + 1}/{CHAPTER.objectives.length})
        </span>
      )}
      {open && (
        <ul className="objective__list">
          {CHAPTER.objectives.map((o) => {
            const st = objectives[o.id]
            return (
              <li key={o.id} className={`objective__item objective__item--${st}`}>
                <span className="objective__check">{st === 'done' ? '✓' : st === 'active' ? '◆' : ''}</span>
                {st === 'locked' ? '? ? ?' : o.text}
              </li>
            )
          })}
        </ul>
      )}
    </button>
  )
}
