#!/usr/bin/env bash
# Placeholder pre-rendered cinematics, generated from the concept art until
# Blender renders exist. Output: 720x1280 H.264, faststart, no audio.
set -euo pipefail
cd "$(dirname "$0")/.."
IMG=public/assets/images
OUT=public/assets/video
mkdir -p "$OUT"

# S01 — establishing shot: slow push-in down the avenue toward the tower,
# cold teal grade, film grain, subtle exposure flicker.
ffmpeg -y -loglevel error -loop 1 -i "$IMG/city.jpg" -t 9 -filter_complex "\
[0:v]scale=4320:7680,zoompan=z='1.0+0.38*(1-pow(1-on/270,2))':x='iw/2-(iw/zoom/2)':y='ih*0.43-(ih/zoom*0.43)':d=270:s=720x1280:fps=30,\
colorbalance=rs=-0.08:gs=0.02:bs=0.12:rm=-0.04:bm=0.06:rh=0.06:gh=0.02,\
eq=contrast=1.08:brightness=0.03:gamma=1.15:saturation=1.4,\
vignette=PI/5,\
fade=t=in:st=0:d=1.2,format=yuv420p[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 25 -movflags +faststart "$OUT/s01_establishing.mp4"

# S05 — recognition reaction: Mad Dog key art on a smoky red ground,
# push-in from chest to eyes with a rack-focus pull.
ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=0x0b0708:s=1024x1820:d=4.5:r=30" \
  -loop 1 -i "$IMG/maddog.png" -t 4.5 -filter_complex "\
[1:v]scale=1024:1024,format=rgba[md];\
[0:v]geq=r='14+40*exp(-((X-512)*(X-512)+(Y-500)*(Y-500))/90000)':g='8+6*exp(-((X-512)*(X-512)+(Y-500)*(Y-500))/90000)':b='9+8*exp(-((X-512)*(X-512)+(Y-500)*(Y-500))/90000)'[bg];\
[bg][md]overlay=0:180,crop=1024:1820,scale=2880:5120,\
zoompan=z='1.0+1.2*(1-pow(1-on/135,3))':x='max(0,0.478*iw-0.5*iw/zoom)':y='max(0,0.203*ih-0.42*ih/zoom)':d=135:s=720x1280:fps=30,\
eq=contrast=1.18:saturation=0.75:brightness=-0.02,colorbalance=rs=0.10:rm=0.05,\
noise=alls=12:allf=t,vignette=PI/3.2,\
fade=t=in:st=0:d=0.25:color=white,format=yuv420p[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 22 -movflags +faststart "$OUT/s05_recognition.mp4"

# Posters (first meaningful frame) for instant display while video buffers.
ffmpeg -y -loglevel error -ss 0.6 -i "$OUT/s01_establishing.mp4" -frames:v 1 -q:v 4 "$OUT/s01_establishing.jpg"
ffmpeg -y -loglevel error -ss 0.4 -i "$OUT/s05_recognition.mp4" -frames:v 1 -q:v 4 "$OUT/s05_recognition.jpg"
ls -la "$OUT"
