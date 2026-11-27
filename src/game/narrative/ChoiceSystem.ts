import type { NarrativeContext } from './NarrativeState'
import type { ChoiceBeat, ChoiceOption, Condition } from './types'

// What the game still evaluates itself (the story's own conditions are Ink's):
// carried-over outfits, and the line Rookie says for an option.

export function evaluate(cond: Condition | undefined, ctx: NarrativeContext): boolean {
  if (!cond) return true
  if ('choice' in cond) {
    const picked = ctx.choices[cond.choice]
    return Array.isArray(cond.is) ? cond.is.includes(picked) : picked === cond.is
  }
  if ('v' in cond) {
    const value = ctx.vars[cond.v]
    return (cond.gte === undefined || value >= cond.gte) && (cond.lte === undefined || value <= cond.lte)
  }
  if ('flag' in cond) {
    const value = ctx.flags[cond.flag]
    if (cond.eq !== undefined) return value === cond.eq
    if (cond.gte !== undefined) return typeof value === 'number' && value >= cond.gte
    return Boolean(value)
  }
  if ('all' in cond) return cond.all.every((c) => evaluate(c, ctx))
  if ('any' in cond) return cond.any.some((c) => evaluate(c, ctx))
  return !evaluate(cond.not, ctx)
}




/** The line Rookie speaks after picking an option, if any. */
export function spokenLine(beat: ChoiceBeat, option: ChoiceOption): string | null {
  if (beat.style !== 'dialogue' || option.say === false) return null
  return option.say ?? option.text
}
