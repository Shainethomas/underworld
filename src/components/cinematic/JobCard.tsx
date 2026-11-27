import { useEffect } from 'react'
import { audio } from '../../game/audio/AudioManager'
import type { JobBeat } from '../../game/narrative/types'

/**
 * A job's briefing, laid over the scene like a sheet from a file: the job,
 * who it's for, what it pays, how risky it is and what has to be done. Next
 * (in the scene's corner) moves on to the prep choices.
 */
export function JobCard({ beat }: { beat: JobBeat }) {
  useEffect(() => {
    audio.play('ui_choice')
  }, [beat.id])

  const risk = beat.risk.toLowerCase()
  return (
    <div className="job" role="dialog" aria-label={`Job: ${beat.name}`}>
      <div className="job__card">
        <span className="job__kicker">Job</span>
        <h2 className="job__name">{beat.name}</h2>
        <dl className="job__facts">
          <div>
            <dt>For</dt>
            <dd>{beat.client}</dd>
          </div>
          <div>
            <dt>Pays</dt>
            <dd className="job__pay">{beat.pay}</dd>
          </div>
          <div>
            <dt>Risk</dt>
            <dd className={`job__risk job__risk--${risk.includes('high') ? 'high' : risk.includes('med') ? 'med' : 'low'}`}>{beat.risk}</dd>
          </div>
        </dl>
        <p className="job__objective">{beat.objective}</p>
      </div>
    </div>
  )
}
