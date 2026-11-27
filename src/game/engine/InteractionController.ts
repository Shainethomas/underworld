import { Vector3 } from '@render/core'
import type { GameEnvironment } from '../sets/types'
import type { Actor } from '../characters/CharacterPresentation'
import type { ActorId, ExploreBeat, Hotspot, Place } from '../narrative/types'
import { planPath } from './paths'

interface Deps {
  actors: Map<ActorId, Actor>
  env: () => GameEnvironment | null
  resolve: (p: Place) => [number, number, number]
  onArrive: (h: Hotspot) => void
}

/**
 * Exploration beats: the player picks a place from the list (ExploreChoices)
 * and Rookie walks there and interacts. Followers (Ravi) trail behind.
 */
export class InteractionController {
  beat: ExploreBeat | null = null
  private busy = false
  private followTimer = 0

  constructor(private d: Deps) {}

  private get rookie(): Actor | undefined {
    return this.d.actors.get('rookie')
  }

  begin(beat: ExploreBeat): void {
    this.beat = beat
    this.busy = false
  }

  end(): void {
    this.beat = null
    this.busy = false
  }

  /** Called while an aside plays, so a pick doesn't walk Rookie away mid-line. */
  setBusy(on: boolean): void {
    this.busy = on
  }

  /** Walk Rookie to a hotspot; false if he can't go now (walking, mid-aside, not on set). */
  goTo(id: string): boolean {
    const rookie = this.rookie
    const h = this.beat?.hotspots.find((x) => x.id === id)
    if (!h || !rookie || this.busy) return false
    const [ax, az] = this.d.resolve(h.at)
    let stand: Vector3
    if (h.stand) {
      const [sx, sz] = this.d.resolve(h.stand)
      stand = new Vector3(sx, 0, sz)
    } else {
      const dir = new Vector3(rookie.position.x - ax, 0, rookie.position.z - az)
      stand = new Vector3(ax, 0, az).add(dir.normalize().scale(1.1))
    }
    this.busy = true
    this.walk(rookie, stand, () => {
      const [fx, fz] = this.d.resolve(h.face ?? h.at)
      rookie.facePoint(fx, fz)
      window.setTimeout(() => {
        this.busy = false
        this.d.onArrive(h)
      }, 260)
    })
    return true
  }

  private walk(a: Actor, to: Vector3, onArrive?: () => void): void {
    const env = this.d.env()
    const from = new Vector3(a.position.x, 0, a.position.z)
    a.walk(planPath(from, to, env?.obstacles ?? []), 'walk', onArrive)
  }

  update(dt: number): void {
    const rookie = this.rookie
    if (!this.beat?.followers || !rookie) return
    this.followTimer -= dt
    if (this.followTimer > 0) return
    this.followTimer = 0.35
    for (const id of this.beat.followers) {
      const f = this.d.actors.get(id)
      if (!f || Vector3.Distance(f.position, rookie.position) < 2.1) continue
      const fwd = rookie.forward()
      const target = rookie.position.add(fwd.scale(-0.9)).add(new Vector3(fwd.z, 0, -fwd.x).scale(0.8))
      this.walk(f, new Vector3(target.x, 0, target.z))
    }
  }

  dispose(): void {}
}
