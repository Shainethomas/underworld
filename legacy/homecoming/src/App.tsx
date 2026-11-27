import { useEffect, useMemo } from 'react'
import { audio } from './engine/audio'
import { grainDataUrl } from './engine/grain'
import { useGame } from './game/store'
import { SceneManager } from './scene/SceneManager'
import { TitleScreen } from './ui/TitleScreen'

export function App() {
  const screen = useGame((s) => s.screen)
  const fading = useGame((s) => s.fading)
  const sound = useGame((s) => s.settings.sound)
  const grain = useMemo(() => `url(${grainDataUrl()})`, [])

  useEffect(() => audio.setEnabled(sound), [sound])

  return (
    <div className="app">
      <div className="app__backdrop" />
      <main className="viewport">
        {screen === 'title' ? <TitleScreen /> : <SceneManager />}
        <div className={`fade ${fading ? 'fade--on' : ''}`} />
        <div className="grain" style={{ backgroundImage: grain }} />
      </main>
    </div>
  )
}
