import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error plain ESM helper shared with the scripts in scripts/
import { compileInk } from './scripts/lib/ink-compile.mjs'

/** `import story from './scene01.ink'`: compiles Ink (and its INCLUDEs) to the JSON inkjs runs. */
function ink(): Plugin {
  return {
    name: 'underworld-ink',
    transform(_code, id) {
      if (!id.endsWith('.ink')) return null
      const file = id.split('?')[0]
      const { json, warnings, includes } = compileInk(file) as { json: string; warnings: string[]; includes: string[] }
      for (const w of warnings) this.warn(w)
      // editing globals.ink rebuilds every scene that includes it
      for (const f of includes) this.addWatchFile(f)
      return { code: `export default ${json}`, map: null }
    },
  }
}

/**
 * The renderer (ARCHITECTURE.md, "3D rendering engine"): `@render/*` is
 * src/game/babylon, the only folder that imports Babylon.js.
 */

export default defineConfig({
  plugins: [react(), ink()],
  resolve: { alias: { '@render': fileURLToPath(new URL('./src/game/babylon', import.meta.url)) } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
})
