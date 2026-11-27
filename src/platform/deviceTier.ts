// Which tier of hardware the game is running on. No engine imports, so the
// title screen can pick the right files to warm before the 3D engine loads.
//
// Shipped mobile games split hardware into tiers by device class rather than
// treating every phone alike:
// - high: desktops and tablets with a fine pointer; everything on.
// - low: phones; phone-sized character textures, no depth of field or glow.
// - lite: weak phones (≤ 3 GB RAM, ≤ 4 cores, or an older GPU); additionally
//   no shadow maps (blob shadows instead), no bloom or grain, half-size set
//   textures and a lower resolution cap.

export type QualityPref = 'auto' | 'high' | 'low' | 'lite'
export type Tier = 'high' | 'low' | 'lite'

const isMobile = () => matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600

/** GPUs that struggle with the 'low' tier (older Adreno, Mali and PowerVR parts). */
const WEAK_GPU = /adreno \(tm\) (3|4|5)\d\d|adreno \(tm\) 6[0-1]\d|mali-(4|t|g31|g51|g52)|powervr|sgx|videocore/i
/**
 * Mid-range Malis: 'lite' in budget phones, but fine on 'low' in a phone with
 * the memory and cores to match (a 6 GB, 8-core Galaxy A17 with a Mali-G68
 * holds 30 fps on 'low', and 'lite' looked smeared at its 1080 px width).
 */
const MID_GPU = /mali-(g57|g68|g71|g72|g76)/i

function gpuName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch {
    return ''
  }
}

/** A phone that should get the 'lite' tier. iPhones report neither RAM nor GPU model, so they stay on 'low'. */
function isWeakPhone(): boolean {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (memory !== undefined && memory <= 3) return true
  const cores = navigator.hardwareConcurrency
  if (cores && cores <= 4) return true
  const gpu = gpuName()
  if (WEAK_GPU.test(gpu)) return true
  // deviceMemory rounds down to a power of two: 4 means 4–7 GB
  return MID_GPU.test(gpu) && !((memory ?? 0) >= 4 && (cores ?? 0) >= 8)
}

let detected: Tier | null = null

export function resolveTier(pref: QualityPref): Tier {
  if (pref !== 'auto') return pref
  detected ??= !isMobile() ? 'high' : isWeakPhone() ? 'lite' : 'low'
  return detected
}
