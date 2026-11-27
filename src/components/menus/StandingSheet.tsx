import { VAR_LABELS } from '../../game/narrative/NarrativeState'
import type { VarKey } from '../../game/narrative/types'
import { fmtCash, KIT, LOOSE_ENDS, RANKS, RESPECT_GATES, rankById, vargaStanding } from '../../game/progression/Progression'
import { useGame } from '../../store/gameStore'
import { Icon } from '../common/Icon'

const PEOPLE: { k: VarKey; who: string }[] = [
  { k: 'ravi_trust', who: 'Lucas' },
  { k: 'don_loyalty', who: 'Victor' },
]
const STYLE: VarKey[] = ['discipline', 'independence', 'intel']

/** How a relationship reads at a glance, from its value. */
function warmth(v: number): string {
  if (v >= 25) return 'Close'
  if (v >= 15) return 'Warm'
  if (v >= 5) return 'Friendly'
  if (v <= -10) return 'Cold'
  return 'Neutral'
}

/**
 * Rookie's standing in the organisation: rank and the Respect ladder (and
 * what more Respect opens), money and Heat, the people who matter, the
 * Varga crew, his gear and contacts, and the loose ends behind the jobs.
 */
export function StandingSheet({ onClose }: { onClose: () => void }) {
  const vars = useGame((s) => s.vars)
  const flags = useGame((s) => s.flags)
  const rank = rankById(typeof flags.rank === 'number' ? flags.rank : 0)
  const varga = vargaStanding(vars.varga)
  const kit = KIT.filter((g) => flags[g.flag])
  const loose = LOOSE_ENDS.filter((l) => flags[l.flag])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--standing" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Standing">
        <div className="sheet__head">
          <h2>Standing</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>

        <section className="standing__block">
          <h3>Rank</h3>
          <ol className="ranks">
            {RANKS.map((r) => (
              <li key={r.id} className={`ranks__step ${r.id === rank.id ? 'is-now' : r.id < rank.id ? 'is-done' : ''}`}>
                <span className="ranks__name">{r.name}</span>
                <span className="ranks__at">{r.at}</span>
              </li>
            ))}
          </ol>
          <p className="standing__note">
            Respect <b>{vars.respect}</b> · promotions come at a job's debrief, and are never taken back.
          </p>
          <ul className="gates">
            {RESPECT_GATES.map((g) => (
              <li key={g.at} className={vars.respect >= g.at ? 'is-open' : ''}>
                <Icon name={vars.respect >= g.at ? 'skip' : 'lock'} size={13} />
                <span>{g.text}</span>
                <span className="gates__at">{g.at}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="standing__block standing__pair">
          <div>
            <h3>Cash</h3>
            <p className="standing__big">{fmtCash(vars.cash)}</p>
          </div>
          <div>
            <h3>Heat</h3>
            <p className={`standing__big ${vars.heat >= 25 ? 'is-hot' : ''}`}>{vars.heat}</p>
            <p className="standing__note">{vars.heat >= 30 ? 'Jobs cost more to clean up.' : vars.heat >= 15 ? 'People are starting to look.' : 'Quiet.'}</p>
          </div>
        </section>

        <section className="standing__block">
          <h3>People</h3>
          <ul className="people">
            {PEOPLE.map(({ k, who }) => (
              <li key={k}>
                <span className="people__who">{who}</span>
                <span className="people__label">{VAR_LABELS[k]}</span>
                <span className="people__val">
                  {warmth(vars[k])} · {vars[k]}
                </span>
              </li>
            ))}
            <li className="people--rival">
              <span className="people__who">Varga crew</span>
              <span className="people__label">{varga.note}</span>
              <span className={`people__val ${varga.level >= 2 ? 'is-hot' : ''}`}>{varga.label}</span>
            </li>
          </ul>
          <p className="standing__style">
            {STYLE.map((k) => (
              <span key={k}>
                {VAR_LABELS[k]} <b>{vars[k]}</b>
              </span>
            ))}
          </p>
        </section>

        <section className="standing__block">
          <h3>Holdings, gear and contacts</h3>
          {kit.length ? (
            <ul className="kit">
              {kit.map((g) => (
                <li key={g.flag}>
                  <b>{g.name}</b> {g.use}
                </li>
              ))}
            </ul>
          ) : (
            <p className="standing__note">Nothing yet. Prep before a job to buy gear; contacts come from the jobs themselves.</p>
          )}
        </section>

        {loose.length > 0 && (
          <section className="standing__block">
            <h3>Loose ends</h3>
            <ul className="loose">
              {loose.map((l) => (
                <li key={l.flag}>{l.text}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
