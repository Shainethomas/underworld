import * as THREE from 'three'

// Procedural canvas textures for the placeholder art pass. Textures are cached
// by key; keys are namespaced by environment ("street:facade-3") so a scene's
// textures can be released when its environment unloads. "shared:" textures
// (gang emblem, tattoos, glows) live for the whole session.

const cache = new Map<string, THREE.Texture>()

export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

function canvasTex(
  key: string,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { srgb?: boolean; repeat?: [number, number]; mips?: boolean } = {},
): THREE.CanvasTexture {
  const hit = cache.get(key)
  if (hit) return hit as THREE.CanvasTexture
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
  t.anisotropy = 4
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...opts.repeat)
  }
  if (opts.mips === false) {
    t.generateMipmaps = false
    t.minFilter = THREE.LinearFilter
  }
  cache.set(key, t)
  return t
}

export function releaseTextures(prefix: string) {
  for (const [k, t] of cache) {
    if (k.startsWith(prefix)) {
      t.dispose()
      cache.delete(k)
    }
  }
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number, seed: number, light = false) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0
    g.fillStyle = `rgba(${v},${v},${v},${r() * alpha})`
    g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5)
  }
}

// ── Mad Dogs gang emblem ──────────────────────────────────────────────────

function drawDogHead(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, fill: string, eye: string) {
  g.save()
  g.translate(cx, cy)
  g.scale(s, s)
  g.fillStyle = fill
  g.beginPath()
  // snarling dog skull, facing forward: ears, brow, cheek spikes, open jaw
  g.moveTo(-58, -78)
  g.lineTo(-30, -38)
  g.lineTo(0, -48)
  g.lineTo(30, -38)
  g.lineTo(58, -78)
  g.lineTo(52, -18)
  g.lineTo(66, 8)
  g.lineTo(40, 20)
  g.lineTo(30, 52)
  g.lineTo(14, 70)
  g.lineTo(0, 62)
  g.lineTo(-14, 70)
  g.lineTo(-30, 52)
  g.lineTo(-40, 20)
  g.lineTo(-66, 8)
  g.lineTo(-52, -18)
  g.closePath()
  g.fill()
  // eye sockets
  g.fillStyle = '#0b0b0c'
  for (const sx of [-1, 1]) {
    g.beginPath()
    g.moveTo(sx * 10, -16)
    g.lineTo(sx * 40, -24)
    g.lineTo(sx * 32, -2)
    g.lineTo(sx * 14, 0)
    g.closePath()
    g.fill()
  }
  g.fillStyle = eye
  for (const sx of [-1, 1]) {
    g.beginPath()
    g.arc(sx * 25, -11, 5.5, 0, Math.PI * 2)
    g.fill()
  }
  // nose + teeth
  g.fillStyle = '#0b0b0c'
  g.beginPath()
  g.moveTo(-8, 14)
  g.lineTo(8, 14)
  g.lineTo(0, 26)
  g.closePath()
  g.fill()
  g.fillRect(-24, 34, 48, 12)
  g.fillStyle = fill
  for (let i = 0; i < 6; i++) {
    const x = -22 + i * 8.8
    g.beginPath()
    g.moveTo(x, 34)
    g.lineTo(x + 4.4, 43)
    g.lineTo(x + 8.8, 34)
    g.fill()
  }
  g.restore()
}

function arcText(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, start: number, end: number, flip: boolean) {
  const step = (end - start) / (text.length - 1)
  for (let i = 0; i < text.length; i++) {
    const a = start + step * i
    g.save()
    g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    g.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2))
    g.fillText(text[i], 0, 0)
    g.restore()
  }
}

export const emblemTexture = () =>
  canvasTex('shared:emblem', 512, 512, (g, w) => {
    const c = w / 2
    g.clearRect(0, 0, w, w)
    g.fillStyle = '#0c0c0d'
    g.beginPath()
    g.arc(c, c, 250, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 12
    g.strokeStyle = '#8f1d1a'
    g.stroke()
    g.lineWidth = 4
    g.strokeStyle = '#c9a45c'
    g.beginPath()
    g.arc(c, c, 232, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.arc(c, c, 150, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = '#e8e2d4'
    g.font = '900 58px Cinzel, Georgia, serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    arcText(g, 'MAD DOGS', c, c, 192, -Math.PI * 0.82, -Math.PI * 0.18, false)
    g.font = '700 40px Cinzel, Georgia, serif'
    arcText(g, 'M · C', c, c, 192, Math.PI * 0.62, Math.PI * 0.38, true)
    drawDogHead(g, c, c + 4, 1.55, '#e8e2d4', '#d0302a')
    speckle(g, w, w, 1800, 0.35, 11)
  }, { mips: true })

// ── Graffiti ──────────────────────────────────────────────────────────────

export const graffitiTexture = (variant: number) =>
  canvasTex(`shared:graffiti-${variant}`, 1024, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    const r = rng(variant * 97 + 3)
    const sprayText = (text: string, x: number, y: number, size: number, color: string, outline: string, rot: number) => {
      g.save()
      g.translate(x, y)
      g.rotate(rot)
      g.font = `900 ${size}px Impact, "Arial Black", sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.lineJoin = 'round'
      g.lineWidth = size * 0.12
      g.strokeStyle = outline
      g.strokeText(text, 0, 0)
      g.fillStyle = color
      g.fillText(text, 0, 0)
      // drips
      g.fillStyle = color
      const wText = g.measureText(text).width
      for (let i = 0; i < 9; i++) {
        const dx = -wText / 2 + r() * wText
        g.fillRect(dx, size * 0.32, 3 + r() * 4, 12 + r() * size * 0.7)
      }
      g.restore()
    }
    if (variant === 0) {
      drawDogHead(g, 210, 250, 1.6, '#c62a24', '#f2ede2')
      sprayText('MAD DOGS', 640, 230, 150, '#e9e4d8', '#b8221d', -0.06)
      sprayText('OUR STREETS', 650, 380, 62, '#c62a24', '#111', -0.04)
    } else if (variant === 1) {
      sprayText('PAY OR', 330, 190, 120, '#c62a24', '#0d0d0d', -0.1)
      sprayText('PAY', 600, 330, 170, '#f0ebe0', '#c62a24', 0.05)
      drawDogHead(g, 870, 220, 1.0, '#f0ebe0', '#c62a24')
    } else {
      sprayText('MD', 230, 260, 220, '#c62a24', '#f0ebe0', -0.15)
      sprayText('MAD DOGS RULE', 650, 280, 86, '#e8e3d6', '#121212', 0.04)
    }
    // overspray
    g.globalCompositeOperation = 'source-atop'
    speckle(g, w, h, 5000, 0.5, variant + 40)
    g.globalCompositeOperation = 'source-over'
  })

// ── Building facades ──────────────────────────────────────────────────────

export interface FacadeOpts {
  base: string
  windowCols: number
  floors: number
  lit: number
  trim?: string
  seed: number
}

export const facadeTexture = (ns: string, o: FacadeOpts) =>
  canvasTex(`${ns}:facade-${o.seed}`, 512, 1024, (g, w, h) => {
    const r = rng(o.seed)
    g.fillStyle = o.base
    g.fillRect(0, 0, w, h)
    // brick courses
    g.strokeStyle = 'rgba(0,0,0,0.22)'
    g.lineWidth = 1
    for (let y = 0; y < h; y += 9) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y)
      g.stroke()
      const off = (y / 9) % 2 ? 0 : 11
      for (let x = off; x < w; x += 22) {
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x, y + 9)
        g.stroke()
      }
    }
    speckle(g, w, h, 9000, 0.25, o.seed + 1)
    speckle(g, w, h, 3000, 0.08, o.seed + 2, true)
    // grime streaks
    for (let i = 0; i < 30; i++) {
      const x = r() * w
      const grd = g.createLinearGradient(0, 0, 0, h)
      grd.addColorStop(0, 'rgba(0,0,0,0)')
      grd.addColorStop(1, `rgba(0,0,0,${0.1 + r() * 0.25})`)
      g.fillStyle = grd
      g.fillRect(x, r() * h * 0.5, 2 + r() * 10, h)
    }
    const fh = h / o.floors
    const cw = w / o.windowCols
    for (let f = 0; f < o.floors; f++) {
      if (o.trim) {
        g.fillStyle = o.trim
        g.fillRect(0, f * fh + fh - 6, w, 6)
      }
      for (let c = 0; c < o.windowCols; c++) {
        const x = c * cw + cw * 0.22
        const y = f * fh + fh * 0.2
        const ww = cw * 0.56
        const wh = fh * 0.56
        g.fillStyle = '#1b1a1a'
        g.fillRect(x - 4, y - 4, ww + 8, wh + 10)
        const lit = r() < o.lit
        if (lit) {
          const warm = r() < 0.8
          const grd = g.createLinearGradient(x, y, x, y + wh)
          grd.addColorStop(0, warm ? '#f2b45e' : '#9fc4d8')
          grd.addColorStop(1, warm ? '#8a4f1e' : '#3c5868')
          g.fillStyle = grd
        } else {
          g.fillStyle = r() < 0.5 ? '#0d1013' : '#14181c'
        }
        g.fillRect(x, y, ww, wh)
        // blinds / mullions
        g.fillStyle = 'rgba(0,0,0,0.55)'
        g.fillRect(x + ww / 2 - 1.5, y, 3, wh)
        if (lit && r() < 0.5) g.fillRect(x, y, ww, wh * (0.2 + r() * 0.5))
        // sill
        g.fillStyle = 'rgba(160,150,140,0.35)'
        g.fillRect(x - 6, y + wh + 4, ww + 12, 4)
      }
    }
  })

export const storefrontTexture = (ns: string, name: string, accent: string, shutter: number, seed: number) =>
  canvasTex(`${ns}:store-${name}-${seed}`, 512, 256, (g, w, h) => {
    const r = rng(seed)
    g.fillStyle = '#1a1817'
    g.fillRect(0, 0, w, h)
    // sign band
    g.fillStyle = '#0e0d0d'
    g.fillRect(0, 0, w, 58)
    g.fillStyle = accent
    g.font = '800 40px "Arial Narrow", Inter, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(name, w / 2, 31)
    // window with warm interior
    const grd = g.createLinearGradient(0, 70, 0, h)
    grd.addColorStop(0, '#6b4a2a')
    grd.addColorStop(1, '#22160d')
    g.fillStyle = grd
    g.fillRect(24, 70, w * 0.62, h - 84)
    // shelves silhouettes
    g.fillStyle = 'rgba(0,0,0,0.45)'
    for (let i = 0; i < 4; i++) g.fillRect(30, 100 + i * 34, w * 0.6, 5)
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${120 + r() * 120},${80 + r() * 80},${40 + r() * 50},0.6)`
      g.fillRect(34 + r() * w * 0.58, 82 + Math.floor(r() * 4) * 34, 6 + r() * 8, 14)
    }
    // door
    g.fillStyle = '#100f0e'
    g.fillRect(w * 0.7, 66, w * 0.24, h - 66)
    g.fillStyle = 'rgba(240,190,110,0.25)'
    g.fillRect(w * 0.72, 76, w * 0.2, 70)
    // roll-down shutter over part of the front
    if (shutter > 0) {
      g.fillStyle = '#5b5a57'
      g.fillRect(16, 62, w - 32, (h - 62) * shutter)
      g.fillStyle = 'rgba(0,0,0,0.35)'
      for (let y = 62; y < 62 + (h - 62) * shutter; y += 7) g.fillRect(16, y, w - 32, 2)
    }
    speckle(g, w, h, 2500, 0.3, seed + 9)
  })

// ── Neon ──────────────────────────────────────────────────────────────────

export const neonTexture = (text: string, color: string, vertical = false) =>
  canvasTex(`shared:neon-${text}-${color}-${vertical}`, vertical ? 128 : 512, vertical ? 512 : 160, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = color
    const draw = (blur: number, fill: string) => {
      g.shadowBlur = blur
      g.fillStyle = fill
      if (vertical) {
        const step = h / (text.length + 0.5)
        g.font = `700 ${Math.min(step * 0.85, 96)}px "Arial Rounded MT Bold", Inter, sans-serif`
        for (let i = 0; i < text.length; i++) g.fillText(text[i], w / 2, step * (i + 0.75))
      } else {
        g.font = `700 ${h * 0.56}px "Arial Rounded MT Bold", Inter, sans-serif`
        g.fillText(text, w / 2, h / 2)
      }
    }
    draw(28, color)
    draw(12, color)
    draw(4, '#fff6ea')
  }, { mips: false })

// ── Signs ─────────────────────────────────────────────────────────────────

export const welcomeSignTexture = () =>
  canvasTex('highway:welcome', 1024, 512, (g, w, h) => {
    g.fillStyle = '#20402f'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#e9e4d6'
    g.lineWidth = 14
    g.strokeRect(22, 22, w - 44, h - 44)
    g.fillStyle = '#e9e4d6'
    g.textAlign = 'center'
    g.font = '600 52px Inter, sans-serif'
    g.fillText('WELCOME TO', w / 2, 140)
    g.font = '900 128px Cinzel, Georgia, serif'
    g.fillText('PORT ARGENT', w / 2, 280)
    g.font = '500 40px Inter, sans-serif'
    g.fillText('EST. 1891  ·  POP. 412,000', w / 2, 380)
    speckle(g, w, h, 12000, 0.35, 5)
    // gang tag sprayed across it
    g.save()
    g.translate(w * 0.56, h * 0.58)
    g.rotate(-0.14)
    g.font = '900 150px Impact, "Arial Black", sans-serif'
    g.textAlign = 'center'
    g.lineWidth = 16
    g.strokeStyle = '#111'
    g.strokeText('MAD DOGS', 0, 0)
    g.fillStyle = '#c62a24'
    g.fillText('MAD DOGS', 0, 0)
    g.restore()
    drawDogHead(g, 120, 400, 0.8, '#c62a24', '#eee')
  })

// ── Skin & tattoos ────────────────────────────────────────────────────────

export const tattooSkinTexture = (skin: string, density: number, seed: number) =>
  canvasTex(`shared:tattoo-${skin}-${density}-${seed}`, 512, 512, (g, w, h) => {
    const r = rng(seed)
    g.fillStyle = skin
    g.fillRect(0, 0, w, h)
    speckle(g, w, h, 4000, 0.06, seed + 3)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    const ink = () => (r() < 0.12 ? 'rgba(120,30,30,0.75)' : `rgba(20,28,36,${0.55 + r() * 0.3})`)
    // tribal sweeps
    for (let i = 0; i < 26 * density; i++) {
      g.strokeStyle = ink()
      g.lineWidth = 3 + r() * 9
      g.beginPath()
      const x = r() * w
      const y = r() * h
      g.moveTo(x, y)
      g.bezierCurveTo(x + (r() - 0.5) * 180, y + (r() - 0.5) * 120, x + (r() - 0.5) * 180, y + (r() - 0.5) * 160, x + (r() - 0.5) * 140, y + (r() - 0.5) * 140)
      g.stroke()
    }
    // filled motifs: roses / stars / skull blobs
    for (let i = 0; i < 12 * density; i++) {
      g.fillStyle = ink()
      const x = r() * w
      const y = r() * h
      const s = 8 + r() * 26
      g.beginPath()
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2
        const rr = k % 2 ? s * 0.45 : s
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      }
      g.closePath()
      g.fill()
    }
  })

// ── Surfaces ──────────────────────────────────────────────────────────────

/** Wet asphalt/concrete: colour map + roughness map with puddles. */
export function groundTextures(ns: string, base: string, seed: number, repeat: [number, number]) {
  const r = rng(seed)
  const puddles = Array.from({ length: 12 }, () => ({ x: 0.1 + r() * 0.8, y: 0.1 + r() * 0.8, rx: 0.05 + r() * 0.1, ry: 0.03 + r() * 0.05 }))
  const map = canvasTex(`${ns}:ground-map`, 512, 512, (g, w, h) => {
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    speckle(g, w, h, 30000, 0.35, seed)
    speckle(g, w, h, 8000, 0.08, seed + 1, true)
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.2 + r() * 0.3})`
      g.lineWidth = 1 + r() * 2
      g.beginPath()
      let x = r() * w
      let y = r() * h
      g.moveTo(x, y)
      for (let k = 0; k < 8; k++) {
        x += (r() - 0.5) * 60
        y += (r() - 0.5) * 60
        g.lineTo(x, y)
      }
      g.stroke()
    }
    for (const p of puddles) {
      g.fillStyle = 'rgba(0,0,0,0.12)'
      g.beginPath()
      g.ellipse(p.x * w, p.y * h, p.rx * w, p.ry * h, 0, 0, Math.PI * 2)
      g.fill()
    }
  }, { repeat })
  const rough = canvasTex(`${ns}:ground-rough`, 256, 256, (g, w, h) => {
    g.fillStyle = '#c4c4c4'
    g.fillRect(0, 0, w, h)
    speckle(g, w, h, 9000, 0.25, seed + 2)
    for (const p of puddles) {
      const grd = g.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, Math.max(p.rx, p.ry) * w)
      grd.addColorStop(0, 'rgba(60,60,60,0.9)')
      grd.addColorStop(0.6, 'rgba(90,90,90,0.6)')
      grd.addColorStop(1, 'rgba(196,196,196,0)')
      g.fillStyle = grd
      g.beginPath()
      g.ellipse(p.x * w, p.y * h, p.rx * w * 1.3, p.ry * h * 1.3, 0, 0, Math.PI * 2)
      g.fill()
    }
  }, { repeat, srgb: false })
  return { map, rough }
}

export const roadTexture = () =>
  canvasTex('highway:road', 512, 1024, (g, w, h) => {
    g.fillStyle = '#26282b'
    g.fillRect(0, 0, w, h)
    speckle(g, w, h, 40000, 0.4, 77)
    speckle(g, w, h, 9000, 0.1, 78, true)
    // tyre tracks
    for (const x of [0.15, 0.32, 0.68, 0.85]) {
      g.fillStyle = 'rgba(0,0,0,0.18)'
      g.fillRect(x * w - 18, 0, 36, h)
    }
    // centre double yellow, dashed whites
    g.fillStyle = '#b8902f'
    g.fillRect(w / 2 - 10, 0, 6, h)
    g.fillRect(w / 2 + 4, 0, 6, h)
    g.fillStyle = '#c9c6bd'
    for (const x of [0.25, 0.75]) for (let y = 0; y < h; y += 256) g.fillRect(x * w - 4, y, 8, 120)
    g.fillRect(14, 0, 8, h)
    g.fillRect(w - 22, 0, 8, h)
    speckle(g, w, h, 6000, 0.5, 79)
  }, { repeat: [1, 30] })

export const corrugatedTexture = () =>
  canvasTex('shared:corrugated', 256, 256, (g, w, h) => {
    for (let x = 0; x < w; x += 16) {
      const grd = g.createLinearGradient(x, 0, x + 16, 0)
      grd.addColorStop(0, '#7a7a7a')
      grd.addColorStop(0.35, '#f0f0f0')
      grd.addColorStop(0.7, '#9a9a9a')
      grd.addColorStop(1, '#5a5a5a')
      g.fillStyle = grd
      g.fillRect(x, 0, 16, h)
    }
    // rust
    const r = rng(31)
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${90 + r() * 50},${40 + r() * 20},20,${r() * 0.35})`
      g.beginPath()
      g.arc(r() * w, r() * h, 2 + r() * 14, 0, Math.PI * 2)
      g.fill()
    }
    speckle(g, w, h, 5000, 0.25, 32)
  }, { repeat: [3, 1] })

export const glowTexture = () =>
  canvasTex('shared:glow', 128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, w, w)
  }, { mips: false })

export const flameTexture = () =>
  canvasTex('shared:flame', 128, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h * 0.75, 2, w / 2, h * 0.62, h * 0.55)
    grd.addColorStop(0, 'rgba(255,240,200,1)')
    grd.addColorStop(0.2, 'rgba(255,170,60,0.95)')
    grd.addColorStop(0.5, 'rgba(220,70,20,0.55)')
    grd.addColorStop(1, 'rgba(120,20,0,0)')
    g.fillStyle = grd
    g.beginPath()
    g.moveTo(w * 0.5, 0)
    g.bezierCurveTo(w * 0.95, h * 0.45, w * 1.0, h * 0.95, w * 0.5, h)
    g.bezierCurveTo(0, h * 0.95, w * 0.05, h * 0.45, w * 0.5, 0)
    g.fill()
  }, { mips: false })

/** City skyline window grid for distant towers. */
export const towerTexture = (ns: string, seed: number) =>
  canvasTex(`${ns}:tower-${seed}`, 128, 512, (g, w, h) => {
    const r = rng(seed)
    g.fillStyle = '#07090c'
    g.fillRect(0, 0, w, h)
    for (let y = 6; y < h; y += 10) {
      for (let x = 4; x < w; x += 9) {
        if (r() < 0.22) {
          g.fillStyle = r() < 0.75 ? `rgba(255,${170 + r() * 60},${90 + r() * 60},${0.5 + r() * 0.5})` : 'rgba(160,200,230,0.7)'
          g.fillRect(x, y, 5, 5)
        }
      }
    }
  })
