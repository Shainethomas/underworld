// Check Scene 03 callbacks, all confrontation outcomes, and Ink save/resume
// after every beat, including a pending choice or exploration interaction.
// node --import ./scripts/lib/ts-resolve.mjs scripts/check-scene04.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compileInk } from './lib/ink-compile.mjs'
import { StoryRuntime } from '../src/game/narrative/StoryRuntime.ts'
import { DEFAULT_VARS } from '../src/game/narrative/NarrativeState.ts'
const st = JSON.parse(readFileSync('src/story/scene04.staging.json', 'utf8'))
const scene = { ...st.scene, staging: st.beats, story: JSON.parse(compileInk(resolve('src/story/scene04.ink')).json) }
let runs = 0
for (const route of ['leave', 'challenge', 'talk']) for (const score of [0, 1]) for (const informed of [false, true]) {
  let rt = new StoryRuntime(scene)
  rt.setVars({ vars: { ...DEFAULT_VARS, intel: 15 }, choices: { standoff: informed ? 'fight' : 'run' }, flags: { saw_permit: informed, heard_nico: informed, nico_trusted: informed } })
  const seen = []
  for (let i = 0; i < 200; i++) {
    const b = rt.next()
    assert.ok(b, 'scene must reach completion')
    seen.push(b.id)
    const saved = rt.saveState()
    const restored = new StoryRuntime(scene)
    restored.loadState(saved, rt.played.map(x => x.id))
    assert.deepEqual(restored.beat, b, `restore ${b.id}`)
    assert.deepEqual(restored.getVars(), rt.getVars(), `restore vars ${b.id}`)
    rt = restored
    if (b.type === 'choice') rt.choose(b.choiceId === 'n_confrontation' ? route : b.options[0].id)
    if (b.type === 'qte') rt.setFlag(b.result, score)
    if (b.type === 'explore') {
      for (const h of b.hotspots) for (const [k,v] of Object.entries(h.sets ?? {})) rt.setFlag(k,v)
      assert.ok(b.hotspots.some(h => h.ends), 'exploration has an exit')
    }
    if (b.type === 'complete') break
  }
  assert.equal(seen.at(-1), 'n_complete')
  assert.equal(seen.includes('n_permit'), informed)
  assert.equal(seen.includes('n_overheard'), informed)
  assert.equal(seen.includes('n_insurance'), informed)
  assert.equal(seen.includes('n_oldfight'), informed)
  assert.equal(seen.includes('n_oldrun'), !informed)
  assert.equal(seen.includes('n_scrappy'), route === 'challenge' && score === 0)
  assert.equal(seen.includes('n_clean'), route === 'challenge' && score === 1)
  assert.equal(seen.includes('n_hit'), route !== 'challenge' && score === 0)
  assert.equal(rt.getVars().flags.n_evidence_found, true)
  assert.equal(rt.getVars().choices.n_confrontation, route)
  assert.ok(rt.getVars().vars.intel >= 25)
  runs++
}
console.log(`Scene 04: ${runs} routes/outcomes passed, with save/resume verified at every beat.`)
