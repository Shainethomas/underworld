import { useEffect, useState } from 'react'
import { audio } from '../engine/audio'
import { detectGpu, type GpuCaps } from '../engine/quality'
import { CHAPTER, useGame } from '../game/store'
import type { Quality } from '../game/persistence'
import { Icon } from './Icon'

export function Settings() {
  const open = useGame((s) => s.settingsOpen)
  const settings = useGame((s) => s.settings)
  const completed = useGame((s) => s.completedScenes)
  const sceneId = useGame((s) => s.sceneId)
  const [gpu, setGpu] = useState<GpuCaps | null>(null)
  const g = useGame.getState()

  useEffect(() => {
    if (open && !gpu) void detectGpu().then(setGpu)
  }, [open, gpu])

  const reached = (id: string) => completed.includes(id) || id === sceneId
  const seg = <T extends string>(value: T, options: [T, string][], set: (v: T) => void) => (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} className={`seg__opt ${value === v ? 'seg__opt--on' : ''}`} onClick={() => (audio.play('tick'), set(v))}>
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div className={`sheet ${open ? 'sheet--open' : ''}`} onClick={() => g.setSettingsOpen(false)}>
      <div className="sheet__panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2>SETTINGS</h2>
          <button className="sheet__close" onClick={() => g.setSettingsOpen(false)} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="sheet__row">
          <span>Sound</span>
          {seg(settings.sound ? 'on' : 'off', [['on', 'On'], ['off', 'Off']], (v) => {
            g.updateSettings({ sound: v === 'on' })
            if (v === 'on') audio.unlock()
          })}
        </div>
        <div className="sheet__row">
          <span>Graphics</span>
          {seg<Quality>(settings.quality, [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Med'], ['high', 'High']], (v) => g.updateSettings({ quality: v }))}
        </div>
        <div className="sheet__row">
          <span>Text speed</span>
          {seg(settings.textSpeed, [['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']], (v) => g.updateSettings({ textSpeed: v }))}
        </div>
        <div className="sheet__row">
          <span>Auto-advance</span>
          {seg(settings.autoAdvance ? 'on' : 'off', [['on', 'On'], ['off', 'Off']], (v) => g.updateSettings({ autoAdvance: v === 'on' }))}
        </div>

        <h3 className="sheet__sub">REPLAY SCENE</h3>
        <div className="sheet__scenes">
          {CHAPTER.scenes.map((s) => (
            <button key={s.id} className="scene-pill" disabled={!reached(s.id)} onClick={() => g.replayScene(s.id)}>
              <span className="scene-pill__num">{String(s.index).padStart(2, '0')}</span>
              <span className="scene-pill__title">{reached(s.id) ? s.title : 'Locked'}</span>
            </button>
          ))}
        </div>

        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={() => g.replayScene('s01_return')}>
            <Icon name="replay" /> Restart
          </button>
          <button className="btn btn--ghost" onClick={() => g.goTitle()}>
            Main menu
          </button>
        </div>
        <p className="sheet__meta">
          Renderer: {gpu ? `${gpu.webgl2 ? 'WebGL 2' : 'WebGL unavailable'} · WebGPU ${gpu.webgpu ? 'available' : 'not available'}` : 'detecting…'}
        </p>
      </div>
    </div>
  )
}
