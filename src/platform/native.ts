import { Capacitor, registerPlugin } from '@capacitor/core'

// Native-app behaviour when the game runs inside the Capacitor shell (Android,
// iOS); nothing here runs in a browser. Portrait only, full screen, and the
// screen stays on while a scene plays. The plugins are imported on demand so
// the web build doesn't load them.

export const isNative = Capacitor.isNativePlatform()

export async function initNative(): Promise<void> {
  if (!isNative) return
  document.documentElement.classList.add('is-native')
  const [{ ScreenOrientation }, { StatusBar }] = await Promise.all([import('@capacitor/screen-orientation'), import('@capacitor/status-bar')])
  await Promise.allSettled([ScreenOrientation.lock({ orientation: 'portrait' }), StatusBar.hide()])
}

/** Keeps the screen awake while a scene is on screen (a cutscene shouldn't let the phone dim). */
export async function keepAwake(on: boolean): Promise<void> {
  if (!isNative) return
  const { KeepAwake } = await import('@capacitor-community/keep-awake')
  await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => undefined)
}

/** The app's own plugin (android/…/DisplayPlugin.java). */
const Display = registerPlugin<{ refreshRate(): Promise<{ hz: number }> }>('Display')

/**
 * The screen's refresh rate from the system (Android), or null where the
 * game has to measure it from frame timing (browsers, iOS).
 */
export async function displayRefreshRate(): Promise<number | null> {
  if (Capacitor.getPlatform() !== 'android') return null
  try {
    const { hz } = await Display.refreshRate()
    return hz > 0 ? hz : null
  } catch {
    return null
  }
}
