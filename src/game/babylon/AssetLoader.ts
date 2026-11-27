import type { AssetContainer } from '@babylonjs/core/assetContainer'
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression'
import type { Scene } from '@babylonjs/core/scene'
import '@babylonjs/loaders/glTF/glTFFileLoader'
import '@babylonjs/loaders/glTF/2.0/glTFLoader'
import '@babylonjs/loaders/glTF/2.0/Extensions/index'
import { forgetTaken, takeBytes } from '../assets/ByteCache'

// The one place 3D files become engine resources, and the residency manager
// that decides how long they stay.
//
// Every model and texture is loaded once per URL and shared. Owners ("cast",
// "scene") `hold` the URLs they need; `load` makes URLs resident (behind a
// loading screen, or in the background while the player is busy); `sweep`
// frees whatever no owner holds. At a scene change the stager drops the old
// scene's holdings and sweeps before the next scene's files are decoded, so
// two scenes are never in memory at once, and switching sets inside a scene
// reuses textures and props instead of decoding them again.
//
// Pipeline: GLBs are meshopt-compressed (scripts/compress-models.mjs); the
// decoder is self-hosted so nothing is fetched from a CDN at runtime.

MeshoptCompression.Configuration = { decoder: { url: `${import.meta.env.BASE_URL}assets/lib/meshopt_decoder.js` } }

type Kind = 'model' | 'texture'

interface Entry {
  kind: Kind
  promise: Promise<AssetContainer | Texture>
  /** 0..1 while loading. */
  progress: number
  dispose(): void
}

const entries = new Map<string, Entry>()
const holdings = new Map<string, Set<string>>()

const mimeOf = (url: string) => (url.endsWith('.webp') ? 'image/webp' : url.endsWith('.png') ? 'image/png' : 'image/jpeg')
const kindOf = (url: string): Kind => (url.endsWith('.glb') ? 'model' : 'texture')
const isHeld = (url: string) => [...holdings.values()].some((h) => h.has(url))

function entry(url: string, scene: Scene, priority: RequestPriority = 'high'): Entry {
  const found = entries.get(url)
  if (found) return found
  const e: Entry = { kind: kindOf(url), promise: null!, progress: 0, dispose: () => {} }
  if (e.kind === 'model') {
    e.promise = takeBytes(url, (l, t) => (e.progress = t ? (0.9 * l) / t : 0), priority)
      .then((buf) => LoadAssetContainerAsync(new Uint8Array(buf), scene, { pluginExtension: '.glb', name: url }))
      .then((c) => {
        e.dispose = () => c.dispose()
        // The glTF loader raises every material in the scene to the scene's light
        // count (9 with the camera fill) once a model is in. WebGPU draws at most 8
        // and clamps them anyway, with a warning per shader: put back the 8 the
        // sets ask for (LightingManager.raiseLightLimit). WebGL can draw the 9th.
        if (scene.getEngine().isWebGPU)
          for (const m of scene.materials) {
            const lm = m as typeof m & { maxSimultaneousLights?: number }
            if ((lm.maxSimultaneousLights ?? 0) > 8) lm.maxSimultaneousLights = 8
          }
        return c
      })
  } else {
    // A resident "anchor": sets create their own Texture objects for the same
    // URL (with their own tiling), which share this one's GPU texture. It is
    // decoded off the main thread from bytes in the byte cache (with progress,
    // and reusing a download warmed on the title screen), the same way Babylon
    // decodes bitmaps itself, so it looks identical on WebGL and WebGPU.
    const engine = scene.getEngine() as unknown as { _features: { needsInvertingBitmap: boolean } }
    e.promise = takeBytes(url, (l, t) => (e.progress = t ? (0.9 * l) / t : 0), priority)
      .then((buf) =>
        createImageBitmap(new Blob([buf], { type: mimeOf(url) }), {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
          imageOrientation: engine._features.needsInvertingBitmap ? 'flipY' : 'from-image',
        }),
      )
      .then(
        (bitmap) =>
          new Promise<Texture>((resolve) => {
            // a bitmap uploads synchronously, inside the constructor: settle once it has returned
            const settle = () => queueMicrotask(() => resolve(t))
            const fail = (msg?: string) => {
              console.warn(`[assets] ${url}: ${msg ?? 'failed to upload'}`)
              settle()
            }
            const t: Texture = new Texture(url, scene, undefined, undefined, undefined, settle, fail, bitmap, true)
            e.dispose = () => t.dispose()
          }),
      )
  }
  e.promise.then(() => (e.progress = 1)).catch((err) => {
    console.error(`[assets] ${url}`, err)
    entries.delete(url)
  })
  entries.set(url, e)
  return e
}

/** A model, loaded once and shared. Callers instantiate from it; they never dispose it. */
export function loadContainer(url: string, scene: Scene): Promise<AssetContainer> {
  if (import.meta.env.DEV && !entries.has(url)) console.warn(`[assets] ${url} was not loaded ahead: add it to its manifest (src/game/assets/manifest.ts)`)
  return entry(url, scene).promise as Promise<AssetContainer>
}

/** `owner` now needs exactly `urls` (replacing what it held). Nothing loads or frees until `load` / `sweep`. */
export function hold(owner: string, urls: Iterable<string>): void {
  holdings.set(owner, new Set(urls))
}

export function release(owner: string): void {
  holdings.delete(owner)
}

/**
 * Makes `urls` resident. In the foreground everything loads at once and
 * progress (0..1, weighted toward models: they are most of the bytes and all
 * of the parsing) is reported; in the background files load one at a time at
 * low network priority, so play never stalls on a burst of decoding.
 */
export async function load(urls: Iterable<string>, scene: Scene, opts: { onProgress?: (p: number) => void; background?: boolean } = {}): Promise<void> {
  const list = [...new Set(urls)]
  if (opts.background) {
    for (const url of list) {
      if (entries.get(url)?.progress === 1) continue
      await entry(url, scene, 'low').promise.catch(() => {})
      // let a frame or two through between files
      await new Promise((r) => window.setTimeout(r, 32))
    }
    return
  }
  const all = list.map((url) => entry(url, scene))
  const pending = all.filter((e) => e.progress < 1)
  const weight = (e: Entry) => (e.kind === 'model' ? 4 : 1)
  const total = pending.reduce((a, e) => a + weight(e), 0)
  const { onProgress } = opts
  let timer = 0
  if (onProgress && total) {
    const tick = () => onProgress(pending.reduce((a, e) => a + e.progress * weight(e), 0) / total)
    timer = window.setInterval(tick, 80)
    tick()
  }
  await Promise.allSettled(all.map((e) => e.promise))
  window.clearInterval(timer)
  onProgress?.(1)
}

/** True when every URL is resident. */
export function isLoaded(urls: Iterable<string>): boolean {
  for (const u of urls) if (entries.get(u)?.progress !== 1) return false
  return true
}

/** Frees every resident file no owner holds. Call only when nothing built from them is still alive. */
export function sweep(): void {
  for (const [url, e] of [...entries]) {
    if (e.progress < 1 || isHeld(url)) continue
    e.dispose()
    entries.delete(url)
    forgetTaken(url)
  }
}

/**
 * Everything belongs to a Babylon scene; forget it all when that scene is
 * disposed. Downloaded bytes stay: they aren't tied to the scene, and the
 * title screen may have just warmed them for the next Play.
 */
export function clearCache(): void {
  for (const url of entries.keys()) forgetTaken(url)
  entries.clear()
  holdings.clear()
}

/** For tests and the perf overlay: every resident file, how far along it is, and who holds it. */
export function report(): { url: string; progress: number; owners: string[] }[] {
  return [...entries].map(([url, e]) => ({ url, progress: e.progress, owners: [...holdings].filter(([, h]) => h.has(url)).map(([o]) => o) }))
}
