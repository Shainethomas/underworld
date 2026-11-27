// Lets plain `node` import the game's TypeScript data files, whose imports
// leave off the `.ts` extension (Vite style):  node --import ./scripts/lib/ts-resolve.mjs …
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try {
    return await next(spec, ctx)
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && (spec.startsWith('.') || spec.startsWith('/')) && !/\\.[cm]?[jt]sx?$/.test(spec)) return next(spec + '.ts', ctx)
    throw err
  }
}
// Vite's import.meta.glob has no meaning in plain node: tests that reach a
// module using it (the contract list, via the store) see an empty set.
export async function load(url, ctx, next) {
  const out = await next(url, ctx)
  if (!url.endsWith('.ts') || !out.source) return out
  const src = String(out.source)
  if (!src.includes('import.meta.glob')) return out
  return { ...out, source: src.replace(/import\\.meta\\.glob(<[^>]*>)?\\(/g, '((..._a) => ({}))(') }
}`),
  import.meta.url,
)
