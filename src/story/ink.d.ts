// Ink stories are compiled at build time (vite.config.ts) to the JSON inkjs runs.
declare module '*.ink' {
  const story: Record<string, unknown>
  export default story
}
