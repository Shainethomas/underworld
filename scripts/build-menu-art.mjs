// The title screen's backdrop: the city at dusk behind the Underworld logo,
// drawn as flat, faceted shapes (no characters). Seeded, so it comes out the
// same every time; tweak the layout here and rerun.
//
//   node scripts/build-menu-art.mjs   → public/assets/ui/menu_city.svg

import { writeFileSync } from 'node:fs'

const W = 400
const H = 860
let seed = 7
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}
const f = (n) => Number(n.toFixed(1))
const out = []
const add = (s) => out.push(s)

/** A building: a lit front, a darker side for the faceted look, and window lights. */
function building({ x, w, top, base = 720, side = 10, front, sideFill, win = '#f2b45a', cols, rows, lit = 0.35, roof }) {
  add(`<polygon points="${x},${base} ${x},${top} ${x + w},${top} ${x + w},${base}" fill="${front}"/>`)
  if (side) add(`<polygon points="${x + w},${base} ${x + w},${top} ${x + w + side},${top + side * 0.6} ${x + w + side},${base}" fill="${sideFill}"/>`)
  if (roof) add(roof)
  if (!cols) return
  const padX = w * 0.12
  const cellW = (w - padX * 2) / cols
  const cellH = Math.min(22, (base - top - 30) / rows)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const on = rand() < lit
      const wx = x + padX + c * cellW + cellW * 0.2
      const wy = top + 18 + r * cellH
      if (wy > base - 14) continue
      add(`<rect x="${f(wx)}" y="${f(wy)}" width="${f(cellW * 0.6)}" height="${f(cellH * 0.55)}" fill="${on ? win : '#1a1520'}" opacity="${on ? f(0.55 + rand() * 0.45) : 0.7}"/>`)
    }
}

add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`)
add(`<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#121520"/>
    <stop offset="0.38" stop-color="#2a1f2e"/>
    <stop offset="0.62" stop-color="#5c2b2e"/>
    <stop offset="0.78" stop-color="#9a4a30"/>
    <stop offset="1" stop-color="#2a1a1c"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.55" cy="0.66" r="0.55">
    <stop offset="0" stop-color="#ffb066" stop-opacity="0.55"/>
    <stop offset="0.5" stop-color="#d0623a" stop-opacity="0.18"/>
    <stop offset="1" stop-color="#d0623a" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="street" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#131418" stop-opacity="0"/>
    <stop offset="0.35" stop-color="#131418" stop-opacity="0.75"/>
    <stop offset="1" stop-color="#131418"/>
  </linearGradient>
  <radialGradient id="sign" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ff4a58" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#ff4a58" stop-opacity="0"/>
  </radialGradient>
</defs>`)
add(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`)
add(`<rect width="${W}" height="${H}" fill="url(#glow)"/>`)

// clouds: soft plum banks with a warm underside
for (const [cx, cy, s] of [[70, 120, 1.1], [330, 90, 0.9], [250, 230, 1.3], [40, 300, 0.8], [360, 330, 1]]) {
  for (let i = 0; i < 5; i++) {
    const dx = (i - 2) * 22 * s
    const r = (18 + rand() * 16) * s
    add(`<ellipse cx="${f(cx + dx)}" cy="${f(cy - Math.abs(dx) * 0.15)}" rx="${f(r * 1.5)}" ry="${f(r)}" fill="#3b2a3a" opacity="0.55"/>`)
  }
  add(`<ellipse cx="${cx}" cy="${f(cy + 12 * s)}" rx="${f(70 * s)}" ry="${f(8 * s)}" fill="#a2523c" opacity="0.25"/>`)
}

// far towers, centre and right, as in a downtown seen across the river
const far = '#2c2333'
const farSide = '#221b29'
building({ x: 150, w: 46, top: 330, front: far, sideFill: farSide, side: 8, cols: 3, rows: 14, lit: 0.22, roof: `<polygon points="173,330 168,300 178,300" fill="${far}"/><rect x="172" y="250" width="2" height="52" fill="${far}"/>` })
building({ x: 205, w: 58, top: 280, front: '#30263a', sideFill: farSide, side: 10, cols: 4, rows: 18, lit: 0.26, roof: `<polygon points="205,280 234,236 263,280" fill="#30263a"/><rect x="233" y="190" width="2.5" height="48" fill="#30263a"/>` })
building({ x: 272, w: 40, top: 360, front: far, sideFill: farSide, side: 7, cols: 3, rows: 12, lit: 0.2 })
building({ x: 112, w: 34, top: 410, front: far, sideFill: farSide, side: 6, cols: 2, rows: 10, lit: 0.18 })
building({ x: 320, w: 50, top: 300, front: '#2e2536', sideFill: farSide, side: 9, cols: 3, rows: 16, lit: 0.22 })

// left: a brick walk-up with a water tower on the roof
building({ x: -10, w: 130, top: 470, base: 760, side: 14, front: '#5a2f2b', sideFill: '#40221f', win: '#ffc26a', cols: 4, rows: 9, lit: 0.45 })
add(`<rect x="-10" y="462" width="144" height="10" fill="#3a1f1d"/>`)
// the water tower: legs, tank, conical roof
for (const lx of [28, 44, 60, 76]) add(`<rect x="${lx}" y="400" width="3" height="64" fill="#2a1a1d"/>`)
add(`<rect x="26" y="420" width="54" height="3" fill="#2a1a1d"/><rect x="26" y="442" width="54" height="3" fill="#2a1a1d"/>`)
add(`<polygon points="22,402 22,352 86,352 86,402" fill="#4a2c27"/><polygon points="54,352 54,402 86,402 86,352" fill="#3c231f"/>`)
for (const hy of [364, 378, 392]) add(`<rect x="22" y="${hy}" width="64" height="2" fill="#2e1b19"/>`)
add(`<polygon points="18,354 54,318 90,354" fill="#3a221e"/><polygon points="54,318 90,354 54,354" fill="#2e1b18"/>`)

// right: a corner block with a crown sign on the roof (the organisation's crest)
building({ x: 262, w: 150, top: 440, base: 770, side: 0, front: '#4b2a2c', sideFill: '#3a2022', win: '#ffc26a', cols: 5, rows: 10, lit: 0.4 })
add(`<rect x="256" y="432" width="160" height="10" fill="#331b1d"/>`)
add(`<rect x="288" y="352" width="96" height="70" fill="#1d1418" stroke="#5a2a2e" stroke-width="3"/>`)
add(`<rect x="292" y="420" width="4" height="14" fill="#1d1418"/><rect x="376" y="420" width="4" height="14" fill="#1d1418"/>`)
add(`<ellipse cx="336" cy="386" rx="70" ry="50" fill="url(#sign)"/>`)
add(`<path d="M312 402 L308 368 L322 382 L336 362 L350 382 L364 368 L360 402 Z" fill="#e1263a" stroke="#ff7a84" stroke-width="1.5" stroke-linejoin="round"/>`)
add(`<rect x="310" y="404" width="52" height="5" fill="#e1263a"/>`)

// centre: the low street front between them, and the haze over the street
building({ x: 118, w: 150, top: 610, base: 790, side: 0, front: '#3a2228', sideFill: '#2e1b20', win: '#ffcf7a', cols: 6, rows: 4, lit: 0.5 })
add(`<rect x="0" y="600" width="${W}" height="${H - 600}" fill="url(#street)"/>`)
add(`</svg>`)

writeFileSync(new URL('../public/assets/ui/menu_city.svg', import.meta.url), out.join('\n') + '\n')
console.log(`menu_city.svg: ${out.length} shapes`)
