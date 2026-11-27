// Compiles an .ink file (following INCLUDEs) to the JSON inkjs runs.
// Used by the Vite plugin (vite.config.ts) and by the checks in scripts/.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Compiler, CompilerOptions } from 'inkjs/full'

export function compileInk(file) {
  const dir = dirname(file)
  const includes = []
  const handler = {
    ResolveInkFilename: (name) => {
      const path = resolve(dir, name)
      includes.push(path)
      return path
    },
    LoadInkFileContents: (path) => readFileSync(path, 'utf8'),
  }
  const errors = []
  const options = new CompilerOptions(file, [], false, (message, type) => errors.push({ message, type }), handler)
  let story = null
  try {
    story = new Compiler(readFileSync(file, 'utf8'), options).Compile()
  } catch {
    // the compiler throws once it has reported its errors to the handler
  }
  // ErrorType: 0 author note, 1 warning, 2 error
  if (!story || errors.some((e) => e.type === 2)) throw new Error(`Ink: ${file}\n` + errors.filter((e) => e.type === 2).map((e) => e.message).join('\n'))
  return { json: story.ToJson(), warnings: errors.filter((e) => e.type === 1).map((e) => e.message), includes }
}
