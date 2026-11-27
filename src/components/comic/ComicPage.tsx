import { speakerName } from '../../game/narrative/NarrativeState'
import type { SpeakerId } from '../../game/narrative/types'
import { useGame } from '../../store/gameStore'
import { Icon } from '../common/Icon'
import { fmtCash, nextRank, rankById } from '../../game/progression/Progression'

// The game screen's parts: the top bar (rank, Respect toward the next rank,
// cash, menu), Next, narration and the story log. The scene sits under the
// top bar, the line, choices or skill moment below it. Styles:
// src/app/noir.css (comic.css, the earlier Graphic Novel theme, styles the
// same class names).

/**
 * The top strip: Rookie's rank, his Respect toward the next one, his cash,
 * and the menu (pause, standing, settings, story log). Rank changes only at a
 * job's debrief; Respect and cash move as he earns and spends them.
 */
export function ComicHeader() {
  const respect = useGame((s) => s.vars.respect)
  const cash = useGame((s) => s.vars.cash)
  const rankId = useGame((s) => (typeof s.flags.rank === 'number' ? s.flags.rank : 0))
  const setMenuOpen = useGame((s) => s.setMenuOpen)
  const rank = rankById(rankId)
  const next = nextRank(rank.id)
  const span = next ? next.at - rank.at : 1
  const fill = next ? Math.max(0, Math.min(1, (respect - rank.at) / span)) : 1
  return (
    <header className="comic-head">
      <span className="comic-rank" aria-label={`Rank: ${rank.name}`}>
        <span className="comic-rank__kicker">Rank</span>
        {rank.name}
      </span>
      <div className="comic-meters">
        <div className="comic-meter" role="meter" aria-label="Respect" aria-valuemin={rank.at} aria-valuemax={next?.at ?? respect} aria-valuenow={respect}>
          <Icon name="fist" size={16} className="comic-meter__icon comic-meter__icon--respect" />
          <span className="comic-meter__value" aria-hidden="true">
            Respect {respect}
            {next && <span className="comic-meter__goal"> / {next.at} {next.name}</span>}
          </span>
          <span className="comic-meter__track">
            <span className="comic-meter__fill comic-meter__fill--respect" style={{ transform: `scaleX(${fill})` }} />
          </span>
        </div>
      </div>
      <span className="comic-cash" aria-label={`Cash ${fmtCash(cash)}`}>
        <Icon name="cash" size={16} className="comic-cash__icon" />
        {fmtCash(cash)}
      </span>
      <button className="comic-round" aria-label="Menu" onClick={() => setMenuOpen(true)}>
        <Icon name="menu" size={24} />
      </button>
    </header>
  )
}

/** Next: dimmed while the line is still typing, then it moves the story on. */
export function NextButton({ ready, onNext }: { ready: boolean; onNext: () => void }) {
  return (
    <button className="comic-btn comic-next" onClick={onNext} disabled={!ready}>
      Next <Icon name="skip" size={15} />
    </button>
  )
}

/** Narration between lines: sits where the speech bubble does, so the page keeps its shape. */
export function NarrationBox({ label, text }: { label?: string; text: string }) {
  return (
    <div className="narration" key={text}>
      {label && <span className="panel-caption__label">{label}</span>}
      <span>{text}</span>
    </div>
  )
}

/** The yellow narration box across the top of the scene panel. */
export function PanelCaption({ label, text }: { label?: string; text: string }) {
  return (
    <div className="panel-caption" key={text}>
      {label && <span className="panel-caption__label">{label}</span>}
      {text}
    </div>
  )
}

export type LogEntry = { kind: 'line'; speaker?: SpeakerId; text: string } | { kind: 'caption'; label?: string; text: string } | { kind: 'pick'; text: string }

export function LogSheet({ entries, onClose }: { entries: LogEntry[]; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--log" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Story log">
        <div className="sheet__head">
          <h2>Story so far</h2>
          <button className="comic-round" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <ol className="log">
          {entries.length === 0 && <li className="log__empty">Nothing yet in this scene.</li>}
          {entries.map((e, i) =>
            e.kind === 'caption' ? (
              <li key={i} className="log__caption">
                {e.label && <b>{e.label} · </b>}
                {e.text}
              </li>
            ) : e.kind === 'pick' ? (
              <li key={i} className="log__pick">
                <span className="log__who">You chose</span>
                {e.text}
              </li>
            ) : (
              <li key={i} className="log__line">
                {e.speaker && <span className="log__who">{speakerName(e.speaker, useGame.getState().scene)}</span>}
                {e.text}
              </li>
            ),
          )}
        </ol>
      </div>
    </div>
  )
}
