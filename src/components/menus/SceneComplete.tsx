import { useEffect, useState } from 'react'
import { audio } from '../../game/audio/AudioManager'
import { isPlayable, loadScene, SCENE_TITLES } from '../../game/engine/SceneManager'
import { VAR_ICONS, VAR_LABELS } from '../../game/narrative/NarrativeState'
import type { SceneData, VarKey } from '../../game/narrative/types'
import { fmtCash, GRADES, LEDGER_LABELS, nextRank, parseLedger, rankById, type LedgerEntry } from '../../game/progression/Progression'
import { sceneStart, useGame } from '../../store/gameStore'
import { Icon } from '../common/Icon'
import { StandingSheet } from './StandingSheet'
import { BoardSheet } from './BoardSheet'

/** Stats the debrief lists as relationship or style changes (Respect, cash, Heat and the Varga crew have their own lines). */
const PEOPLE: VarKey[] = ['ravi_trust', 'don_loyalty', 'discipline', 'independence', 'intel']

/**
 * The debrief at the end of a job: the grade, every payment and cost with its
 * reason (the scene's ledger), Respect against the next rank — with the
 * promotion, when it happens here — what changed with the people around him,
 * and the next job on offer.
 */
export function SceneComplete({ scene }: { scene: SceneData }) {
  const vars = useGame((s) => s.vars)
  const choices = useGame((s) => s.choices)
  const flags = useGame((s) => s.flags)
  const start = useGame((s) => sceneStart(s, scene.id))
  const startScene = useGame((s) => s.startScene)
  const toMenu = useGame((s) => s.toMenu)
  const [locked, setLocked] = useState(false)
  const [standing, setStanding] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const board = useGame((s) => s.board)
  const boardOn = useGame((s) => s.progress.completed.includes('s01'))
  const contract = scene.kind === 'contract'
  const boardLeft = board.offer.filter((id) => !board.done[id]).length
  const openBoard = useGame((s) => s.openBoard)
  // the first debrief that opens the board deals its first night
  useEffect(() => {
    if (boardOn) openBoard()
  }, [boardOn, openBoard])
  const next = scene.next
  const nextTitle = next ? (SCENE_TITLES[next.id] ?? next.title) : ''

  const ledger = parseLedger(choices.ledger)
  const grade = GRADES[choices.job_grade ?? '']
  const rankBefore = rankById(typeof start.flags.rank === 'number' ? start.flags.rank : 0)
  const rank = rankById(typeof flags.rank === 'number' ? flags.rank : 0)
  const promoted = rank.id > rankBefore.id
  const goal = nextRank(rank.id)
  const fill = goal ? Math.max(0, Math.min(1, (vars.respect - rank.at) / (goal.at - rank.at))) : 1
  const moved = PEOPLE.filter((k) => vars[k] !== start.vars[k])

  const proceed = async () => {
    audio.play('ui_choice')
    if (next && isPlayable(next.id)) startScene(await loadScene(next.id), true)
    else setLocked(true)
  }

  const lines = (kinds: LedgerEntry['kind'][]) => ledger.filter((e) => kinds.includes(e.kind))
  const money = lines(['cash'])
  const respect = lines(['respect'])
  const other = lines(['heat', 'varga', 'lucas', 'victor'])

  return (
    <div className="complete debrief">
      <div className="complete__panel debrief__panel">
        <div className="complete__kicker">
          Debrief <span className="complete__rule" />
        </div>
        <h2 className="complete__title">{scene.title}</h2>
        {grade && (
          <p className={`debrief__grade debrief__grade--${choices.job_grade}`}>
            <b>{grade.label}</b> {grade.note}
          </p>
        )}

        {contract && choices.k_mood && <ReadLine mood={choices.k_mood} talks={[choices.k_talk1, choices.k_talk2]} />}

        {promoted && (
          <div className="debrief__promo" role="status">
            <span className="debrief__promo-kicker">Promoted</span>
            <span className="debrief__promo-rank">{rank.name}</span>
          </div>
        )}

        <section className="debrief__block" aria-label="Respect">
          <div className="debrief__head">
            <span>Respect</span>
            <b>{vars.respect}</b>
          </div>
          <div className="debrief__bar">
            <span style={{ transform: `scaleX(${fill})` }} />
          </div>
          <p className="debrief__goal">
            {goal && vars.respect >= goal.at ? (
              // enough Respect, but this promotion is the story's to give
              <>
                {rank.name} · enough Respect for <b>{goal.name}</b>. Only Victor can make it official.
              </>
            ) : goal ? (
              <>
                {rank.name} · <b>{goal.name}</b> at {goal.at} — {Math.max(0, goal.at - vars.respect)} to go
              </>
            ) : (
              <>{rank.name}</>
            )}
          </p>
          <Ledger entries={respect} />
        </section>

        <section className="debrief__block" aria-label="Cash">
          <div className="debrief__head">
            <span>Cash</span>
            <b>{fmtCash(vars.cash)}</b>
          </div>
          <Ledger entries={money} cash />
        </section>

        {(other.length > 0 || moved.length > 0) && (
          <section className="debrief__block" aria-label="Consequences">
            <div className="debrief__head">
              <span>Fallout</span>
            </div>
            <Ledger entries={other} />
            {moved.length > 0 && (
              <ul className="debrief__stats">
                {moved.map((k) => {
                  const d = vars[k] - start.vars[k]
                  return (
                    <li key={k}>
                      <Icon name={VAR_ICONS[k]} size={14} />
                      {VAR_LABELS[k]}
                      <span className={d > 0 ? 'is-up' : 'is-down'}>
                        {d > 0 ? '+' : ''}
                        {d}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {next && (
          <section className="debrief__next" aria-label="Next job">
            <span className="debrief__next-kicker">Next job</span>
            <h3>{next.job?.name ?? nextTitle}</h3>
            {next.job && (
              <>
                <p className="debrief__next-meta">
                  <span>{next.job.pay}</span>
                  <span className={`job__risk job__risk--${next.job.risk.toLowerCase().includes('high') ? 'high' : 'low'}`}>Risk {next.job.risk}</span>
                </p>
                <p className="debrief__next-pitch">{next.job.pitch}</p>
              </>
            )}
            <button className="btn btn--gold btn--wide" onClick={proceed}>
              Take the job <Icon name="skip" size={16} />
            </button>
            {boardOn && (
              <button className="btn btn--text btn--wide" onClick={() => setBoardOpen(true)}>
                Or work the street first{boardLeft ? ` · ${boardLeft} on Lucas's board` : ''}
              </button>
            )}
          </section>
        )}
        {contract && (
          <section className="debrief__next" aria-label="Lucas's board">
            <span className="debrief__next-kicker">Lucas's board</span>
            <p className="debrief__next-pitch">
              {boardLeft ? `${boardLeft} more ${boardLeft === 1 ? 'job' : 'jobs'} tonight.` : "That's tonight's work done."} Whatever you left behind out there, you'll hear about it in the morning.
            </p>
            <button className="btn btn--gold btn--wide" onClick={() => setBoardOpen(true)}>
              Back to the board <Icon name="skip" size={16} />
            </button>
          </section>
        )}
        <div className="complete__links">
          <button className="btn btn--text" onClick={() => setStanding(true)}>
            <Icon name="fist" size={15} /> Standing
          </button>
          {!contract && (
            <button className="btn btn--text" onClick={async () => startScene(await loadScene(scene.id), true)}>
              <Icon name="replay" size={15} /> Replay
            </button>
          )}
          <button className="btn btn--text" onClick={toMenu}>
            <Icon name="home" size={15} /> Menu
          </button>
        </div>
      </div>

      {standing && <StandingSheet onClose={() => setStanding(false)} />}
      {boardOpen && <BoardSheet onClose={() => setBoardOpen(false)} />}
      {locked && next && (
        <div className="sheet-backdrop" onClick={() => setLocked(false)}>
          <div className="sheet sheet--center" onClick={(e) => e.stopPropagation()}>
            <Icon name="lock" size={28} className="sheet__lock" />
            <h2>{next.job?.name ?? nextTitle}</h2>
            <p className="sheet__note">Your standing is saved. This job opens in the next update.</p>
            <button className="btn btn--gold btn--wide" onClick={() => setLocked(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Ledger({ entries, cash }: { entries: LedgerEntry[]; cash?: boolean }) {
  if (!entries.length) return null
  return (
    <ul className="ledger">
      {entries.map((e, i) => {
        const bad = e.kind === 'heat' || e.kind === 'varga' ? e.amount > 0 : e.amount < 0
        return (
          <li key={i} className="ledger__row" style={{ animationDelay: `${300 + i * 90}ms` }}>
            <span className="ledger__why">
              {!cash && e.kind !== 'respect' && <em>{LEDGER_LABELS[e.kind]} · </em>}
              {e.why}
            </span>
            <span className={`ledger__amt ${bad ? 'is-down' : 'is-up'}`}>
              {e.amount > 0 ? '+' : ''}
              {cash ? fmtCash(e.amount) : e.amount}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const MOOD = { greedy: 'greedy', scared: 'scared', proud: 'proud' } as Record<string, string>
const BEST: Record<string, string> = { greedy: 'press', scared: 'charm', proud: 'threaten' }
const VERB: Record<string, string> = { press: 'pressed', charm: 'charmed', threaten: 'threatened' }

/** What the contact was, and how Rookie played him: the street-work skill, taught at the debrief. */
function ReadLine({ mood, talks }: { mood: string; talks: (string | undefined)[] }) {
  const best = BEST[mood]
  const played = talks.filter((t): t is string => Boolean(t))
  const right = played.filter((t) => t === best).length
  return (
    <p className="debrief__read">
      He was <b>{MOOD[mood] ?? mood}</b>. You {played.map((t) => VERB[t] ?? t).join(', then ')}.{' '}
      {right === 2 ? 'Read him right twice.' : right === 1 ? `Once right. A clean deal takes two: ${best} works on a ${mood} man.` : `${cap(best)} is what works on a ${mood} man.`}
    </p>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
