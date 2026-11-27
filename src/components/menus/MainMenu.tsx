import { useEffect, useState } from 'react'
import { prefetchBytes } from '../../game/assets/ByteCache'
import { envAssets, sceneManifest } from '../../game/assets/manifest'
import { setAssetTier } from '../../game/assets/urls'
import { resolveTier } from '../../platform/deviceTier'
import { takeRecovery } from '../../platform/recovery'
import { audio } from '../../game/audio/AudioManager'
import { isPlayable, loadScene, SCENE_ORDER, sceneNumber } from '../../game/engine/SceneManager'
import { hasResumableSave, latestScene, useGame } from '../../store/gameStore'
import { Icon } from '../common/Icon'
import { MenuLogo } from './MenuLogo'
import { SettingsSheet } from './SettingsSheet'
import { StandingSheet } from './StandingSheet'
import { BoardSheet } from './BoardSheet'
import { CONTRACTS, isContract } from '../../game/board/contracts'

/**
 * Title screen: the key art (Rookie, Victor, Lucas and two of Victor's men
 * on a rooftop over the city at night, public/assets/ui/menu_bg.webp), the
 * brush-stroke logo over its sky, and at the foot a bar
 * that fills while the first scene's files are fetched, then New Game and
 * Continue. Its first tap also unlocks audio on mobile browsers.
 */
export function MainMenu() {
  const startScene = useGame((s) => s.startScene)
  const resetProgress = useGame((s) => s.resetProgress)
  const progress = useGame((s) => s.progress)
  const [busy, setBusy] = useState(false)
  const [settings, setSettings] = useState(false)
  const [standing, setStanding] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const board = useGame((s) => s.board)
  const openBoard = useGame((s) => s.openBoard)
  const [confirmNew, setConfirmNew] = useState(false)
  // how much of what Play needs is already here (0–1), for the bar
  const [warm, setWarm] = useState(0)
  const current = progress.sceneId
  const resumable = hasResumableSave(current)
  const latest = latestScene(isPlayable)
  const scenes = SCENE_ORDER.filter((id) => progress.unlocked.includes(id))
  const started = resumable || progress.completed.length > 0
  const next = resumable ? current : started ? latest : 's01'
  // Lucas's board opens once the first scene is done
  const boardOn = progress.completed.includes('s01')
  useEffect(() => {
    if (boardOn) openBoard()
  }, [boardOn, openBoard])
  const boardLeft = board.offer.filter((id) => !board.done[id]).length
  const label = (id: string) => (isContract(id) ? `Street work: ${CONTRACTS[id]?.title ?? ''}` : `Scene ${sceneNumber(id)}`)

  // While the title is up, fetch what Play will need: the 3D engine's code,
  // the scene's story, and the files for its cast and opening set (downloaded
  // only; they are decoded behind the loading screen).
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    let cancelled = false
    const step = (k: number) => !cancelled && setWarm((w) => Math.max(w, k))
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 300))
    idle(async () => {
      step(0.15)
      await import('../../app/GameScreen').catch(() => null)
      step(0.45)
      if (!isPlayable(next)) return step(1)
      const scene = await loadScene(next).catch(() => null)
      step(0.6)
      if (!scene || cancelled || saveData) return step(1)
      // warm the files this device will load (phones get phone-sized variants)
      setAssetTier(resolveTier(useGame.getState().settings.quality))
      const m = sceneManifest(scene)
      await prefetchBytes([...m.cast, ...envAssets(scene.environments[0])]).catch(() => null)
      step(1)
    })
    return () => void (cancelled = true)
  }, [next])

  const play = async (id: string, fresh: boolean) => {
    if (busy) return
    setBusy(true)
    audio.play('ui_choice')
    try {
      startScene(await loadScene(id), fresh)
    } finally {
      setBusy(false)
    }
  }

  /** From the very start: Scene 01, with no rank, money or choices. */
  const newGame = () => {
    setConfirmNew(false)
    resetProgress()
    void play('s01', true)
  }

  // Back from a crash (the phone took the renderer away mid-scene and the page
  // reloaded): straight back into the scene, at the beat it was on.
  useEffect(() => {
    const id = takeRecovery()
    if (id && isPlayable(id) && hasResumableSave(id)) void play(id, false)
    // once, on the first title screen of this page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="menu menu--city">
      {/* the key art: the cast on a rooftop over the city at night (art-source/menu_keyart.png) */}
      <div className="menu__city" aria-hidden="true" />
      <header className="menu__brand">
        <MenuLogo />
        <p className="menu__tag">
          <span>Chapter 1</span> A Place at the Table
        </p>
      </header>

      <div className="menu__foot-panel">
        <div className="menu__ready" role="status">
          <span className="menu__bar">
            <span style={{ transform: `scaleX(${warm})` }} />
          </span>
          <p>{warm >= 1 ? 'Ready.' : 'Getting the city ready…'}</p>
        </div>
        <button className="menu-btn menu-btn--new" onClick={() => (started ? setConfirmNew(true) : newGame())} disabled={busy}>
          New Game
        </button>
        <button className="menu-btn menu-btn--continue" onClick={() => play(next, !resumable)} disabled={busy || !started}>
          Continue
          {started && <small>{resumable ? `${label(current)}, where you left off` : label(latest)}</small>}
        </button>
        {boardOn && (
          <button className="menu-btn menu-btn--board" onClick={() => setBoardOpen(true)} disabled={busy}>
            <span>
              Tonight's Work
              {(board.inbox.length > 0 || boardLeft > 0) && <span className="menu-btn__badge">{board.inbox.length || boardLeft}</span>}
            </span>
            <small>{board.inbox.length ? 'Messages came in overnight' : boardLeft ? `${boardLeft} street jobs on Lucas's board` : 'Done for tonight. New jobs at midnight'}</small>
          </button>
        )}
        {scenes.length > 1 && (
          <div className="menu__scenes" role="group" aria-label="Replay a scene">
            {scenes.map((id) => (
              <button key={id} className="menu__scene" onClick={() => play(id, true)} disabled={busy || !isPlayable(id)}>
                {!isPlayable(id) && <Icon name="lock" size={13} />}
                Scene {sceneNumber(id)}
              </button>
            ))}
          </div>
        )}
        <div className="menu__links">
          {progress.completed.length > 0 && (
            <button className="btn btn--text" onClick={() => setStanding(true)}>
              <Icon name="fist" size={16} /> Standing
            </button>
          )}
          <button className="btn btn--text" onClick={() => setSettings(true)}>
            <Icon name="settings" size={16} /> Settings
          </button>
        </div>
        <p className="menu__hint">Every line is your call: tap a choice, or press 1, 2 or 3. Space or Enter moves the story on. Esc pauses.</p>
      </div>

      {settings && <SettingsSheet onClose={() => setSettings(false)} inGame={false} />}
      {standing && <StandingSheet onClose={() => setStanding(false)} />}
      {boardOpen && <BoardSheet onClose={() => setBoardOpen(false)} />}
      {confirmNew && (
        <div className="sheet-backdrop" onClick={() => setConfirmNew(false)}>
          <div className="sheet sheet--center" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Start a new game">
            <h2>Start over?</h2>
            <p className="sheet__note">A new game starts at Scene 01. Your rank, money, gear and every choice so far are wiped.</p>
            <button className="btn btn--gold btn--wide" onClick={newGame}>
              Start a new game
            </button>
            <button className="btn btn--text btn--wide" onClick={() => setConfirmNew(false)}>
              Keep my game
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
