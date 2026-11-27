import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initNative } from './platform/native'
import { useGame } from './store/gameStore'
import { loadScene } from './game/engine/SceneManager'
import './app/styles.css'
// noir.css is the game's look; comic.css (the earlier Graphic Novel theme) styles the same markup
import './app/noir.css'

// No StrictMode: the 3D engine is an imperative singleton attached to one
// canvas, and dev-mode double mounting would create and tear down GPU contexts.
createRoot(document.getElementById('root')!).render(<App />)
void initNative()

// Test builds (?test): the store and the scene loader from the title screen on,
// before the 3D engine exists (scripts/playthrough.mjs starts contracts this way).
if (import.meta.env.DEV || location.search.includes('test')) {
  ;(window as unknown as Record<string, unknown>).__underworldBoot = { store: useGame, loadScene }
}
