import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import type { Scene } from '@babylonjs/core/scene'
import { rand } from './ProceduralTextures'

// Canvas-painted surfaces for lived-in interiors: floorboards, wallpaper,
// painted panelling, a patterned rug, a painting, and the sunny street seen
// through a window. Tileable ones wrap; pair them with SetBuilder.tileUV so a
// pattern keeps its real-world size on every wall and floor.

type Ctx = CanvasRenderingContext2D

function make(scene: Scene, name: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void, wrap = true): DynamicTexture {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true, Texture.TRILINEAR_SAMPLINGMODE)
  draw(tex.getContext() as unknown as Ctx, w, h)
  tex.update(false)
  tex.wrapU = tex.wrapV = wrap ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE
  tex.anisotropicFilteringLevel = 8
  return tex
}

const rgb = (c: [number, number, number], k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`

/** Honey-coloured floorboards, 1 tile = 1 m: six boards across, staggered joints, soft grain. */
export function planks(scene: Scene, name: string, base: [number, number, number]): DynamicTexture {
  return make(scene, name, 512, 512, (ctx, s) => {
    const n = 6
    const bw = s / n
    for (let i = 0; i < n; i++) {
      // each board run is split once or twice at random lengths
      let y = -rand() * s
      while (y < s) {
        const len = s * (0.6 + rand() * 0.9)
        const k = 0.86 + rand() * 0.24
        ctx.fillStyle = rgb(base, k)
        ctx.fillRect(i * bw, y, bw, len)
        // grain
        for (let g = 0; g < 14; g++) {
          const x = i * bw + rand() * bw
          ctx.strokeStyle = `rgba(60,30,10,${0.05 + rand() * 0.08})`
          ctx.lineWidth = 0.6 + rand() * 1.6
          ctx.beginPath()
          ctx.moveTo(x, y)
          for (let t = 0; t <= len; t += 16) ctx.lineTo(x + Math.sin((t + g * 40) * 0.03) * 2.2, y + t)
          ctx.stroke()
        }
        // a knot now and then
        if (rand() < 0.25) {
          ctx.fillStyle = 'rgba(70,35,12,0.35)'
          ctx.beginPath()
          ctx.ellipse(i * bw + bw * (0.3 + rand() * 0.4), y + len * rand(), 3 + rand() * 4, 6 + rand() * 6, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = 'rgba(40,20,8,0.75)'
        ctx.fillRect(i * bw, y, bw, 2)
        // wrap the run that crosses the bottom edge back to the top
        if (y + len > s) {
          ctx.fillStyle = rgb(base, k)
          ctx.fillRect(i * bw, 0, bw, y + len - s)
        }
        y += len
      }
      ctx.fillStyle = 'rgba(40,20,8,0.8)'
      ctx.fillRect(i * bw, 0, 2, s)
    }
  })
}

/** Striped wallpaper with a small repeating sprig, 1 tile = 0.8 m. */
export function wallpaper(scene: Scene, name: string, ground: string, stripe: string, motif: string): DynamicTexture {
  return make(scene, name, 256, 256, (ctx, s) => {
    ctx.fillStyle = ground
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = stripe
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(i * (s / 4) + 4, 0, 6, s)
      ctx.fillRect(i * (s / 4) + 14, 0, 2, s)
    }
    ctx.fillStyle = motif
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const x = i * (s / 4) + s / 8 + 6
        const y = j * (s / 4) + (i % 2 ? s / 8 : 0) + 16
        ctx.beginPath()
        ctx.ellipse(x, y, 3.5, 7, 0.5, 0, Math.PI * 2)
        ctx.ellipse(x + 5, y + 4, 3.5, 7, -0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(x + 1, y + 6, 1.5, 9)
      }
    // age: faint mottling
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(90,60,30,${rand() * 0.035})`
      ctx.fillRect(rand() * s, rand() * s, 4, 4)
    }
  })
}

/** Painted tongue-and-groove panelling, 1 tile = 1 m wide (vertical boards). */
export function panelling(scene: Scene, name: string, paint: [number, number, number]): DynamicTexture {
  return make(scene, name, 256, 256, (ctx, s) => {
    ctx.fillStyle = rgb(paint)
    ctx.fillRect(0, 0, s, s)
    const n = 8
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.fillRect(i * (s / n), 0, 2, s)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(i * (s / n) + 2, 0, 1, s)
    }
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.05})`
      ctx.fillRect(rand() * s, rand() * s, 3, 3)
    }
  })
}

/** A patterned wool rug: border bands, a field of lozenges, a central medallion. */
export function patternRug(scene: Scene, name: string, field: string, border: string, accent: string): DynamicTexture {
  return make(scene, name, 512, 512, (ctx, s) => {
    ctx.fillStyle = border
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = accent
    ctx.fillRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9)
    ctx.fillStyle = border
    ctx.fillRect(s * 0.07, s * 0.07, s * 0.86, s * 0.86)
    // border motif
    ctx.fillStyle = accent
    for (let i = 0; i < 14; i++) {
      const t = s * 0.1 + (i * s * 0.8) / 13
      for (const [x, y] of [[t, s * 0.1], [t, s * 0.9], [s * 0.1, t], [s * 0.9, t]]) {
        ctx.beginPath()
        ctx.moveTo(x, y - 7)
        ctx.lineTo(x + 7, y)
        ctx.lineTo(x, y + 7)
        ctx.lineTo(x - 7, y)
        ctx.fill()
      }
    }
    ctx.fillStyle = field
    ctx.fillRect(s * 0.15, s * 0.15, s * 0.7, s * 0.7)
    // field lozenges
    ctx.strokeStyle = border
    ctx.lineWidth = 2
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        const x = s * 0.2 + i * s * 0.12
        const y = s * 0.2 + j * s * 0.12
        ctx.beginPath()
        ctx.moveTo(x, y - 14)
        ctx.lineTo(x + 14, y)
        ctx.lineTo(x, y + 14)
        ctx.lineTo(x - 14, y)
        ctx.closePath()
        ctx.stroke()
      }
    // medallion
    ctx.fillStyle = border
    ctx.beginPath()
    ctx.ellipse(s / 2, s / 2, s * 0.17, s * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.ellipse(s / 2, s / 2, s * 0.1, s * 0.065, 0, 0, Math.PI * 2)
    ctx.fill()
    // worn pile
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = rand() < 0.5 ? `rgba(0,0,0,${rand() * 0.1})` : `rgba(255,240,220,${rand() * 0.05})`
      ctx.fillRect(rand() * s, rand() * s, 2, 2)
    }
  }, false)
}

/** A small landscape in oils: sky, hills, a bay. */
export function painting(scene: Scene, name: string): DynamicTexture {
  return make(scene, name, 256, 192, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6)
    sky.addColorStop(0, '#7fa6c9')
    sky.addColorStop(1, '#f1d9a8')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#6e8a5a'
    ctx.beginPath()
    ctx.moveTo(0, h * 0.62)
    ctx.quadraticCurveTo(w * 0.3, h * 0.4, w * 0.55, h * 0.58)
    ctx.quadraticCurveTo(w * 0.8, h * 0.48, w, h * 0.6)
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fill()
    ctx.fillStyle = '#4f86a8'
    ctx.fillRect(0, h * 0.72, w, h * 0.1)
    ctx.fillStyle = '#8a7a4a'
    ctx.fillRect(0, h * 0.82, w, h * 0.18)
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${rand() * 0.06})`
      ctx.fillRect(rand() * w, rand() * h, 3, 2)
    }
  }, false)
}

/** The street outside on a sunny morning: blue sky over the brick house opposite. */
export function windowView(scene: Scene, name: string): DynamicTexture {
  return make(scene, name, 256, 256, (ctx, s) => {
    const sky = ctx.createLinearGradient(0, 0, 0, s * 0.45)
    sky.addColorStop(0, '#5f9fdc')
    sky.addColorStop(1, '#bfe0f6')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, s, s)
    // a soft cloud
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    for (const [x, y, r] of [[60, 40, 18], [80, 34, 22], [104, 42, 16]]) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // sunlit brick house across the street, windows, a chimney
    ctx.fillStyle = '#c4805a'
    ctx.fillRect(0, s * 0.42, s, s * 0.58)
    ctx.fillRect(s * 0.72, s * 0.3, s * 0.1, s * 0.14)
    ctx.fillStyle = '#e8dcc8'
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(s * (0.1 + i * 0.3), s * (0.5 + j * 0.24), s * 0.16, s * 0.15)
    ctx.fillStyle = '#3c5468'
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(s * (0.115 + i * 0.3), s * (0.51 + j * 0.24), s * 0.13, s * 0.13)
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = `rgba(80,30,15,${rand() * 0.12})`
      ctx.fillRect(rand() * s, s * 0.42 + rand() * s * 0.58, 4, 2)
    }
  }, false)
}

/** A four-panel door face. */
export function doorPanels(scene: Scene, name: string, paint: [number, number, number]): DynamicTexture {
  return make(scene, name, 128, 256, (ctx, w, h) => {
    ctx.fillStyle = rgb(paint)
    ctx.fillRect(0, 0, w, h)
    for (const [x, y, pw, ph] of [[0.14, 0.06, 0.32, 0.4], [0.54, 0.06, 0.32, 0.4], [0.14, 0.54, 0.32, 0.4], [0.54, 0.54, 0.32, 0.4]]) {
      ctx.fillStyle = rgb(paint, 0.82)
      ctx.fillRect(x * w, y * h, pw * w, ph * h)
      ctx.fillStyle = rgb(paint, 1.12)
      ctx.fillRect(x * w + 4, y * h + 4, pw * w - 8, ph * h - 8)
    }
  }, false)
}

/** A high-floor view on a clear day: blue sky over a sunlit skyline. */
export function skylineView(scene: Scene, name: string): DynamicTexture {
  return make(scene, name, 512, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#3f86d6')
    sky.addColorStop(0.7, '#9cc6ec')
    sky.addColorStop(1, '#d9e8f3')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    for (const [x, y, r] of [[90, 50, 20], [115, 42, 26], [142, 52, 18], [380, 36, 16], [400, 30, 21]]) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // two rows of buildings: hazy far, crisp sunlit near
    for (const [row, base, tone] of [[0, 0.62, [170, 182, 196]], [1, 0.78, [196, 172, 146]]] as const) {
      let x = -10
      while (x < w) {
        const bw = 26 + rand() * 50
        const bh = h * (0.18 + rand() * (row ? 0.35 : 0.3))
        const k = 0.85 + rand() * 0.25
        ctx.fillStyle = rgb(tone as unknown as [number, number, number], k)
        ctx.fillRect(x, h * base - bh + (row ? h * 0.22 : 0), bw, bh + h)
        ctx.fillStyle = row ? 'rgba(60,80,100,0.55)' : 'rgba(90,110,130,0.3)'
        for (let wy = h * base - bh + (row ? h * 0.22 : 0) + 6; wy < h; wy += 9) for (let wx = x + 4; wx < x + bw - 5; wx += 8) ctx.fillRect(wx, wy, 4, 5)
        x += bw + rand() * 6
      }
    }
  }, false)
}
