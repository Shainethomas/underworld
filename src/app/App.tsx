import { lazy, Suspense, useEffect } from 'react'
import { keepAwake } from '../platform/native'
import { LoadingScreen } from '../components/menus/LoadingScreen'
import { MainMenu } from '../components/menus/MainMenu'
import { useGame } from '../store/gameStore'

// The game screen pulls in the 3D renderer; keep it out of the menu's first load.
const GameScreen = lazy(() => import('./GameScreen'))

export function App() {
  const screen = useGame((s) => s.screen)
  useEffect(() => void keepAwake(screen === 'game'), [screen])
  return (
    <div className="app">
      <main className="viewport">
        {screen === 'menu' ? (
          <MainMenu />
        ) : (
          <Suspense fallback={<LoadingScreen label="Starting the engine" progress={0} />}>
            <GameScreen />
          </Suspense>
        )}
      </main>
      <div className="rotate-hint">
        <span className="rotate-hint__phone" />
        Turn your phone upright to play
      </div>
    </div>
  )
}
