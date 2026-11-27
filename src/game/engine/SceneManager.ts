import { validate } from '../narrative/NarrativeEngine'
import type { Beat, SceneData, SceneMeta } from '../narrative/types'
import { isContract, loadContract } from '../board/contracts'
import { useGame } from '../../store/gameStore'

// Registry of playable scenes. Each is an Ink story (src/story/sceneNN.ink)
// plus its staging (sceneNN.staging.json), code-split so later chapters
// don't weigh on the first load.
type Staging = { scene: SceneMeta; beats: Record<string, Beat> }
const pair = (story: () => Promise<{ default: object }>, staging: () => Promise<{ default: unknown }>) => async (): Promise<SceneData> => {
  const [s, st] = await Promise.all([story(), staging()])
  const { scene, beats } = st.default as Staging
  return { ...scene, story: s.default, staging: beats }
}

const REGISTRY: Record<string, () => Promise<SceneData>> = {
  s01: pair(() => import('../../story/scene01.ink'), () => import('../../story/scene01.staging.json')),
  s02: pair(() => import('../../story/scene02.ink'), () => import('../../story/scene02.staging.json')),
  s04: pair(() => import('../../story/scene04.ink'), () => import('../../story/scene04.staging.json')),
  s03: pair(() => import('../../story/scene03.ink'), () => import('../../story/scene03.staging.json')),
}

/** Every announced scene in story order, playable or not. */
export const SCENE_ORDER = ['s01', 's02', 's03', 's04', 's05'] as const

export const SCENE_TITLES: Record<string, string> = {
  s01: 'The Unexpected Call',
  s02: 'The Opportunity',
  s03: 'A Bigger Problem',
  s04: 'No Loose Ends',
  s05: 'Hold the Yard',
}

/** "Scene 2" for s02. */
export function sceneNumber(id: string): number {
  return Number(id.replace(/\D/g, ''))
}

export function isPlayable(id: string): boolean {
  return id in REGISTRY || isContract(id)
}

/** Street work can promote to Runner, no further: Associate is Victor's to give (Scene 04), and Soldier waits for Chapter 2. */
function contractRankCap(): number {
  return useGame.getState().progress.completed.includes('s04') ? 2 : 1
}

export async function loadScene(id: string): Promise<SceneData> {
  if (isContract(id)) {
    const scene = await loadContract(id, contractRankCap())
    validate(scene)
    return scene
  }
  const load = REGISTRY[id]
  if (!load) throw new Error(`Scene ${id} is not available yet`)
  const scene = await load()
  validate(scene)
  return scene
}
