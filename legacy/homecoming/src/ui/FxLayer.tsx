import { useEffect, useRef, useState } from 'react'
import { audio } from '../engine/audio'
import { useGame } from '../game/store'
import type { FxName } from '../narrative/types'
import { shake } from '../three/runtime'

/** Screen-space FX + sound for stage cues: impact flashes, lightning, camera shake. */
export function FxLayer() {
  const [flash, setFlash] = useState<{ kind: string; id: number } | null>(null)
  const seen = useRef(new Set<number>())

  useEffect(() => {
    for (const f of useGame.getState().stage.fx) seen.current.add(f.id)
    const timers: ReturnType<typeof setTimeout>[] = []
    const fire = (name: FxName, id: number) => {
      switch (name) {
        case 'impact':
          audio.play('impact')
          shake.amount = Math.max(shake.amount, 0.9)
          setFlash({ kind: 'impact', id })
          break
        case 'clang':
          audio.play('clang')
          shake.amount = Math.max(shake.amount, 1.2)
          break
        case 'shake':
          shake.amount = Math.max(shake.amount, 0.55)
          break
        case 'thunder':
          setFlash({ kind: 'lightning', id })
          setTimeout(() => audio.play('thunder'), 450)
          break
        case 'flash':
          setFlash({ kind: 'white', id })
          break
        case 'heartbeat':
          audio.play('heartbeat')
          setFlash({ kind: 'pulse', id })
          break
        case 'rev':
          audio.play('rev')
          break
        case 'bikesPass':
          break
      }
    }
    const unsub = useGame.subscribe((s) => {
      for (const f of s.stage.fx) {
        if (seen.current.has(f.id)) continue
        seen.current.add(f.id)
        timers.push(setTimeout(() => fire(f.name, f.id), f.delay * 1000))
      }
    })
    return () => {
      unsub()
      timers.forEach(clearTimeout)
    }
  }, [])

  return flash ? <div key={flash.id} className={`flash flash--${flash.kind}`} /> : null
}
