import type { Tier } from '../../platform/deviceTier'

// Where runtime files live. Shared by the sets (through @render/SetBuilder)
// and the manifests, so a path is written once.
//
// Phones load phone-sized variants (scripts/make-mobile-assets.mjs): the
// character models with 1024 px colour and 512 px normal maps instead of
// 2048 / 1024 (each full-size character is ~21 MB of GPU memory), and on the
// 'lite' tier set textures at 512 px. Call `setAssetTier` before building a
// manifest; the engine does so when it attaches, the title screen before it
// warms files.

export type Surface = 'brick' | 'concrete' | 'paving' | 'leather'

let tier: Tier = 'high'

export function setAssetTier(t: Tier): void {
  tier = t
}

export function assetTier(): Tier {
  return tier
}

/** Character models that have a phone-sized variant in public/assets/models/mobile. */
const MOBILE_MODELS = new Set(['character_kit', 'rookie', 'alex', 'don', 'victor', 'lucas'])

/** The file to load for a character model (`CharacterDef.model`, the kit) on this device. */
export function characterUrl(url: string): string {
  const name = url.match(/\/assets\/models\/([^/]+)\.glb$/)?.[1]
  return tier !== 'high' && name && MOBILE_MODELS.has(name) ? `${import.meta.env.BASE_URL}assets/models/mobile/${name}.glb` : url
}

export const envModelUrl = (file: string) => `${import.meta.env.BASE_URL}assets/models/environment/${file}.glb`
export const surfaceUrl = (source: Surface, kind: 'albedo' | 'normal' | 'arm') =>
  tier === 'lite' ? `${import.meta.env.BASE_URL}assets/textures/environment/512/${source}_${kind}.webp` : `${import.meta.env.BASE_URL}assets/textures/environment/${source}_${kind}.webp`
export const surfaceUrls = (source: Surface) => [surfaceUrl(source, 'albedo'), surfaceUrl(source, 'normal'), surfaceUrl(source, 'arm')]
export const FOLIAGE_URL = `${import.meta.env.BASE_URL}assets/textures/environment/foliage.webp`
