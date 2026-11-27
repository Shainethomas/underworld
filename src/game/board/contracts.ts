import { contractScene, type ContractMeta, type Kit } from './contractScene'
import type { SceneData } from '../narrative/types'

// Every contract on the board, found by file name: the metas are small and
// bundled with the game (the board shows them); each contract's Ink and its
// set's staging kit load only when it is played.

const METAS = import.meta.glob<ContractMeta>('../../story/contracts/c_*.json', { eager: true, import: 'default' })
const INKS = import.meta.glob<object>('../../story/contracts/c_*.ink', { import: 'default' })
const KITS = import.meta.glob<Kit>('../../story/contracts/kits/*.staging.json', { import: 'default' })

const file = (path: string) => path.split('/').pop()!.replace(/\..*$/, '')

export const CONTRACTS: Record<string, ContractMeta> = Object.fromEntries(Object.values(METAS).map((m) => [m.id, m]))

export function isContract(id: string): boolean {
  return id in CONTRACTS
}

export async function loadContract(id: string, rankCap: number): Promise<SceneData> {
  const meta = CONTRACTS[id]
  if (!meta) throw new Error(`No contract ${id}`)
  const ink = Object.entries(INKS).find(([p]) => file(p) === id)?.[1]
  const kit = Object.entries(KITS).find(([p]) => file(p) === meta.kit)?.[1]
  if (!ink || !kit) throw new Error(`Contract ${id}: missing ${ink ? `kit ${meta.kit}` : 'Ink'}`)
  const [story, staging] = await Promise.all([ink(), kit()])
  return contractScene(meta, staging, story, rankCap)
}
