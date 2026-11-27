// Compress the CC0 source maps for local, offline runtime delivery.
import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
const source = 'art-source/environment-originals'
const dest = 'public/assets/textures/environment'
await mkdir(dest, { recursive: true })
for (const material of ['brick', 'concrete', 'paving', 'leather']) {
  for (const map of ['albedo', 'normal', 'arm']) {
    await sharp(`${source}/${material}_${map}.jpg`).resize(1024, 1024).webp({ quality: map === 'albedo' ? 88 : 94 }).toFile(`${dest}/${material}_${map}.webp`)
  }
}
const alpha = await sharp(`${source}/twig_alpha.png`).extract({left:0,top:0,width:220,height:460}).resize(256,512).greyscale().raw().toBuffer()
await sharp(`${source}/twig_diff.png`).extract({left:0,top:0,width:220,height:460}).resize(256,512).removeAlpha().joinChannel(alpha, {raw:{width:256,height:512,channels:1}}).webp({quality:88,alphaQuality:100}).toFile(`${dest}/foliage.webp`)
const sources=JSON.parse(await readFile(`${source}/sources.json`,'utf8'))
await writeFile(`${dest}/LICENSE.txt`, `CC0 1.0 — Poly Haven assets\nhttps://polyhaven.com/license\nhttps://creativecommons.org/publicdomain/zero/1.0/\n\n${Object.values(sources).map(s=>s.source).join('\n')}\n\nMaps resized and encoded as WebP; foliage alpha packed into albedo.\n`)
