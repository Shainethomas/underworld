import { useEffect, useState } from 'react'
import { audio } from '../../game/audio/AudioManager'
import { fxLabel, HEAT_COOLDOWN, HOT, lockReason, msToMidnight } from '../../game/board/Board'
import { CONTRACTS } from '../../game/board/contracts'
import { fmtPay } from '../../game/board/contractScene'
import { loadScene } from '../../game/engine/SceneManager'
import { GRADES } from '../../game/progression/Progression'
import { useGame } from '../../store/gameStore'
import { Icon } from '../common/Icon'

function countdown(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}

/**
 * Lucas's board: tonight's three contracts (street work between the story's
 * big jobs), what came in overnight, Heat and how it cools, and the nights
 * worked in a row. New contracts arrive at local midnight; the playtest
 * control at the foot moves the clock on a day so the next morning can be
 * seen without waiting for it.
 */
export function BoardSheet({ onClose }: { onClose: () => void }) {
  const board = useGame((s) => s.board)
  const vars = useGame((s) => s.vars)
  const rank = useGame((s) => (typeof s.flags.rank === 'number' ? s.flags.rank : 0))
  const openBoard = useGame((s) => s.openBoard)
  const skipDay = useGame((s) => s.skipDay)
  const readInbox = useGame((s) => s.readInbox)
  const startScene = useGame((s) => s.startScene)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [rules, setRules] = useState(false)

  useEffect(() => {
    openBoard()
    const t = window.setInterval(() => {
      setNow(Date.now())
      openBoard()
    }, 30_000)
    return () => window.clearInterval(t)
  }, [openBoard])

  const take = async (id: string) => {
    if (busy) return
    setBusy(true)
    audio.play('ui_choice')
    try {
      readInbox()
      startScene(await loadScene(id), true)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const left = board.offer.filter((id) => !board.done[id]).length
  const hot = vars.heat >= HOT

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--board" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tonight's work">
        <div className="sheet__head">
          <h2>Tonight's Work</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>

        {board.inbox.length > 0 && (
          <section className="board__inbox" aria-label="Overnight">
            <h3>Overnight</h3>
            <ul>
              {board.inbox.map((m, i) => (
                <li key={i} className="board__msg">
                  <span className="board__from">{m.from}</span>
                  <p>{m.text}</p>
                  {m.fx && <span className={`board__fx ${/^h|-/.test(m.fx) ? 'is-down' : 'is-up'}`}>{fxLabel(m.fx)}</span>}
                </li>
              ))}
            </ul>
            <button className="btn btn--text" onClick={readInbox}>
              Got it
            </button>
          </section>
        )}

        <div className="board__status">
          <div>
            <span>Heat</span>
            <b className={hot ? 'is-hot' : ''}>{vars.heat}</b>
            <small>−{HEAT_COOLDOWN} each night</small>
          </div>
          <div>
            <span>Nights worked</span>
            <b>{board.streak}</b>
            <small>{board.streak >= 3 ? 'Victor has noticed' : `${3 - board.streak} more for Lucas's word`}</small>
          </div>
          <div>
            <span>New jobs in</span>
            <b>{countdown(msToMidnight(now + board.offset * 86_400_000))}</b>
            <small>{left ? `${left} left tonight` : 'Done for tonight'}</small>
          </div>
        </div>

        <ul className="board__list">
          {board.offer.map((id) => {
            const c = CONTRACTS[id]
            if (!c) return null
            const done = board.done[id]
            const locked = done ? undefined : lockReason(c, vars, rank)
            return (
              <li key={id} className={`board__job ${done ? 'is-done' : ''} ${locked ? 'is-locked' : ''}`}>
                <div className="board__job-head">
                  <h3>{c.title}</h3>
                  <span className={`job__risk job__risk--${c.risk === 'High' ? 'high' : c.risk === 'Medium' ? 'med' : 'low'}`}>Risk {c.risk}</span>
                </div>
                <p className="board__meta">
                  <span>{c.client}</span>
                  <span>{fmtPay(c.pay)}</span>
                  <span>+{c.respect} Respect</span>
                </p>
                <p className="board__pitch">{c.pitch}</p>
                {done ? (
                  <p className="board__stamp">
                    Done · <b>{GRADES[done]?.label ?? done}</b>
                  </p>
                ) : locked ? (
                  <p className="board__lock">
                    <Icon name="lock" size={14} /> {locked}
                  </p>
                ) : (
                  <button className="btn btn--gold btn--wide" onClick={() => take(id)} disabled={busy}>
                    Take it <Icon name="skip" size={16} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        <button className="board__rules-toggle btn btn--text" onClick={() => setRules((r) => !r)}>
          <Icon name="brain" size={15} /> {rules ? 'Hide' : 'How'} street work plays
        </button>
        {rules && (
          <div className="board__rules">
            <p>Every contact is greedy, scared or proud. Their words give it away. Each reply you pick presses, charms or threatens, and how it lands is fixed:</p>
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Press</th>
                  <th>Charm</th>
                  <th>Threaten</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Greedy</th>
                  <td className="is-up">Best</td>
                  <td>OK</td>
                  <td className="is-down">Bad</td>
                </tr>
                <tr>
                  <th>Scared</th>
                  <td>OK</td>
                  <td className="is-up">Best</td>
                  <td className="is-down">Worst</td>
                </tr>
                <tr>
                  <th>Proud</th>
                  <td className="is-down">Bad</td>
                  <td>OK</td>
                  <td className="is-up">Best</td>
                </tr>
              </tbody>
            </table>
            <p>Two good reads, a clean deal. Get it wrong and his muscle steps in. What you find looking round makes pressing stronger; bringing a crew makes threats land harder. Threats draw Heat.</p>
          </div>
        )}

        <button className="board__skip btn btn--text" onClick={skipDay}>
          Playtest: skip to tomorrow
        </button>
      </div>
    </div>
  )
}
