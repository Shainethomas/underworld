// Removes the MP3 copy of every sound that also ships as WebM/Opus from the
// Android build. Android's WebView (Chromium) always plays the WebM, so the
// game never requests those MP3s (see AudioManager: one format per device);
// they only make the download bigger. iOS keeps both formats.
//
// Runs after `cap sync` (npm run mobile:sync), on the copy Capacitor made in
// the Android project; public/ and dist/ are untouched.

import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'android/app/src/main/assets/public/assets/audio'
if (!existsSync(DIR)) {
  console.log(`trim-android-audio: ${DIR} not found (run cap sync first); nothing to do`)
  process.exit(0)
}
let freed = 0
let count = 0
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.mp3') || !existsSync(join(DIR, f.replace(/\.mp3$/, '.webm')))) continue
  freed += statSync(join(DIR, f)).size
  unlinkSync(join(DIR, f))
  count++
}
console.log(`trim-android-audio: removed ${count} MP3s with a WebM twin (${(freed / 1048576).toFixed(1)} MB)`)
