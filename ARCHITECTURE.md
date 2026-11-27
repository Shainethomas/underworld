# Underworld — Architecture

Underworld is a choice-driven story game played in real-time 3D, in portrait, on phones and in the browser. This document describes the architecture, how the code maps onto it, and what is left to build. The README covers how to run, test and author the game day to day.

## Layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1  Frontend / Editor            React · TypeScript                      │
│    Game UI (HUD, dialogue, choices, call screen, skill moments, menus)  │
│    Editor: asset browser, scene hierarchy, properties, tools            │
├──────────────────────────────────────────────────────────────────────────┤
│ 2  Game and story runtime       Ink · TypeScript                        │
│    Ink: dialogue, branching choices, character state (variables),       │
│    scene progression.  TypeScript: staging (blocking, shots, cues),     │
│    skill moments, exploration, save/resume                              │
├──────────────────────────────────────────────────────────────────────────┤
│ 3  3D rendering engine          Babylon.js · WebGPU · WebGL 2           │
│    Sets, cast, cameras, lights, materials, animation, effects           │
├──────────────────────────────────────────────────────────────────────────┤
│ 4  3D asset pipeline            Blender · Mixamo · GLB / glTF           │
│    Characters, rigs, clips, props and set pieces                        │
├──────────────────────────────────────────────────────────────────────────┤
│ 5  Mobile delivery              Capacitor                               │
│    The built web app packaged as Android and iOS applications           │
└──────────────────────────────────────────────────────────────────────────┘
```

Each layer talks only to the one below it through a narrow interface, so a layer can be changed without rewriting the others.

### 1. Frontend / Editor (React, TypeScript)

**Game UI** (`src/app`, `src/components`): React renders everything that is not the 3D scene. It reads state from the Zustand store (`src/store/gameStore.ts`) and never touches the renderer. One noir theme (`src/app/noir.css`).

**Editor** (`editor.html` → `src/editor/`, dev builds only):

| Panel | Does |
|---|---|
| Asset browser | Lists `public/assets` (models, textures, audio) from a generated manifest; previews a GLB in the viewport |
| Scene hierarchy | Scene → beats; set → marks, named shots, lights, props; cast |
| Viewport | The same renderer as the game, with a free fly camera and gizmos for marks and shots |
| Properties | Edit the selected mark (x, z, y), shot (position, target, fov), actor directive or cue |
| Tools | Play from a beat; "camera → shot" (store the fly camera as a named shot); screenshot; validate the scene |

The editor reads and writes the same data files the game loads (set layouts as JSON, scene staging, Ink source), through a small dev-server endpoint (a Vite plugin). Nothing the editor writes is code.

### 2. Game and story runtime (Ink, TypeScript)

The story itself — who says what, what the player can choose, what each choice changes, which scene comes next — is written in **Ink** (`src/story/*.ink`, one file per scene, plus `globals.ink` for the variables every scene shares). It is compiled at build time by a Vite plugin (`vite.config.ts`, `scripts/lib/ink-compile.mjs`) and run with `inkjs`.

Ink content follows three conventions:

- **Dialogue**: `RAVI: Look who's finally here. #b2_l1`. The speaker is the prefix; the tag is the beat id that carries its staging.
- **Commands**: lines starting `>>>` are not shown. They name a non-dialogue beat (`>>> shot b2_bag`, `>>> title b1_title`, `>>> call b7_call`, `>>> qte b3_f1`, `>>> explore s2_deck`, `>>> complete`).
- **Choices**: `+ [Let's get this over with. #over]` (the tag inside the brackets) with `~ discipline += 5` inside the branch. The option tag is the id stored for later scenes (`challenge = "over"`).

**Staging** is data (`src/story/sceneNN.staging.json`, which the editor will write): per beat id, the camera shot, stage directions, audio cue and timeline, hold time, scene tag, and what a command beat needs beyond its words (a skill moment's prompts, an explore beat's hotspots). It also holds the scene's metadata (sets, cast, summary, next scene). Ink says *what happens*; staging says *how it looks*. Hotspot asides (the short lines Rookie says on reaching a hotspot) are still staging text and move into Ink knots later.

`StoryRuntime` wraps the compiled story and turns its output into the `Beat` objects the rest of the game already understands, so the UI and the stager do not know Ink exists.

**Character state** lives in Ink variables (`don_loyalty`, `independence`, `ravi_trust`, …, and the stored choices). The store mirrors them for the HUD and the scene summary. Flags written by gameplay (skill-moment results, hotspots visited) are written back into Ink so the story can branch on them.

**Progression** (`src/game/progression/Progression.ts`): cash, Respect and Varga hostility are Ink variables like the stats, moved only through `earn()` in `globals.ink`, which also writes each change and its reason to the scene's ledger for the debrief. Rank is derived from Respect by the store at each debrief and kept as the `rank` flag. Options tagged `#need:<variable>:<amount>` are shown locked with their reason; `>>> job` beats are the briefing card; `>>> qte id easy|hard` tunes a skill moment from what was chosen before it. README.md, "Progression", has the numbers.

**Saves**: Ink's state JSON plus the list of beat ids played in the current scene, and a fingerprint of the scene's compiled script (a changed script restarts the scene from its snapshot rather than loading a position that no longer exists). One-off upgrades live in `src/store/migrations.ts`. Resuming restores Ink and replays those beats' staging instantly, so the world (positions, doors, lights, dropped props) is rebuilt exactly. Each scene keeps a snapshot of the variables it started with, for Replay.

**Stager** (`src/game/engine/GameEngine.ts` and friends): runs a beat in 3D — environment switch, blocking, walks with obstacle avoidance, gestures, hand props, camera shots, timelines, audio. It reaches the engine only through `@render` (below).

### 3. 3D rendering engine (Babylon.js; WebGPU, WebGL 2)

**Why Babylon.js.** PlayCanvas was considered (November 2026) and not adopted. Babylon already covers everything the game needs: WebGPU with a WebGL 2 fallback, PBR materials, shadows, glow, depth of field, particles, glTF, and animation groups blended by weight (how the cast crossfades between clips). Every set, the cast, the cameras and the hand props were built and tested on it. Moving would mean rewriting the whole 3D layer, plus a conversion for PlayCanvas's right-handed coordinates, with nothing new for the player. PlayCanvas's main draw is its hosted, collaborative editor, and this project builds its own editor (layer 1), which uses Babylon for its viewport. Revisit only if measurements on target phones show the renderer is the bottleneck in size or speed.

The stager and the sets talk to the engine only through **`@render/*`**, a Vite alias (and a tsconfig path) for `src/game/babylon/`, the only folder that imports `@babylonjs`:

| Module | Responsibility |
|---|---|
| `@render/core` | The engine classes the game uses directly (vectors, colours, nodes, meshes, materials, canvas textures, particles) |
| `@render/Renderer` | Device (WebGPU, falling back to WebGL 2), quality tier, frame loop, post effects (bloom, depth of field, grain, tone mapping, a filmic colour curve; ambient occlusion on the high tier) |
| `@render/SetBuilder` | Primitives, PBR and glow materials, GLB set pieces, static freezing |
| `@render/LightingManager` | Hemisphere, spot, point and directional lights, shadows, emissive glow, light probe |
| `@render/CameraManager` | Pose blending, named shots |
| `@render/ProceduralTextures`, `@render/Effects`, `@render/Details` | Canvas-painted textures; dust, rain, splashes; batched foliage |
| `@render/Dressing` | Light and shade that cost no light slot: pools under lamps, window light on floors, wall washes, halos, neon signs, contact shade under furniture and along walls; posters, puddles, litter. `mergeDressing` folds a set's dressing into a few draw calls |
| `@render/AssetLoader` | GLB loading and caching |

Keeping the engine behind one folder keeps engine upgrades contained, and the editor's viewport uses the same modules.

**World conventions** (all set and staging data): metres; Y up; a set's floor at y = 0; an actor's yaw 0 faces +Z, positive yaw turns toward +X; marks are `[x, z]` or `[x, z, y]`; Babylon's left-handed coordinates.

Sets (`src/game/sets/*.ts`) are content: geometry, lights, marks, named shots, obstacles and scripted events, built through `@render/SetBuilder` and `@render/LightingManager`. Where the geometry is static they move to JSON layouts, so the editor can edit them.

**Set dressing**: a set's shader has at most 8 lights (WebGPU's limit, and the camera fill takes one), and every set is at or near it. So the look comes from unlit dressing (`@render/Dressing`): additive light pools, washes and window light where the real lights would land, halos and neon where bloom and the glow layer are off (phones), and dark contact shade under furniture and along wall feet where phones draw no set shadows or ambient occlusion. A set builds its dressing, then calls `D.mergeDressing(s, keep)` after its glow layer and before its probe bake; `keep` lists the pieces its events show or hide. All of a set's posters share one atlas material, so the static merge makes them one draw.

### 4. 3D asset pipeline (Blender, Mixamo, GLB/glTF)

| Source | Tool | Output |
|---|---|---|
| Rookie, the Don, the bodyguards (`art-source/rookie`, `don`, `alex`) | Mixamo rigs and clips → `scripts/blender/build_character.py` | `public/assets/models/{rookie,don,alex}.glb` |
| CC0 kit characters and clips (`art-source/quaternius`) | `build_character_kit.py`, `build-animations.mjs` | `character_kit.glb`, `animations.glb` |
| Set pieces (bag, chair…) | `build_environment_props.py` | `public/assets/models/*.glb` |
| Textures | `prepare-environment-textures.mjs` | WebP in `public/assets/textures` |
| Audio | `build-audio.py` | WebM/Opus + MP3 in `public/assets/audio` |

GLB is the only runtime 3D format, meshopt-compressed as the last pipeline step (`scripts/compress-models.mjs`, decoded with the self-hosted `public/assets/lib/meshopt_decoder.js`). Bone names follow the kit (`pelvis`, `spine_01`, `hand_r`, `Head`…), so clips, look-ats and hand props work on every character.

### 5. Mobile delivery (Capacitor)

`npm run build` produces `dist/`; Capacitor (`capacitor.config.ts`, `android/`, `ios/`) wraps it as native apps. The game is portrait-locked, keeps the screen awake during play, hides the status bar, and saves to the WebView's `localStorage` (moving to Capacitor Preferences so saves survive WebView storage clears). `npm run mobile:sync` copies a fresh build into both projects; `npm run mobile:android` / `mobile:ios` open them in Android Studio / Xcode.

### Loading and streaming

A scene change works like a big game's loading screen, with streaming behind it:

1. **Unload.** The old cast and set are disposed, then every file the new scene doesn't use is freed (`@render/AssetLoader`: owners `hold` URLs, `sweep` frees what nobody holds).
2. **Load what the first shot needs**, behind the loading screen (`LoadingScreen.tsx`: title card, tips, stage and progress): the cast's models, the opening set's textures and props, the opening music. Then the set is built, every cast member's shaders are compiled under its lights, and the first beat is staged and drawn a few times before the screen lifts, so nothing compiles mid-scene.
3. **Stream.** While the scene plays, the rest of its sets load one file at a time at low network priority (waiting out skill moments and set changes), then the rest of its sound, then the next scene's story and files (downloaded only; they're decoded at its loading screen).

The title screen warms the game's code and the first scene's files the same way, unless the device asks to save data. What each scene and set loads is data (`src/game/assets/manifest.ts`, with `castUrls` in `CharacterDefs.ts`), known before anything is built; in development the loader warns about any file that wasn't in a manifest. Files arrive through one byte cache (`src/game/assets/ByteCache.ts`, with no engine imports), and textures are decoded off the main thread. Audio decodes the opening tracks up front, plays later cues from bytes already in memory, and keeps the last few tracks decoded.

Nothing may build up from one scene to the next: the game is meant for 100+ hours. `npm run test:soak` plays every scene again and again in one page and fails if GPU textures, meshes, materials, resident files or the JS heap keep growing after a warm-up cycle (which fills the caches that live all session). Anything built by a long-lived owner (the hand props' builder lives all session) must forget what it disposes (`SetBuilder.pruneDisposed`).

### Performance on phones

The approach shipped mobile games take (device tiers, budgets, drawing less, frame-rate policy, recovering from crashes), applied to this game:

- **Device tiers** (`src/platform/deviceTier.ts`): `high` for desktops and tablets with a fine pointer, `low` for phones, `lite` for weak phones (3 GB of RAM or less, four cores or fewer, or an older Adreno, Mali or PowerVR GPU; a mid-range Mali (G57, G68, G71–G76) only when the phone also reports under 4 GB or fewer than 8 cores; iPhones report neither, so they stay on `low`). Settings → Graphics can override it. Sets still see two detail levels (`Quality`: `high`, or `low` on both phone tiers).
- **Phone-sized files** (`src/game/assets/urls.ts`, built by `npm run assets:mobile`): phones load the character models with 1024 px colour and 512 px normal maps (a full-size 2048² colour map is about 21 MB of GPU memory) and the kit at 512 px; `lite` also loads 512 px set surfaces. The engine sets the tier before any manifest is built, and the title screen before it warms files.
- **Budgets** (checked with `scripts/measure-lowend.mjs`): 150 draw calls and a steady frame rate on phone settings. Imported set pieces are merged by material when they load (the sedan goes from 88 parts to 7), and each set merges its static geometry by material when it freezes it (`SetBuilder.freezeStatic(moving, { merge: true, keep })`). Merging keeps each piece's shadow casting, glow exclusion, probe and mirror lists and per-light include/exclude lists; `keep` names whatever the set's script shows, hides, fades or moves besides the `moving` nodes, and transparent, hidden or picked (walkable) pieces stay separate. A new set must list its scripted pieces there. Pieces that move on their own and so can't be merged (the city's blocks and lamps, each on its scroller) are GPU instances of one source each (`SetBuilder.instance`), one draw call per piece and material; a built piece that moves as a whole merges its own parts (`SetBuilder.mergeChildren`). The city drive went from about 300 draw calls to 60 this way.
- **What `lite` gives up**: shadow maps (soft blob shadows under the cast instead, `@render/BlobShadows`), bloom, grain and glow, a lower resolution range (1–1.25×) and a smaller reflection probe.
- **Render resolution** (`src/game/engine/ResolutionScaler.ts`, ranges in `resolutionRange` in `@render/Renderer`): phone GPUs are limited by pixels, so resolution moves with what the GPU holds. `low` starts at 1.5× CSS pixels and moves between 1.25× and 2× (`high` 1.25–2×, `lite` 1–1.25×): a step down when calm beats run late and the GPU (not the main thread) is the bottleneck, a step up after a steady stretch, backing off when that fails. Each set starts where it last settled. Phones add a light sharpen after FXAA, since the browser stretches their frame to fit the screen.
- **Frame rate** (`FrameGovernor.setCap`): phones run dialogue, choices, shots and calls at 30 fps and explore, skill moments and drives at full rate, which roughly halves GPU work (heat, battery) over a session. When a device still can't hold its rate and the GPU is the bottleneck, the stager drops ambient occlusion first (high tier only), then lowers render resolution (down to the tier's floor; the scaler wins it back later), then sheds grain, depth of field and bloom, and only then lowers the frame rate. On Android the panel's refresh rate comes from the system (`DisplayPlugin.java`, `displayRefreshRate` in `src/platform/native.ts`): measured from frame timing, a busy GPU made a 90 Hz panel read as 45 Hz.
- **Shaders before the reveal** (`GameEngine.warmAndSettle`): on WebGPU a frame counts as rendered once it's submitted, while the GPU thread builds its new pipelines afterwards (on a Mali-G68 an opening's ~30 took over 4 s). The loading screen and a set change's fade lift only once the GPU has finished (`queue.onSubmittedWorkDone`), so that wait happens behind them instead of as a freeze right after.
- **Crash recovery** (`src/platform/recovery.ts`): a lost GPU context or WebGPU device reloads the page; iOS reloads the WebView itself when it kills its process; Android rebuilds the activity when the WebView's render process dies (`MainActivity.java`). A heartbeat records the scene being played, so a page that starts within 45 seconds of it goes straight back to that scene's current beat (the save is written every beat). A deliberate reload or close clears the heartbeat (`pagehide`) and shows the title screen.
- **Download size**: `npm run mobile:sync` drops the Android build's MP3s, since Android's WebView always plays the WebM/Opus copies.

Not yet done: downloadable chapter packs (an app store's base download limit can't hold 100 hours of content; it needs a content host), lighting baked into the sets' textures in Blender (the cheapest light there is), GPU-compressed textures (KTX2 / Basis, which needs KTX-Software in the pipeline), and merging inside moving nodes (the city drive's scrolling blocks and lamps keep it around 185 draw calls).

## Data flow

```
 Ink (.ink) ──compile──► story JSON ─► StoryRuntime ─► Beat ─┬─► React UI (line, choices, call…)
 Staging (.json) ────────────────────────────┘                └─► Stager ─► @render ─► Babylon.js
 Set layouts (JSON) + set code ─────────────────────────────────────┘
 Player input ─► store actions ─► StoryRuntime (choose / continue) ─► next Beat
```

## Plan

Every phase leaves the game playable end to end.

| Phase | Work | Status |
|---|---|---|
| 0 | This document; Scene 01 rewritten as "The Unexpected Call" | done |
| 1 | Capacitor: config, Android and iOS projects, scripts, portrait lock, status bar, keep-awake | done (iOS simulator build passes; Android needs JDK 21 on the build machine) |
| 2 | Ink: compiler plugin, `StoryRuntime`, Scenes 01–03 → Ink + staging (checked beat for beat against the old beat lists), saves move to Ink state | done |
| 3 | Renderer seam: `@render/*`, every engine import routed through `src/game/babylon/`, sets moved to `src/game/sets/` | done |
| 4 | Editor: set layouts to JSON, dev-server write endpoint, asset browser, hierarchy, properties, viewport with fly camera and gizmos, camera → shot | next |
| 5 | Mobile hardening: saves in Capacitor Preferences, device testing on Android and iOS, store builds | planned |
