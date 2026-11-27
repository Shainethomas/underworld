import { Vector3 } from '@render/core'
import type { Obstacle } from '../sets/types'

const PAD = 0.38

function inflate(o: Obstacle): Obstacle {
  return [o[0] - PAD, o[1] - PAD, o[2] + PAD, o[3] + PAD]
}

function inside(x: number, z: number, o: Obstacle): boolean {
  return x > o[0] && x < o[2] && z > o[1] && z < o[3]
}

/** Segment vs. rectangle (Liang–Barsky). */
function crosses(a: Vector3, b: Vector3, o: Obstacle): boolean {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dz = b.z - a.z
  const checks: [number, number][] = [
    [-dx, a.x - o[0]],
    [dx, o[2] - a.x],
    [-dz, a.z - o[1]],
    [dz, o[3] - a.z],
  ]
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false
    } else {
      const r = q / p
      if (p < 0) t0 = Math.max(t0, r)
      else t1 = Math.min(t1, r)
      if (t0 > t1) return false
    }
  }
  return t1 > 1e-4 && t0 < 1 - 1e-4
}

/** Moves a point out of any obstacle it falls inside. */
export function clearPoint(x: number, z: number, obstacles: Obstacle[]): [number, number] {
  for (const raw of obstacles) {
    const o = inflate(raw)
    if (!inside(x, z, o)) continue
    const opts: [number, number, number][] = [
      [o[0] - 0.01, z, x - o[0]],
      [o[2] + 0.01, z, o[2] - x],
      [x, o[1] - 0.01, z - o[1]],
      [x, o[3] + 0.01, o[3] - z],
    ]
    opts.sort((p, q) => p[2] - q[2])
    ;[x, z] = opts[0]
  }
  return [x, z]
}

/** How far a point is from a rectangle (0 inside it). */
function gap(p: Vector3, o: Obstacle): number {
  const dx = Math.max(o[0] - p.x, 0, p.x - o[2])
  const dz = Math.max(o[1] - p.z, 0, p.z - o[3])
  return Math.hypot(dx, dz)
}

function grow(o: Obstacle, pad: number): Obstacle {
  return [o[0] - pad, o[1] - pad, o[2] + pad, o[3] + pad]
}

/**
 * The rectangles a walk from `from` to `to` steers around. Walking into or
 * out of an obstacle's footprint (a chair, the ring) is deliberate, so one
 * the walk starts or ends inside is left out. One it starts or ends beside
 * (looking at the fountain from its rim) stays, with only as much of the
 * usual clearance as fits around that end, so the walk away goes round it
 * rather than through it.
 */
function blockers(from: Vector3, to: Vector3, all: Obstacle[]): Obstacle[] {
  const out: Obstacle[] = []
  for (const o of all) {
    if (inside(from.x, from.z, o) || inside(to.x, to.z, o)) continue
    const room = Math.min(PAD, gap(from, o) - 0.02, gap(to, o) - 0.02)
    out.push(grow(o, Math.max(0, room)))
  }
  return out
}

/**
 * Waypoints from `from` to `to` around rectangular obstacles: the shortest
 * route through the corners of every obstacle in the way (a visibility graph,
 * searched with Dijkstra), so a walk threads between several obstacles rather
 * than giving up and cutting through one. Straight to `to` only when nothing
 * blocks it, or when no route exists at all.
 */
export function planPath(from: Vector3, to: Vector3, all: Obstacle[]): Vector3[] {
  const rects = blockers(from, to, all)
  const clear = (a: Vector3, b: Vector3) => !rects.some((o) => crosses(a, b, o))
  if (clear(from, to)) return [to]
  // every obstacle's corners, just outside it, that aren't inside another one
  const nodes: Vector3[] = [from, to]
  for (const o of rects)
    for (const [x, z] of [
      [o[0] - 0.05, o[1] - 0.05],
      [o[2] + 0.05, o[1] - 0.05],
      [o[2] + 0.05, o[3] + 0.05],
      [o[0] - 0.05, o[3] + 0.05],
    ])
      if (!rects.some((r) => inside(x, z, r))) nodes.push(new Vector3(x, 0, z))
  const dist = nodes.map(() => Infinity)
  const prev = nodes.map(() => -1)
  const done = nodes.map(() => false)
  dist[0] = 0
  for (;;) {
    let u = -1
    for (let i = 0; i < nodes.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i
    if (u < 0 || dist[u] === Infinity) break
    if (u === 1) break
    done[u] = true
    for (let v = 0; v < nodes.length; v++) {
      if (done[v] || v === u) continue
      const d = dist[u] + Vector3.Distance(nodes[u], nodes[v])
      if (d < dist[v] && clear(nodes[u], nodes[v])) {
        dist[v] = d
        prev[v] = u
      }
    }
  }
  if (dist[1] === Infinity) return [to]
  const route: Vector3[] = []
  for (let i = 1; i > 0; i = prev[i]) route.unshift(nodes[i])
  return route
}
