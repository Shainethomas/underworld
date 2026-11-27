import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import type { Scene } from '@babylonjs/core/scene'

// Canvas-painted textures for props and sets. Everything here is generated at
// load time so the environments ship without texture downloads; swap any of
// them for authored KTX2 textures through AssetLoader when art is available.

type Ctx = CanvasRenderingContext2D

let seed = 1337
export function rand(): number {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
export function reseed(s: number): void {
  seed = s
}

/** DynamicTexture.clone copies settings only, so upload the canvas pixels too. */
export function copyTexture(source: DynamicTexture, name: string): DynamicTexture {
  const copy = source.clone()
  copy.name = name
  copy.getContext().drawImage(source.getContext().canvas, 0, 0)
  copy.update(false)
  return copy
}

function make(scene: Scene, name: string, size: number, draw: (ctx: Ctx, s: number) => void, opts: { wrap?: boolean; mip?: boolean } = {}): DynamicTexture {
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, opts.mip ?? true, Texture.TRILINEAR_SAMPLINGMODE)
  const ctx = tex.getContext() as unknown as Ctx
  draw(ctx, size)
  tex.update(false)
  if (opts.wrap !== false) {
    tex.wrapU = Texture.WRAP_ADDRESSMODE
    tex.wrapV = Texture.WRAP_ADDRESSMODE
  }
  return tex
}

/** Tileable value-noise speckle, painted as many translucent blots. */
function blots(ctx: Ctx, s: number, n: number, rMin: number, rMax: number, color: (i: number) => string): void {
  for (let i = 0; i < n; i++) {
    const x = rand() * s
    const y = rand() * s
    const r = rMin + rand() * (rMax - rMin)
    ctx.fillStyle = color(i)
    for (const ox of [-s, 0, s])
      for (const oy of [-s, 0, s]) {
        if (x + ox + r < 0 || x + ox - r > s || y + oy + r < 0 || y + oy - r > s) continue
        ctx.beginPath()
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2)
        ctx.fill()
      }
  }
}

/** Derives a normal map from a canvas' luminance (treated as height). */
export function normalFromHeight(scene: Scene, name: string, src: DynamicTexture, strength = 2): DynamicTexture {
  const size = src.getSize().width
  const sctx = src.getContext() as unknown as Ctx
  const data = sctx.getImageData(0, 0, size, size).data
  return make(scene, name, size, (ctx) => {
    const out = ctx.createImageData(size, size)
    const h = (x: number, y: number) => {
      const i = (((y + size) % size) * size + ((x + size) % size)) * 4
      return (data[i] + data[i + 1] + data[i + 2]) / 765
    }
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = (h(x - 1, y) - h(x + 1, y)) * strength
        const dy = (h(x, y - 1) - h(x, y + 1)) * strength
        const len = Math.hypot(dx, dy, 1)
        const i = (y * size + x) * 4
        out.data[i] = ((dx / len) * 0.5 + 0.5) * 255
        out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
        out.data[i + 2] = (1 / len) * 0.5 * 255 + 127
        out.data[i + 3] = 255
      }
    ctx.putImageData(out, 0, 0)
  })
}

export function concrete(scene: Scene, size: number, tone = 46): DynamicTexture {
  return make(scene, 'tex_concrete', size, (ctx, s) => {
    ctx.fillStyle = `rgb(${tone},${tone},${tone + 2})`
    ctx.fillRect(0, 0, s, s)
    blots(ctx, s, 900, s * 0.004, s * 0.03, () => {
      const value = rand() < 0.5 ? 25 : 125
      return `rgba(${value},${value},${value},${0.015 + rand() * 0.025})`
    })
    blots(ctx, s, 60, s * 0.04, s * 0.16, () => `rgba(10,8,6,${0.03 + rand() * 0.05})`)
    for (let i = 0; i < 4000; i++) {
      const value = rand() < 0.5 ? 25 : 115
      ctx.fillStyle = `rgba(${value},${value},${value},0.08)`
      ctx.fillRect(rand() * s, rand() * s, 1.5, 1.5)
    }
    // expansion joints
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = s / 400
    ctx.beginPath()
    ctx.moveTo(0, s / 2)
    ctx.lineTo(s, s / 2)
    ctx.moveTo(s / 2, 0)
    ctx.lineTo(s / 2, s)
    ctx.stroke()
  })
}

export function rubberMat(scene: Scene, size: number): DynamicTexture {
  return make(scene, 'tex_mat', size, (ctx, s) => {
    ctx.fillStyle = '#141416'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rand() * 0.05})`
      ctx.fillRect(rand() * s, rand() * s, 2, 2)
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'
    ctx.lineWidth = s / 256
    ctx.strokeRect(0, 0, s, s)
  })
}

export function brick(scene: Scene, size: number): DynamicTexture {
  return make(scene, 'tex_brick', size, (ctx, s) => {
    const rows = 16
    const bh = s / rows
    const bw = bh * 2.1
    ctx.fillStyle = '#2a2420'
    ctx.fillRect(0, 0, s, s)
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw * 0.5
      for (let x = -bw; x < s + bw; x += bw) {
        const v = 0.75 + rand() * 0.4
        const red = Math.round(92 * v)
        ctx.fillStyle = `rgb(${red},${Math.round(red * 0.48)},${Math.round(red * 0.36)})`
        ctx.fillRect(x + off + 1.5, r * bh + 1.5, bw - 3, bh - 3)
        ctx.fillStyle = `rgba(0,0,0,${rand() * 0.25})`
        ctx.fillRect(x + off + 1.5, r * bh + 1.5, bw - 3, bh - 3)
      }
    }
    blots(ctx, s, 300, s * 0.01, s * 0.05, () => `rgba(0,0,0,${0.03 + rand() * 0.05})`)
  })
}

export function leather(scene: Scene, size: number, base: [number, number, number]): DynamicTexture {
  return make(scene, `tex_leather_${base.join('_')}`, size, (ctx, s) => {
    ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`
    ctx.fillRect(0, 0, s, s)
    blots(ctx, s, 1600, s * 0.003, s * 0.012, () => `rgba(0,0,0,${0.04 + rand() * 0.06})`)
    blots(ctx, s, 40, s * 0.03, s * 0.1, () => `rgba(255,255,255,${0.02 + rand() * 0.03})`)
    // seams + band
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = s / 200
    for (const y of [0.18, 0.82]) {
      ctx.beginPath()
      ctx.moveTo(0, y * s)
      ctx.lineTo(s, y * s)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(10,10,10,0.85)'
    ctx.fillRect(0, s * 0.44, s, s * 0.1)
    ctx.fillStyle = 'rgba(200,160,90,0.55)'
    ctx.fillRect(0, s * 0.475, s, s * 0.03)
  })
}

export function canvasCloth(scene: Scene, size: number): DynamicTexture {
  return make(scene, 'tex_ringcanvas', size, (ctx, s) => {
    ctx.fillStyle = '#8f8b84'
    ctx.fillRect(0, 0, s, s)
    blots(ctx, s, 120, s * 0.01, s * 0.08, () => `rgba(60,40,30,${0.03 + rand() * 0.06})`)
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.06})`
      ctx.fillRect(rand() * s, rand() * s, 2, 1)
    }
    drawCrest(ctx, s / 2, s / 2, s * 0.32, 'rgba(120,20,26,0.55)', 'rgba(150,110,50,0.4)')
  }, { wrap: false })
}

/** The organisation's insignia: a crowned shield with crossed blades. */
export function drawCrest(ctx: Ctx, cx: number, cy: number, r: number, fill: string, line: string): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.lineJoin = 'round'
  // crossed blades
  ctx.strokeStyle = line
  ctx.lineWidth = r * 0.06
  for (const sgn of [1, -1]) {
    ctx.beginPath()
    ctx.moveTo(-sgn * r * 0.95, -r * 0.75)
    ctx.lineTo(sgn * r * 0.95, r * 0.95)
    ctx.stroke()
  }
  // shield
  ctx.beginPath()
  ctx.moveTo(-r * 0.62, -r * 0.62)
  ctx.lineTo(r * 0.62, -r * 0.62)
  ctx.lineTo(r * 0.62, r * 0.05)
  ctx.quadraticCurveTo(r * 0.55, r * 0.6, 0, r * 0.9)
  ctx.quadraticCurveTo(-r * 0.55, r * 0.6, -r * 0.62, r * 0.05)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = r * 0.05
  ctx.strokeStyle = line
  ctx.stroke()
  // inner chevron
  ctx.beginPath()
  ctx.moveTo(-r * 0.42, -r * 0.05)
  ctx.lineTo(0, r * 0.38)
  ctx.lineTo(r * 0.42, -r * 0.05)
  ctx.lineWidth = r * 0.07
  ctx.stroke()
  // crown
  ctx.beginPath()
  ctx.moveTo(-r * 0.5, -r * 0.72)
  ctx.lineTo(-r * 0.55, -r * 1.12)
  ctx.lineTo(-r * 0.25, -r * 0.92)
  ctx.lineTo(0, -r * 1.22)
  ctx.lineTo(r * 0.25, -r * 0.92)
  ctx.lineTo(r * 0.55, -r * 1.12)
  ctx.lineTo(r * 0.5, -r * 0.72)
  ctx.closePath()
  ctx.fillStyle = line
  ctx.fill()
  ctx.restore()
}

export function banner(scene: Scene, w = 256, h = 512): DynamicTexture {
  const tex = new DynamicTexture('tex_banner', { width: w, height: h }, scene, true)
  const ctx = tex.getContext() as unknown as Ctx
  const g = ctx.createLinearGradient(0, 0, w, 0)
  g.addColorStop(0, '#4a0b10')
  g.addColorStop(0.5, '#7d141b')
  g.addColorStop(1, '#4a0b10')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rand() * 0.08})`
    ctx.fillRect(rand() * w, rand() * h, 1, 3)
  }
  ctx.strokeStyle = '#b8914b'
  ctx.lineWidth = 5
  ctx.strokeRect(14, 14, w - 28, h - 70)
  drawCrest(ctx, w / 2, h * 0.42, w * 0.3, '#5a0c12', '#d4aa5c')
  // fringe
  for (let x = 6; x < w; x += 9) {
    ctx.fillStyle = '#b8914b'
    ctx.fillRect(x, h - 48, 4, 40)
  }
  tex.update(true)
  tex.hasAlpha = false
  return tex
}

export function wood(scene: Scene, size: number, base: [number, number, number]): DynamicTexture {
  return make(scene, `tex_wood_${base.join('_')}`, size, (ctx, s) => {
    ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 220; i++) {
      const y = rand() * s
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + rand() * 0.12})`
      ctx.lineWidth = 1 + rand() * 3
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x <= s; x += s / 16) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3)
      ctx.stroke()
    }
  })
}

export function windowPanes(scene: Scene, size: number): DynamicTexture {
  return make(scene, 'tex_window', size, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s)
    g.addColorStop(0, '#2c4466')
    g.addColorStop(1, '#0f1a2a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    // rain streaks
    for (let i = 0; i < 160; i++) {
      const x = rand() * s
      const y = rand() * s
      ctx.strokeStyle = `rgba(190,215,255,${0.08 + rand() * 0.18})`
      ctx.lineWidth = 1 + rand()
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + rand() * 2 - 1, y + 10 + rand() * 40)
      ctx.stroke()
    }
    ctx.fillStyle = '#0a0b0d'
    const n = 4
    for (let i = 0; i <= n; i++) {
      ctx.fillRect((i * s) / n - 4, 0, 8, s)
      ctx.fillRect(0, (i * s) / n - 4, s, 8)
    }
  })
}

export function lockerFront(scene: Scene, size: number): DynamicTexture {
  return make(scene, 'tex_locker', size, (ctx, s) => {
    ctx.fillStyle = '#2b3236'
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = '#111518'
    ctx.lineWidth = s / 60
    ctx.strokeRect(0, 0, s, s)
    ctx.fillStyle = '#14191c'
    for (let i = 0; i < 6; i++) ctx.fillRect(s * 0.3, s * 0.08 + i * s * 0.035, s * 0.4, s * 0.015)
    ctx.fillStyle = '#8a8f92'
    ctx.fillRect(s * 0.78, s * 0.45, s * 0.06, s * 0.14)
    blots(ctx, s, 60, s * 0.01, s * 0.06, () => `rgba(0,0,0,${rand() * 0.12})`)
  }, { wrap: false })
}

export function rug(scene: Scene, size: number): DynamicTexture {
  return make(scene, 'tex_rug', size, (ctx, s) => {
    ctx.fillStyle = '#3d0d12'
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = '#9c7a3e'
    ctx.lineWidth = s / 40
    ctx.strokeRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88)
    ctx.lineWidth = s / 120
    ctx.strokeRect(s * 0.12, s * 0.12, s * 0.76, s * 0.76)
    drawCrest(ctx, s / 2, s / 2, s * 0.18, '#2a070b', '#9c7a3e')
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.12})`
      ctx.fillRect(rand() * s, rand() * s, 2, 2)
    }
  }, { wrap: false })
}

/**
 * Facade for the estate: pale stone, rows of windows, cornices. `emissive`
 * paints only the lit windows on black, for the glow pass; call both with the
 * same `seed` so they line up.
 */
export function facade(scene: Scene, name: string, w: number, h: number, cols: number, rows: number, seedValue: number, emissive: boolean, lit = 0.7): DynamicTexture {
  reseed(seedValue)
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true)
  const ctx = tex.getContext() as unknown as Ctx
  ctx.fillStyle = emissive ? '#000000' : '#7a7164'
  ctx.fillRect(0, 0, w, h)
  if (!emissive)
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.07})`
      ctx.fillRect(rand() * w, rand() * h, 3, 3)
    }
  const cw = w / cols
  const rh = h / rows
  for (let r = 0; r < rows; r++) {
    if (!emissive) {
      ctx.fillStyle = 'rgba(255,240,210,0.22)'
      ctx.fillRect(0, r * rh + rh * 0.9, w, rh * 0.06)
    }
    for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.28
      const y = r * rh + rh * 0.2
      const ww = cw * 0.44
      const wh = rh * 0.6
      const on = rand() < lit
      const warmth = rand()
      if (emissive) {
        if (on) {
          const g = ctx.createLinearGradient(0, y, 0, y + wh)
          g.addColorStop(0, warmth > 0.3 ? '#ffcf86' : '#ffe2b0')
          g.addColorStop(1, '#c97a2c')
          ctx.fillStyle = g
          ctx.fillRect(x, y, ww, wh)
        }
      } else {
        ctx.fillStyle = '#1c1a17'
        ctx.fillRect(x - 4, y - 4, ww + 8, wh + 8)
        ctx.fillStyle = on ? '#e3a456' : '#141a24'
        ctx.fillRect(x, y, ww, wh)
        ctx.fillStyle = 'rgba(230,220,200,0.3)'
        ctx.fillRect(x - 8, y - 14, ww + 16, 7)
      }
      ctx.fillStyle = 'rgba(16,13,10,0.95)'
      ctx.fillRect(x + ww / 2 - 2, y, 4, wh)
      ctx.fillRect(x, y + wh * 0.38, ww, 4)
    }
  }
  tex.update(true)
  return tex
}

export function cobblestone(scene: Scene, size: number): DynamicTexture {
  return make(scene, 'tex_cobble', size, (ctx, s) => {
    ctx.fillStyle = '#121214'
    ctx.fillRect(0, 0, s, s)
    const n = 14
    const c = s / n
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = 26 + rand() * 22
        ctx.fillStyle = `rgb(${v},${v},${v + 3})`
        const ox = (y % 2) * c * 0.5
        ctx.beginPath()
        const px = x * c + ox + c * 0.06
        const py = y * c + c * 0.06
        const r = c * 0.18
        const w = c * 0.88
        ctx.moveTo(px + r, py)
        ctx.arcTo(px + w, py, px + w, py + w, r)
        ctx.arcTo(px + w, py + w, px, py + w, r)
        ctx.arcTo(px, py + w, px, py, r)
        ctx.arcTo(px, py, px + w, py, r)
        ctx.fill()
        if (x === 0) {
          ctx.save()
          ctx.translate(s, 0)
          ctx.fill()
          ctx.restore()
        }
      }
  })
}

// ── Scene 02: city, bunker, laboratory ───────────────────────────────────

/** Wet asphalt, one 12 m stretch of a two-lane avenue (x across, v along the road). */
export function road(scene: Scene, size: number): DynamicTexture {
  return make(scene, 'tex_road', size, (ctx, s) => {
    ctx.fillStyle = '#26272a'
    ctx.fillRect(0, 0, s, s)
    blots(ctx, s, 1400, s * 0.002, s * 0.012, () => {
      const v = rand() < 0.5 ? 12 : 70
      return `rgba(${v},${v},${v + 4},${0.05 + rand() * 0.08})`
    })
    // tyre-polished tracks are darker and smoother
    for (const x of [0.2, 0.32, 0.68, 0.8]) {
      const g = ctx.createLinearGradient(s * (x - 0.05), 0, s * (x + 0.05), 0)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(0.5, 'rgba(0,0,0,0.22)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(s * (x - 0.05), 0, s * 0.1, s)
    }
    // centre dashes and solid edge lines
    ctx.fillStyle = 'rgba(214,190,120,0.85)'
    ctx.fillRect(s * 0.495, 0, s * 0.012, s * 0.45)
    ctx.fillStyle = 'rgba(225,225,220,0.7)'
    for (const x of [0.04, 0.95]) ctx.fillRect(s * x, 0, s * 0.01, s)
    // patched cracks
    ctx.strokeStyle = 'rgba(8,8,9,0.6)'
    ctx.lineWidth = 2
    for (let i = 0; i < 6; i++) {
      let x = rand() * s
      let y = rand() * s
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 6; k++) ctx.lineTo((x += (rand() - 0.5) * s * 0.06), (y += rand() * s * 0.04))
      ctx.stroke()
    }
  })
}

/** Brushed steel with panel seams and rivets (greyscale; tint with albedoColor). */
export function steelPanel(scene: Scene, size: number, panels = 2): DynamicTexture {
  return make(scene, `tex_steel_${panels}`, size, (ctx, s) => {
    ctx.fillStyle = '#9a9ca0'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < s * 1.5; i++) {
      const v = 120 + rand() * 60
      ctx.fillStyle = `rgba(${v},${v},${v + 3},0.12)`
      ctx.fillRect(0, rand() * s, s, 1)
    }
    const c = s / panels
    ctx.strokeStyle = 'rgba(20,20,22,0.85)'
    ctx.lineWidth = Math.max(2, s / 256)
    for (let i = 0; i <= panels; i++) {
      ctx.beginPath()
      ctx.moveTo(i * c, 0)
      ctx.lineTo(i * c, s)
      ctx.moveTo(0, i * c)
      ctx.lineTo(s, i * c)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(40,40,44,0.9)'
    for (let x = 0; x < panels; x++)
      for (let y = 0; y < panels; y++)
        for (const [ox, oy] of [[0.06, 0.06], [0.94, 0.06], [0.06, 0.94], [0.94, 0.94]]) {
          ctx.beginPath()
          ctx.arc((x + ox) * c, (y + oy) * c, s / 180, 0, Math.PI * 2)
          ctx.fill()
        }
  })
}

/** Large polished floor tiles with fine grout lines (dark charcoal lab floor). */
export function labFloor(scene: Scene, size: number): DynamicTexture {
  return make(scene, 'tex_lab_floor', size, (ctx, s) => {
    const n = 4
    const c = s / n
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++) {
        const v = 34 + rand() * 8
        ctx.fillStyle = `rgb(${v},${v + 1},${v + 4})`
        ctx.fillRect(x * c, y * c, c, c)
      }
    blots(ctx, s, 300, s * 0.01, s * 0.05, () => `rgba(255,255,255,${0.008 + rand() * 0.012})`)
    ctx.strokeStyle = 'rgba(8,9,11,0.9)'
    ctx.lineWidth = Math.max(2, s / 300)
    for (let i = 0; i <= n; i++) {
      ctx.beginPath()
      ctx.moveTo(i * c, 0)
      ctx.lineTo(i * c, s)
      ctx.moveTo(0, i * c)
      ctx.lineTo(s, i * c)
      ctx.stroke()
    }
  })
}

/** Diagonal warning stripes: yellow/black for floors, red/white for the boom barrier. */
export function stripes(scene: Scene, kind: 'hazard' | 'barrier'): DynamicTexture {
  const [a, b] = kind === 'hazard' ? ['#c99a1c', '#121212'] : ['#b0161d', '#e9e6df']
  return make(scene, `tex_stripes_${kind}`, 128, (ctx, s) => {
    ctx.fillStyle = b
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = a
    for (let i = -s; i < s * 2; i += s / 2) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + s / 4, 0)
      ctx.lineTo(i + s / 4 + s, s)
      ctx.lineTo(i + s, s)
      ctx.fill()
    }
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.18})`
      ctx.fillRect(rand() * s, rand() * s, 2, 2)
    }
  })
}

/** Painted or back-lit signage. Lines are drawn centred; the first is the largest. */
export function sign(scene: Scene, name: string, lines: string[], o: { w?: number; h?: number; bg?: string; fg?: string; accent?: string } = {}): DynamicTexture {
  const w = o.w ?? 512
  const h = o.h ?? 256
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true)
  const ctx = tex.getContext() as unknown as Ctx
  ctx.fillStyle = o.bg ?? '#101114'
  ctx.fillRect(0, 0, w, h)
  if (o.accent) {
    ctx.fillStyle = o.accent
    ctx.fillRect(0, 0, w, h * 0.06)
    ctx.fillRect(0, h * 0.94, w, h * 0.06)
  }
  ctx.fillStyle = o.fg ?? '#e8e4da'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const big = h / (lines.length + 1.2)
  lines.forEach((line, i) => {
    const size = i === 0 ? big : big * 0.55
    ctx.font = `600 ${size}px Oswald, 'Arial Narrow', sans-serif`
    const y = lines.length === 1 ? h / 2 : h * (0.3 + (i * 0.5) / Math.max(1, lines.length - 1))
    ctx.fillText(line, w / 2, y, w * 0.9)
  })
  tex.update(true)
  return tex
}

/** Instrument displays for consoles and lab monitors (emissive). */
export function screen(scene: Scene, name: string, kind: 'graph' | 'wave' | 'rings' | 'text', seedValue: number): DynamicTexture {
  reseed(seedValue)
  const w = 256
  const h = 160
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true)
  const ctx = tex.getContext() as unknown as Ctx
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#0b1a26')
  g.addColorStop(1, '#050b12')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(90,170,220,0.18)'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 16) {
    ctx.beginPath()
    ctx.moveTo(x, 18)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 18; y < h; y += 16) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  // header bar
  ctx.fillStyle = 'rgba(120,200,240,0.55)'
  ctx.fillRect(6, 5, 70 + rand() * 60, 6)
  ctx.fillStyle = 'rgba(240,180,90,0.8)'
  ctx.fillRect(w - 30, 5, 22, 6)
  ctx.lineWidth = 2
  if (kind === 'graph' || kind === 'wave') {
    for (let k = 0; k < (kind === 'wave' ? 3 : 2); k++) {
      ctx.strokeStyle = k === 0 ? 'rgba(130,215,255,0.95)' : k === 1 ? 'rgba(90,150,220,0.7)' : 'rgba(240,180,90,0.7)'
      ctx.beginPath()
      let y = h * (0.45 + k * 0.15)
      const f = 0.03 + rand() * 0.08
      const ph = rand() * 6
      for (let x = 0; x <= w; x += 3) {
        y = kind === 'wave' ? h * (0.35 + k * 0.2) + Math.sin(x * f + ph) * (12 + k * 4) * Math.sin(x * 0.011 + k) : Math.min(h - 8, Math.max(24, y + (rand() - 0.5) * 12))
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  } else if (kind === 'rings') {
    const cx = w * 0.36
    const cy = h * 0.58
    for (let r = 14; r < 64; r += 12) {
      ctx.strokeStyle = `rgba(130,215,255,${0.9 - r / 90})`
      ctx.beginPath()
      ctx.ellipse(cx, cy, r, r * (0.4 + rand() * 0.6), rand() * Math.PI, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(200,240,255,0.9)'
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(130,215,255,0.6)'
      ctx.fillRect(w * 0.68, 30 + i * 18, 40 + rand() * 30, 5)
    }
  } else {
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 4 === 0 ? 'rgba(240,180,90,0.75)' : 'rgba(150,210,240,0.6)'
      ctx.fillRect(8, 24 + i * 11, 30 + rand() * (w - 60), 4)
    }
  }
  tex.update(true)
  return tex
}

// ── Sprites ───────────────────────────────────────────────────────────────

export function radialSprite(scene: Scene, name: string, size: number, color = '255,255,255', falloff = 1): DynamicTexture {
  return make(scene, name, size, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, `rgba(${color},1)`)
    g.addColorStop(0.25 * falloff, `rgba(${color},0.45)`)
    g.addColorStop(1, `rgba(${color},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  }, { wrap: false })
}

export function streakSprite(scene: Scene): DynamicTexture {
  return make(scene, 'tex_raindrop', 64, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.7, 'rgba(220,235,255,0.9)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(s * 0.42, 0, s * 0.16, s)
  }, { wrap: false })
}

/** Vertical gradient for fake volumetric light cones (bright at the lamp). */
export function coneGradient(scene: Scene): DynamicTexture {
  return make(scene, 'tex_cone', 128, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  }, { wrap: false })
}

export function fogBlob(scene: Scene): DynamicTexture {
  return make(scene, 'tex_fog', 256, (ctx, s) => {
    for (let i = 0; i < 26; i++) {
      const x = s * (0.2 + rand() * 0.6)
      const y = s * (0.3 + rand() * 0.4)
      const r = s * (0.12 + rand() * 0.25)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.18)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, s, s)
    }
  }, { wrap: false })
}

/**
 * Tileable cloth detail: a near-white albedo (multiplied by the garment colour)
 * and a matching normal map. Knit is a fine jersey rib, wool a soft diagonal
 * twill, denim a coarser twill with lighter flecks.
 */
export function fabric(scene: Scene, kind: 'knit' | 'wool' | 'denim'): { albedo: DynamicTexture; bump: DynamicTexture } {
  const size = 256
  reseed(kind === 'knit' ? 11 : kind === 'wool' ? 23 : 37)
  const height = make(scene, `tex_fabric_h_${kind}`, size, (ctx, s) => {
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, s, s)
    if (kind === 'knit') {
      const step = s / 32
      for (let x = 0; x < s; x += step) {
        for (let y = 0; y < s; y += step / 2) {
          const g = ctx.createLinearGradient(x, 0, x + step, 0)
          g.addColorStop(0, '#5a5a5a')
          g.addColorStop(0.5, '#b0b0b0')
          g.addColorStop(1, '#5a5a5a')
          ctx.fillStyle = g
          ctx.fillRect(x, y, step, step / 2 - 1)
        }
      }
    } else {
      const step = s / (kind === 'wool' ? 48 : 32)
      ctx.lineWidth = step * 0.55
      for (let i = -s; i < s * 2; i += step) {
        ctx.strokeStyle = `rgba(${kind === 'wool' ? 190 : 210},${kind === 'wool' ? 190 : 210},${kind === 'wool' ? 190 : 210},0.6)`
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i + s, s)
        ctx.stroke()
      }
    }
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(${rand() < 0.5 ? 0 : 255},${rand() < 0.5 ? 0 : 255},${rand() < 0.5 ? 0 : 255},0.05)`
      ctx.fillRect(rand() * s, rand() * s, 2, 2)
    }
  })
  const albedo = make(scene, `tex_fabric_a_${kind}`, size, (ctx, s) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, s, s)
    ctx.globalAlpha = kind === 'denim' ? 0.22 : 0.12
    ctx.drawImage((height.getContext() as unknown as Ctx).canvas, 0, 0)
    ctx.globalAlpha = 1
    if (kind === 'denim')
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.1 + rand() * 0.2})`
        ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 3, 1)
      }
  })
  const bump = normalFromHeight(scene, `tex_fabric_n_${kind}`, height, kind === 'knit' ? 3 : 2)
  height.dispose()
  return { albedo, bump }
}
