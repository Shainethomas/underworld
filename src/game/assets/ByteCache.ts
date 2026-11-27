// Raw file bytes, fetched ahead of need and held in memory until a loader
// takes them. This is the "streaming" half of loading: downloads happen early
// (on the title screen, behind the current set, during the last beats of a
// scene) and the expensive half (parsing, decoding, GPU upload) happens later,
// behind a loading screen or a fade. No Babylon here, so the menu can warm
// files without pulling in the 3D engine.

interface Entry {
  promise: Promise<ArrayBuffer>
  /** Set once the download has finished. */
  buf?: ArrayBuffer
  loaded: number
  total: number
  listeners: Set<(loaded: number, total: number) => void>
}

const entries = new Map<string, Entry>()
/** Files a loader has taken and turned into resident resources: prefetching them again would be wasted. */
const taken = new Set<string>()

/** Downloads (or joins the download of) one file, reporting bytes as they arrive. */
export function fetchBytes(url: string, onProgress?: (loaded: number, total: number) => void, priority: RequestPriority = 'high'): Promise<ArrayBuffer> {
  let e = entries.get(url)
  if (!e) {
    const entry: Entry = { promise: null!, loaded: 0, total: 0, listeners: new Set() }
    entry.promise = download(url, entry, priority)
    entry.promise.then((b) => (entry.buf = b)).catch(() => entries.delete(url))
    entries.set(url, entry)
    e = entry
  }
  if (onProgress) {
    const listener = onProgress
    e.listeners.add(listener)
    if (e.total) listener(e.loaded, e.total)
    const entry = e
    void e.promise.finally(() => entry.listeners.delete(listener)).catch(() => {})
  }
  return e.promise
}

async function download(url: string, e: Entry, priority: RequestPriority): Promise<ArrayBuffer> {
  const res = await fetch(url, { priority })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  e.total = Number(res.headers.get('content-length')) || 0
  if (!res.body || !e.total) {
    const buf = await res.arrayBuffer()
    e.loaded = e.total = buf.byteLength
    for (const l of e.listeners) l(e.loaded, e.total)
    return buf
  }
  const out = new Uint8Array(e.total)
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    // a server that compresses on the fly reports the compressed length
    if (e.loaded + value.byteLength > out.byteLength) return concat(out.subarray(0, e.loaded), value, reader)
    out.set(value, e.loaded)
    e.loaded += value.byteLength
    for (const l of e.listeners) l(e.loaded, e.total)
  }
  return out.buffer.slice(0, e.loaded)
}

async function concat(head: Uint8Array, next: Uint8Array, reader: ReadableStreamDefaultReader<Uint8Array>): Promise<ArrayBuffer> {
  const parts = [head.slice(), next]
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
  }
  return new Blob(parts as BlobPart[]).arrayBuffer()
}

/**
 * Hands the bytes to a loader and forgets them: once parsed they live on the
 * GPU or in a decoded buffer, so keeping a second copy would only cost memory.
 */
export async function takeBytes(url: string, onProgress?: (loaded: number, total: number) => void, priority: RequestPriority = 'high'): Promise<ArrayBuffer> {
  const buf = await fetchBytes(url, onProgress, priority)
  entries.delete(url)
  taken.add(url)
  return buf
}

/** Downloads in the background, a few at a time, at low network priority. */
export async function prefetchBytes(urls: string[], concurrency = 2): Promise<void> {
  const queue = urls.filter((u) => !entries.has(u) && !taken.has(u))
  const worker = async () => {
    // checked again per file: a loader may have taken it while this queue waited
    for (let u = queue.shift(); u; u = queue.shift()) if (!taken.has(u)) await fetchBytes(u, undefined, 'low').catch(() => {})
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
}

export function hasBytes(url: string): boolean {
  return entries.has(url)
}

/** Takes a file synchronously if it has finished downloading. */
export function takeReadyBytes(url: string): ArrayBuffer | null {
  const buf = entries.get(url)?.buf
  if (buf) entries.delete(url)
  if (buf) taken.add(url)
  return buf ?? null
}

/** A taken file's resources were freed: a later prefetch may fetch it again. */
export function forgetTaken(url: string): void {
  taken.delete(url)
}

/** Drops downloaded files nobody took (the player left before they were needed). */
export function dropBytes(keep: (url: string) => boolean = () => false): void {
  for (const url of [...entries.keys()]) if (!keep(url)) entries.delete(url)
}
