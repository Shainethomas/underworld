import { Color3, Matrix, Quaternion, Vector3 } from '@render/core'
import type { AbstractMesh, Material, Scene, TransformNode } from '@render/core'
import { SetBuilder } from '@render/SetBuilder'
import type { Actor } from '../characters/CharacterPresentation'
import type { ActorId, Prop } from '../narrative/types'

// Things a character holds: his gym bag, carried by the handles, his phone
// at his ear, and small things held in the right hand (a parcel, an envelope,
// a fold of cash) that change hands in Scene 02. They are placed in world space every frame from the hand
// and head bones (after the animations and head turns have run), so they work
// the same on every rig whatever its bone axes. A bag that is put down drops
// to the floor beside him and stays there until he picks it up again or the
// set changes.

const GRAVITY = 9.81
/** The bag's body hangs this far below the grip, and lies this high on the floor (its radius). */
const BAG_HANG = 0.22
const BAG_RADIUS = 0.13

interface Dropped {
  node: TransformNode
  from: Vector3
  to: Vector3
  t: number
  dur: number
  yaw: number
}

export class HandProps {
  private s: SetBuilder
  private held = new Map<ActorId, { kind: Prop; node: TransformNode }>()
  private dropped: Dropped[] = []
  private count = 0
  private forward = new Vector3()
  private right = new Vector3()
  private hand = new Vector3()
  private knuckle = new Vector3()
  private head = new Vector3()
  private up = new Vector3()
  private normal = new Vector3()
  private across = new Vector3()
  private rotation = Matrix.Identity()

  /** `adopt` hands new props to the current set (its shadows and light limits). */
  constructor(scene: Scene, private adopt: (meshes: AbstractMesh[], materials: Material[]) => void) {
    this.s = new SetBuilder(scene, 'hand_props')
  }

  /** A new set: let it light and shadow the props that came along. */
  adoptAll(): void {
    const meshes = [...this.held.values()].flatMap((h) => h.node.getChildMeshes())
    if (meshes.length) this.adopt(meshes, this.s.materials)
  }

  private build(kind: Prop): TransformNode {
    const s = this.s
    s.pruneDisposed()
    const n = s.node(`${kind}_${this.count++}`, [0, -50, 0])
    n.rotationQuaternion = Quaternion.Identity()
    if (kind === 'bag') {
      // a black holdall: the origin is the grip, the body hangs under it, its length along +Z
      const nylon = s.pbr('bag_nylon', '#141518', { rough: 0.78 })
      const trim = s.pbr('bag_trim', '#6e1218', { rough: 0.6 })
      const strap = s.pbr('bag_strap', '#0b0b0d', { rough: 0.6 })
      const body = s.cyl('bag_body', BAG_RADIUS * 2, 0.52, [0, -BAG_HANG, 0], nylon, { parent: n, tess: 20 })
      body.rotation.x = Math.PI / 2
      // dark ends with a thin red piping round each
      for (const z of [-0.26, 0.26]) {
        s.cyl(`bag_end_${z}`, BAG_RADIUS * 2 - 0.01, 0.02, [0, -BAG_HANG, z], strap, { parent: n, tess: 20 }).rotation.x = Math.PI / 2
        s.torus(`bag_piping_${z}`, BAG_RADIUS * 2, 0.012, [0, -BAG_HANG, z], trim, n).rotation.x = Math.PI / 2
      }
      s.box('bag_zip', [0.03, 0.012, 0.44], [0, -BAG_HANG + BAG_RADIUS + 0.002, 0], strap, n)
      // two webbing straps round the body, joined over the top into the grip
      for (const z of [-0.12, 0.12]) {
        s.box(`bag_band_${z}`, [BAG_RADIUS * 2 + 0.01, 0.012, 0.035], [0, -BAG_HANG + 0.02, z], strap, n)
        s.rod(`bag_handle_${z}`, [0, -BAG_HANG + BAG_RADIUS, z], [0, -0.02, z * 0.3], 0.012, strap, n)
      }
      s.box('bag_grip', [0.035, 0.035, 0.11], [0, -0.02, 0], strap, n)
    } else if (kind === 'package') {
      // a parcel in brown paper, taped and tied with twine: the origin is the
      // grip on its top edge, the body hangs below it, its length along +Z
      const paper = s.pbr('parcel_paper', '#7a5a3a', { rough: 0.85 })
      const tape = s.pbr('parcel_tape', '#b49a6a', { rough: 0.4 })
      const twine = s.pbr('parcel_twine', '#d8cdb4', { rough: 0.9 })
      s.box('parcel_body', [0.13, 0.2, 0.3], [0, -0.1, 0], paper, n)
      s.box('parcel_tape', [0.135, 0.205, 0.05], [0, -0.1, 0], tape, n)
      s.box('parcel_twine_a', [0.136, 0.206, 0.008], [0, -0.1, 0.08], twine, n)
      s.box('parcel_twine_b', [0.136, 0.008, 0.302], [0, -0.1, 0], twine, n)
    } else if (kind === 'envelope') {
      // a thick manila envelope, flap sealed: origin at the grip, along +Z
      const manila = s.pbr('envelope_manila', '#b8945e', { rough: 0.8 })
      const seal = s.pbr('envelope_seal', '#6e1218', { rough: 0.5 })
      s.box('envelope_body', [0.025, 0.17, 0.25], [0, -0.06, 0.02], manila, n)
      s.box('envelope_seal', [0.027, 0.035, 0.035], [0, -0.02, 0.05], seal, n)
    } else if (kind === 'cash') {
      // a fold of notes with a paper band
      const notes = s.pbr('cash_notes', '#5f6e52', { rough: 0.75 })
      const band = s.pbr('cash_band', '#d9d1bd', { rough: 0.7 })
      s.box('cash_notes', [0.03, 0.075, 0.16], [0, -0.03, 0.03], notes, n)
      s.box('cash_band', [0.034, 0.079, 0.035], [0, -0.03, 0.03], band, n)
    } else {
      // a phone, screen toward +Z (against his cheek), long side along +Y
      const shell = s.pbr('phone_shell', '#16171a', { rough: 0.35, metal: 0.5 })
      const screen = s.pbr('phone_glass', '#0a0d12', { rough: 0.08, emissive: new Color3(0.05, 0.08, 0.12) })
      s.box('phone_shell', [0.072, 0.152, 0.009], [0, 0, 0], shell, n)
      s.box('phone_glass', [0.066, 0.144, 0.002], [0, 0, 0.005], screen, n)
    }
    for (const m of n.getChildMeshes()) m.isPickable = false
    this.adopt(n.getChildMeshes(), this.s.materials)
    return n
  }

  /** Puts something in an actor's hand, or takes it away (`null`): a bag drops to the floor. */
  carry(actor: Actor, kind: Prop | null, instant: boolean): void {
    actor.setCarried(kind)
    const held = this.held.get(actor.id)
    if (held?.kind === kind) return
    if (held) {
      this.held.delete(actor.id)
      if (held.kind === 'bag') this.drop(actor, held.node, instant)
      else held.node.dispose()
    }
    if (!kind) return
    let node: TransformNode | null = null
    if (kind === 'bag') {
      // picking his bag back up (perhaps behind a cut): the one on this set's floor nearest him
      const near = this.dropped.map((d, i) => ({ i, d: Vector3.Distance(d.to, actor.position) })).sort((a, b) => a.d - b.d)[0]
      if (near) node = this.dropped.splice(near.i, 1)[0].node
    }
    this.held.set(actor.id, { kind, node: node ?? this.build(kind) })
    this.place(actor)
  }

  /** The bag leaves his hand and falls beside his right foot. */
  private drop(actor: Actor, node: TransformNode, instant: boolean): void {
    const f = actor.forward()
    const right = new Vector3(f.z, 0, -f.x)
    const to = actor.position.add(right.scale(0.36)).add(f.scale(0.12))
    to.y = actor.position.y + BAG_RADIUS + BAG_HANG
    const from = instant ? to.clone() : node.position.clone()
    const dur = Math.sqrt((2 * Math.max(0.05, from.y - to.y)) / GRAVITY)
    this.dropped.push({ node, from, to, t: instant ? dur : 0, dur, yaw: actor.yaw + 0.35 })
    if (instant) this.settle(this.dropped[this.dropped.length - 1], 1)
  }

  private settle(d: Dropped, k: number): void {
    // falls under gravity, and turns a little as it lands
    d.node.position.set(d.from.x + (d.to.x - d.from.x) * k, d.from.y + (d.to.y - d.from.y) * k * k, d.from.z + (d.to.z - d.from.z) * k)
    Quaternion.RotationYawPitchRollToRef(d.yaw - 0.35 * (1 - k), 0, 0, d.node.rotationQuaternion!)
  }

  /** Holds each prop where its owner's hand (and head) are this frame. */
  private place(actor: Actor): void {
    const h = this.held.get(actor.id)
    if (!h) return
    h.node.setEnabled(actor.visible)
    if (!actor.visible) return
    const f = this.forward.set(Math.sin(actor.yaw), 0, Math.cos(actor.yaw))
    const right = this.right.set(f.z, 0, -f.x)
    const hand = this.hand
    if (!actor.boneToRef('hand_r', hand)) hand.copyFromFloats(actor.position.x + right.x * .25, actor.position.y + .85, actor.position.z + right.z * .25)
    if (h.kind !== 'phone') {
      // The origin is the handle, not the wrist. Meet the center of the curled
      // palm; the baked carry clips provide arm/thigh clearance on Rookie.
      if (actor.boneToRef('middle_01_r', this.knuckle)) Vector3.LerpToRef(hand, this.knuckle, .7, hand)
      else hand.y -= .07
      h.node.position.copyFrom(hand)
      if (h.kind === 'bag') h.node.position.y += .02 // authored grip is 2cm below its origin
      else {
        const out = h.kind === 'package' ? .025 : .01
        h.node.position.x += right.x * out
        h.node.position.z += right.z * out
      }
      Quaternion.RotationYawPitchRollToRef(actor.yaw, 0, 0, h.node.rotationQuaternion!)
      return
    }
    // Calibrated in the head bone's rest frame once, so the phone follows
    // the ear through the clip's head tilt/turn instead of the body's yaw.
    if (!actor.phoneAttachmentToRef(h.node.position, this.normal, this.up)) {
      const head = this.head.copyFromFloats(actor.position.x, actor.position.y + 1.56, actor.position.z)
      h.node.position.set(head.x + right.x * .108 + f.x * .035, head.y + .017, head.z + right.z * .108 + f.z * .035)
      this.normal.copyFrom(right).scaleInPlace(-1)
      this.up.set(-f.x * .12, 1, -f.z * .12).normalize()
    }
    Vector3.CrossToRef(this.up, this.normal, this.across)
    this.across.normalize()
    Vector3.CrossToRef(this.normal, this.across, this.up)
    Matrix.FromXYZAxesToRef(this.across, this.up, this.normal, this.rotation)
    Quaternion.FromRotationMatrixToRef(this.rotation, h.node.rotationQuaternion!)
  }

  update(actors: Map<ActorId, Actor>, dt: number): void {
    for (const id of this.held.keys()) {
      const a = actors.get(id)
      if (a) this.place(a)
    }
    for (const d of this.dropped) {
      if (d.t >= d.dur) continue
      d.t = Math.min(d.dur, d.t + dt)
      this.settle(d, d.t / d.dur)
    }
  }

  /** A new set: whatever was left on the floor of the old one goes with it. */
  clearDropped(): void {
    for (const d of this.dropped) d.node.dispose()
    this.dropped = []
    this.s.pruneDisposed()
  }

  /** Everything, held or dropped (the cast is being rebuilt). */
  clear(): void {
    this.clearDropped()
    for (const h of this.held.values()) h.node.dispose()
    this.held.clear()
    this.s.pruneDisposed()
  }

  dispose(): void {
    this.clear()
    this.s.dispose()
  }
}
