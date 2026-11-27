import type { Scene } from '@render/core'
import { load } from '@render/AssetLoader'
import { envAssets } from '../assets/manifest'
import { applyEnvironmentGrade, type Quality } from '@render/Renderer'
import type { EnvironmentFactory, GameEnvironment } from '../sets/types'
import type { EnvironmentId, SfxId } from '../narrative/types'

// Environments are code-split: each set's module (geometry, textures, lights)
// is fetched only when the story first needs it.
const FACTORIES: Record<EnvironmentId, () => Promise<{ default: EnvironmentFactory }>> = {
  estate: () => import('../sets/EstateExterior'),
  gym_ext: () => import('../sets/GymExterior'),
  gym: () => import('../sets/TrainingFacility'),
  room: () => import('../sets/RookieQuarters'),
  city: () => import('../sets/CityDrive'),
  facility: () => import('../sets/FacilityEntrance'),
  lab: () => import('../sets/ResearchFacilityEnvironment'),
  past: () => import('../sets/TimelineExploration'),
  docks: () => import('../sets/Docks'),
  yard: () => import('../sets/RailYard'),
  mercer: () => import('../sets/MercerHouse'),
  office: () => import('../sets/BossOffice'),
}

/** Loads, switches and disposes the sets; only one is live at a time. */
export class EnvironmentManager {
  active: GameEnvironment | null = null
  private time = 0

  constructor(private scene: Scene, private quality: Quality, private sfx: (id: SfxId) => void) {}

  /** Fetches the set's code, so a later switch only pays for building it. */
  prefetch(id: EnvironmentId): Promise<unknown> {
    return FACTORIES[id]()
  }

  /** Disposes the live set. Its files stay resident while the scene holds them (@render/AssetLoader). */
  unload(): void {
    this.active?.dispose()
    this.active = null
  }

  /**
   * Replaces the live set with `id`. Its files are normally resident already
   * (loaded behind the loading screen or streamed during play); if not, they
   * load here, reporting progress.
   */
  async switchTo(id: EnvironmentId, onProgress?: (p: number) => void): Promise<GameEnvironment> {
    if (this.active?.id === id) return this.active
    this.unload()
    const [{ default: build }] = await Promise.all([FACTORIES[id](), load(envAssets(id), this.scene, { onProgress })])
    applyEnvironmentGrade(this.scene, id)
    const env = await build({ scene: this.scene, quality: this.quality, sfx: this.sfx })
    await this.scene.whenReadyAsync()
    this.active = env
    return env
  }

  update(dt: number): void {
    this.time += dt
    this.active?.update(dt, this.time)
  }

  dispose(): void {
    this.unload()
  }
}
