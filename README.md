# Underworld — Chapter 1: A Place at the Table

A choice-driven mafia game played in real-time 3D (Babylon.js): Rookie rises through Victor Sable's organisation one job at a time, earning cash, Respect and rank (see Progression). Four story scenes are playable: **Scene 01 — The Unexpected Call**, **Scene 02 — The Opportunity**, **Scene 03 — A Bigger Problem** and **Scene 04 — No Loose Ends**. Between them, Lucas's board offers street work: three short contracts a night, new every day (see Street work). Characters act in 3D sets with cinematic cutscene cameras; the player makes dialogue choices, explores by picking places from a list, and plays short skill moments: the fight in Scene 01 (block, duck, counter, finish) and the scuffle at the rail yard in Scene 03 (block and counter, or break his grip). There is no joystick and no combat system.

The previous three.js prototype ("Homecoming") is preserved untouched in `legacy/homecoming/`. How the layers fit together (React UI and editor, Ink story runtime, Babylon.js renderer, Blender/Mixamo assets, Capacitor apps) and what is left to build: [ARCHITECTURE.md](ARCHITECTURE.md).

## Run

```bash
npm install
npm run dev          # http://localhost:5173  (add ?test for debug hooks)
npm run build        # type-check + production bundle in dist/
```

Portrait 9:16. On desktop the game sits in a centred phone-shaped frame; on phones it fills the screen, and turning the phone sideways shows a "turn upright" hint.

The whole game uses one noir look (`src/app/noir.css`): charcoal, white type, one red accent, bold italic condensed caps for names and labels (Barlow Semi Condensed) over Inter text. The title screen is the key art (`public/assets/ui/menu_bg.webp`, from `art-source/menu_keyart.png`: Rookie, Victor, Lucas and two of Victor's men on a rooftop over the city at night) under a brush-stroke UNDERWORLD logo, with a bar that fills while the first scene's files are fetched ("Ready.") and two chunky buttons: New Game (asks before wiping a saved game) and Continue (where you left off, or the latest scene). The main menu, settings, the pause menu, the scene summary and the skill moments (hold, timing taps, mash) share the style. The game screen: a top bar (rank, Respect toward the next rank, cash, menu), the 3D scene full width, and below it the speaker (a red bar and the name in caps) with the line, set over the scene's darkened foot; then "What do you say?" between hairlines and the replies as dark rows, the one in focus lit with a red edge (it follows the pointer; the arrow keys move it and Enter picks it; the keys 1–4 pick directly), or a skill moment. The scene fills the page for cutscenes, title cards and exploring; otherwise it keeps one height, so the text area is the same size with or without a decision. The story moves on only with the Next button under the line or narration (or in the scene's corner on cutscenes and title cards, next to Skip); it lights up once a line has finished typing, and tapping the line finishes it early. Space/Enter work as Next. The pause menu has Standing and the Story log (the scene's lines, captions and picks so far). The earlier comic look (the "Graphic Novel · Classic" design, `src/app/comic.css`) styles the same markup: import it in `src/main.tsx` instead of `noir.css` to switch back (and add its Bangers and Comic Neue fonts back to `index.html`).

Renderer: WebGPU when the browser supports it, otherwise WebGL 2. You can force WebGL 2 in Settings → Renderer. Graphics are chosen per device (Settings → Graphics: Auto, High, Low, Battery): High on desktop, Low on phones, Battery ("lite") on weak phones (3 GB of RAM or less, four cores or fewer, or an older Adreno, Mali or PowerVR GPU). Phones run dialogue and cutscenes at 30 fps and explore, skill moments and drives at full rate. If a device still can't hold its frame rate, the game drops grain, then depth of field, then bloom, then render resolution, before it lowers the frame rate. See ARCHITECTURE.md, "Performance on phones".

## Progression — rank, Respect, cash and the Varga crew

The game is about rising through Victor Sable's organisation. Each job follows the same loop: a **job card** (who it's for, the pay, the risk, the objective), **prep** (an approach, and optionally one purchase), the job itself (drives, fights, exploring, talking), one or two **calls** that trade money, Respect, relationships and Heat, and a **debrief**. The insider leak and Victor's past run behind the jobs as loose ends; they are never a puzzle the player has to solve.

| What | Where it lives | What it does |
|---|---|---|
| **Cash** | Ink `cash` | Earned from jobs and the fight purse; spent in prep (gear) and on calls (Sal's fee). New games start at $0 |
| **Respect** | Ink `respect` | Earned by finishing jobs, grades and bold calls; lost by soft or sloppy ones. Respect gates options (`#need:respect:N`) |
| **Rank** | flag `rank`, set by the store at each debrief | Rookie 0 · Runner 100 · Associate 225 · Soldier 400 (`RANKS` in `src/game/progression/Progression.ts`). Promotion happens only at a debrief and is never taken back. A scene can cap it (`rankCap` in its staging): Scene 03 stops at Runner however much Respect Rookie has, because Associate is Victor's to give in Scene 04, and Scene 04 stops at Associate |
| **Heat** | Ink `heat` | Attention drawn on a job |
| **Varga hostility** | Ink `varga` | How the rival crew see Rookie: Unaware · Watching (1+) · Hostile (15+) · At war (30+) |
| **Lucas's Trust / Victor's Favour** | Ink `ravi_trust` / `don_loyalty` | The two relationships that matter; shown on the Standing sheet |
| **Gear and contacts** | flags `gear_knuckles`, `gear_burner`, `gear_plates`, `contact_sal` | Bought in prep or earned on a job; they carry forward |

Every payment and cost goes through `earn(kind, amount, why)` in `globals.ink`, which also appends it to the scene's `ledger` (`<kind><amount>^<reason>;`). The debrief lists the ledger, so every number that moves has its reason on screen; the store clears the ledger and the grade (`job_grade`) when a scene starts. Base pay and Respect per job (Scene 01: the purse and 50; Scene 02: $800 and 70; Scene 03: $2,400 and 70; Scene 04: $1,000 and 80) are in each scene's Ink and mirrored in `JOB_BASE` for save migration.

An option can be **locked**: tag it `#need:<variable>:<amount>` (`#need:cash:300`) and it stays on screen, greyed, with the reason ("Needs $300"), so the player always sees three options and knows what the third would take. A skill moment can be made easier or harder by what was chosen before it: `>>> qte b3_slip easy` (wider timing window, fewer taps to mash) or `hard`.

The **top bar** shows rank, Respect toward the next rank and cash. The **Standing** sheet (main menu, pause menu, debrief) shows the rank ladder, what more Respect would open, cash and Heat, Lucas, Victor and the Varga crew, gear and contacts, and the loose ends so far. Level, health, stamina and gems are no longer shown (they stay in old saves, unused).

**Old saves** (version 4 and earlier) are upgraded once (`src/store/migrations.ts`, marker `economy-v5`): the decorative $5,000 is dropped and cash and Respect are rebuilt from what the save proves. Scene 01: the purse and Respect from the stored fight results (no prep pick existed, so no ×1.5 or bravado bonus). Scene 02: base pay and Respect, as a clean, on-time job with no fee (the old script had no route, fee or sedan). Scene 03: base pay ($2,400, less 20% if the stored Heat is 30 or more) and base Respect plus the stored standoff result. Scene 04: base pay and Respect. Nothing could be bought before, so nothing is spent. Each scene's replay snapshot gets the earnings of the scenes before it. A scene that was in progress restarts from its snapshot, because its saved Ink position belongs to the old script; from now on every save records a fingerprint of its scene's script, and a scene whose script has changed since restarts the same way (with a "Scene updated" notice) instead of loading a position that no longer exists.

## Street work — Lucas's board (the daily loop)

The design writeup for reviewers is [WRITEUP.md](WRITEUP.md).

After Scene 01, **Tonight's Work** (title screen and debrief) offers three short contracts a night, one each at Pier Nine, Hollis Hill and Calder Yard. New ones arrive at local midnight (`src/game/board/Board.ts`; the interface is `src/components/menus/BoardSheet.tsx`). Each contract plays in about 90 seconds: a job card, a prep pick (muscle, quiet or homework), a look round for leverage, two rounds of talk, a fight if the talk goes wrong, and a debrief.

- **Reading people:** every contact is greedy, scared or proud, and every reply Rookie picks presses, charms or threatens (each reply is labelled). A fixed table in `src/story/contracts/contract.ink` decides how each lands: the right tactic +2, a fine one 0, the wrong one −2 (−3 threatening a scared man). Four or more is a clean deal (full pay and Respect, plus a third more Respect for a cold read), 0–3 a deal at a discount (60% pay, half Respect), below 0 a fight (won: 70% pay, half Respect; lost: 30%; Heat +10 either way). So a clean deal takes reading him right twice. Homework names the temperament but costs a quarter of the pay. The debrief says what the contact was and what would have worked.
- **Balance gate:** `npm run test:contracts` also proves that no plan which ignores the contact (a fixed prep, an opening tactic, and a round-2 reply chosen from how he took the first) clean-deals more than one temperament in three. Before this gate, *muscle → look round → press, switch to threaten if he bristles* clean-dealt all three, so reading people didn't matter.
- **Tomorrow:** each contract leaves a morning message with a small effect (cash, Respect, Heat, Lucas's trust). Heat cools 10 a night, and High-risk jobs are locked at Heat 30+ (and need Runner). Nights worked in a row earn Lucas's word at 3 and 7. "Playtest: skip to tomorrow" on the board moves the clock on a day.
- **Content:** contracts are AI-written to `src/story/contracts/SPEC.md`. Each is `c_<kit>_<nn>.ink` (the words) plus `.json` (the card and the cast). The kits (`kits/<kit>.staging.json`) stage them on each set; the docks and estate kits are generated from the yard's by `python3 scripts/contracts/make-kits.py`. `npm run test:contracts` plays every route of every contract and must pass before any contract ships.
- A contract is a scene with `kind: 'contract'`. It promotes at most to Runner, never unlocks story scenes, and always starts from the current standing (a story scene left half-played restarts from the new standing).

## Scene 01 flow — The Unexpected Call

About five minutes, evening: Victor's test, disguised as a sparring match, and the first money.

| Beat | Where | Player does |
|---|---|---|
| 1 Arriving late | The gym from the street (`GymExterior.ts`), then the training floor | Title card. Rookie walks in forty minutes late. **Choice** (`late`). He works the heavy bag |
| 2 The challenge | The bag line | **Choices** (`tough`, `challenge`). Lucas has money riding on it: "Put him down, and you get a cut." **Job card**: Training Match · Lucas · a cut of the bet · Low |
| 3 Marco | The bag line | Marco walks over: "Private lessons with Victor himself. Must be nice." **Choice** (`marco_reply`). Lucas: "Victor doesn't train anybody, Marco. He trained him." |
| 4 Prep | The bag line | **Card choice** (`s01_prep`): watch him spar (Intel; his tell — the slip and counter get easier if Rookie starts low) / warm up (Discipline; the block or opening flurry gets easier) / get in his face (Independence; Marco rushes from the bell: no opening choice, the flurry and the finish get harder, the purse ×1.5) |
| 5 The fight | The ring | Played. Unless Marco rushes, **card choice** (`opening`): all in (attack, then finish) or start low (block, duck, counter, finish). Each result is the share of taps that landed (0–1). The grade is the average: **clean** (0.75+), **scrappy** (0.4+) or **ugly** |
| — After | Ringside | **Choice** (`after_fight`). Lucas: "Wasn't my idea. The boss asked for Marco." He pays the purse: clean $500, scrappy $300, ugly $150 (×1.5 after getting in his face) |
| 6 Victor | The viewing deck | By the grade: a nod (clean, Favour +5) / "He doesn't wait to be told." (all in, not clean) / "He'll learn." (scrappy) / he waves it off and turns away (ugly). Lucas mentions it at the door |
| 7 Going home | Inside the doors | **Choice** (`tomorrow`) |
| 8 The call | His room (`RookieQuarters.ts`) | The nightstand phone: **Unknown number**. A rival crew: "Good fight tonight." **Choice** (`varga_open`; asking how they got his number gives Intel) and **choice** (`varga_call`): hang up (Respect +5, Favour +5) / "I'm listening." (Independence) / "Tell your boss I'm not for sale." (Varga +5) |
| 9 Lucas | His room | **Message**: "Boss liked what he saw. Tomorrow you work." **Card choice** (`s01_reply`; telling Lucas about the call gives Trust +5). Lights out |
| Debrief | — | Grade, Respect (50 for the win, +20 clean / +10 scrappy, ±5 bravado, +5 hanging up: 45–80), cash, fallout, Next job: The Delivery |

## Scene 02 flow — The Opportunity

About four to five minutes, from the evening to past midnight: Rookie's first job, and the end of session one. The job was taken at Scene 01's debrief, so the scene opens on Lucas giving the details; nobody re-pitches it. Every line Rookie says is the player's pick. (The earlier Scene 02, the Don's call and the research facility, is in `legacy/before-morning-call-2026-11-07/`.)

| Beat | Where | Player does |
|---|---|---|
| 1 The brief | The gym from the street, evening | Title card, then Lucas: "Boss liked what he saw last night, so here's your first real job." Pier Nine at half ten, Sal's parcel, the man at the door on Hollis Hill. **Job card**: The Delivery · Victor · $800 · Low |
| 3 Prep | The gym front | **Card choice** (`s02_prep`): by the book / back streets (a longer drive; late at the pier: −$100, −5 Respect; the grey sedan has left Hollis Hill before he arrives) / scout the pier (an extra look round the dock first; the cut container seals give him leverage over Sal). **Shop** (`s02_shop`): knuckle duster $300 / burner phone $150 / keep the cash (locked items show what they need) |
| 4 Pier Nine | The dock (`Docks.ts`) | **Explore** (scouting adds the containers). Sal was told ten, Lucas said half ten (`sal_time`): **choice** (`sal_reply`). **Choice** (`pickup`). Sal's $200 fee, **choice** (`sal_fee`): pay (−$200, −5 Respect, Sal becomes a contact) / lean on him (+10 Respect; without the containers it's +10 Heat and Sal won't deal with him again) / call Lucas (Trust +5, −5 Respect) |
| 5 The drives | The city | Driven by the player, twice |
| 6 Hollis Hill | The house (`EstateExterior.ts`) | Unless he came the back way: a grey sedan by the house, engine ticking (`s02_sedan`). **Card choice** (`s02_car`): note the plate (Intel, +5 Respect, Lucas's Trust +5 at the gym) / leave it / knock on its window (+5 Respect, +10 Heat, +10 Varga; the guard remarks on it). **Explore** to the door. The guard knows him: "Victor's fighter. The one who put Marco on the floor." **Choices** (`door_greet`, `doorstep`) |
| 7 Payment | The gym front, near midnight | **Choice** (`handover`). Lucas turns the envelope over: "C.Y." in pencil (`envelope_cy`). **Choice** (`envelope_ask`). **Choice** (`cut`): $800 |
| 8 Home | His room, 12:40 AM | **Message** from Lucas: "He wants you on something real. Pays triple. Not like tonight." **Card choice** (`reply`) |
| Debrief | — | Graded **clean** (on time, no fee paid, no scene made) +20 or **messy** +5. Respect 70 for the job; every route reaches **Runner** here (110–180 after Scene 02). Next job: Calder Yard · $2,400 · High |

Stored for later scenes: every choice id above, the flags `sal_time`, `s02_sedan`, `envelope_cy`, `pier_seals`, `contact_sal`, the gear flags, the variables and `scene02_completed`.

A `drive` beat (`>>> drive id [Destination] prompt`, `distance` in metres in the staging) hands the city set's car to the player (`DriveControl` in `sets/types.ts`); the beat ends a moment after the car pulls up. A `message` beat (`>>> message id [Sender] text`) is a text arriving on his phone: a notification card over the scene, then Next. Hand props for the job: `carry: package` (the parcel), `envelope` and `cash`, held in the right hand; setting `carry` on one actor and `null` on another in the same timeline event passes it between them.

## Scene 03 flow — A Bigger Problem

The first dangerous job: collect Victor's package from Nico at the old Calder rail yard, for $2,400, with the Varga crew watching. Each approach plays its own way; the leak (who moved the pickup time) runs behind it as a loose end. Every line Rookie says is the player's pick. (The earlier Scene 03, the time machine, is in `legacy/first-experiment-2026-11-10/`; its sets and code are still in `src/game/sets/` but no scene uses them.)

| Beat | Where | Player does |
|---|---|---|
| 1 The job | The gym front, evening | Title card, then straight into the brief (the job was taken at Scene 02's debrief): "Here's the job." **Choices** (`different`, `nico_warn`). Lucas gives the time: "Twenty past eleven, not before." With **Lucas's Trust 15+** he names the Varga crew and the grey sedan. **Job card**: Calder Yard · Victor · $2,400 · High |
| 3 Prep | The gym front | **Shop** (`s03_shop`, one item): clean plates $400 / knuckle duster $300 (if he hasn't one) / Sal's word on the yard $250 (needs Sal as a contact; +10 Intel and a text: the sedan, behind the boxcar) / keep the cash. **Approach** (`s03_prep`): **strong-arm** / **quiet** along the tracks (needs **Intel 10**) / **work Nico** (he texts back) |
| 4 The yard | `RailYard.ts`, 11:20 PM | Strong-arm: straight from the car to Nico, no looking around. Quiet: on foot from the tracks, **explore** unseen (the boxcar shows the sedan). Nico: **explore** to his door, and Nico talks first: where the car is, and "they told me midnight" (`nico_time`). **Choices** (`nico_greet`, `on_the_way`; asking who he's expecting also gets "midnight") |
| 5 The sedan | The yard | The route follows the prep. **Strong-arm → confront**: +15 Heat, +5 Varga, +10 Respect; the man knows Rookie's name and remembers Scene 01's call ("You should've called back" / "We'll see") or Scene 02's knock; he sees the permit. **Quiet → avoid**: Nico panics, nobody sees Rookie's face. **Nico → trust**: +5 Heat; "Insurance." **Choice** (`insurance`): believe him (`nico_trusted`) / ask / call him a liar |
| 6 The package | The yard | Nico hands it over (`handoff`). **Explore**: strong-arm can only walk back to the car (he's watched); quiet can look at Nico's office (the phone call: "I did what you said. We're square.") and the sedan's permit for no Heat; through Nico, each look costs Heat (+5 / +10) |
| 7 The standoff | Between the office and the car | "I'll take that box." **Choice** (`standoff`): **fight** (+5 Heat, +10 Varga; the strong-arm throws first and skips the block; the knuckle duster eases the counter; winning the counter +10 Respect) / **talk** (needs **Respect 130**, unless he came through Nico, who kills the yard lights; +15 Respect, +10 Heat, +5 Varga) / **run** (the quiet route's escape is easier) |
| 8 Getaway | The yard, the city | Clean plates take 10 Heat off if the job drew any. **Driven** back |
| 9 Lucas | The gym front, 12:35 AM | **Choice** (`back_late`). How he tells it (`report`, the job's call): straight (Lucas's Trust +5) / play it up (+10 Respect now; `s03_call = play_up`, remembered) / squeeze him for more (+$400, −5 Respect, −5 Favour). **Choice** (`the_car`). Then Lucas: "Did Nico say anything about the time?" — nobody had told him there was a problem. **Choice** (`time_q`; with `nico_time`: "He said midnight. You told me twenty past eleven.") |
| 10 Pay, Victor | The gym; the deck after closing | $2,400 (−20% cleanup if Heat is 30+). **Choice** (`go_home`). Victor: "Find out who talked, Lucas. Quietly." |
| Debrief | — | Graded by the Heat this job drew: **clean** (≤10, and no lost fight) +25, **messy** (≤25) +10, **botched** 0. Respect 70 for the job. Respect can pass 225 here, but the debrief can't promote past Runner (`rankCap` 1): Associate is Victor's to give, in Scene 04. Next job: No Loose Ends |

Stored for later scenes: every choice id above, `s03_prep`, `s03_call`, `stranger_seen_face` (false only on the quiet route), `nico_time`, `lucas_time_asked`, what he looked at and learned (`yard_*`, `heard_nico`, `saw_permit`, `saw_tail`, `heard_name`, `nico_trusted`), the scuffle results and `scene03_completed`.

## Scene 04 flow — No Loose Ends

The organisation answers. Nico has vanished since Calder and the Varga crew are hunting him too; Victor wants it handled and is watching who handles it. The chapter ends with Victor seeing Rookie himself, for the first time, and giving him Calder Yard: the promotion to **Associate** is said in his office before the debrief shows it. The leak and Victor's past end the chapter as two short stingers, not as a puzzle.

| Beat | Where | Player does |
|---|---|---|
| 1 Lucas | His room, then the gym front | Lucas calls, short with him (`n_greeting`). At the gym, unslept (`n_meeting`). The Varga crew, named; Lucas follows up on the permit, Nico's call and "insurance" if Rookie found them. **If Rookie played up Calder** (`s03_call = play_up`): "It wasn't all of them, was it?" −15 Respect, −5 Trust. **Choice** (`n_assignment`). **Job card**: No Loose Ends · Victor · $1,000 · High |
| 2 Prep | The gym front | **Approach** (`s04_prep`): **quiet** (the back stairs: skips the woman downstairs, full search, but no warning about the two men, so their block is harder) / **front door** (+10 Respect, +15 Heat, +10 Varga: she tells everything, but the search is short and the call always comes) / **buy the building** ($300: the key, the men described, two knocks on the pipes when they come, and a way out down the service stairs) |
| 3 Mercer House | `MercerHouse.ts` | **Heat 25+**: two men already watching across the street, and a short search. The woman downstairs (`n_resident`): lean on her (+5 Heat, the room number only) / level with her (Trust, Discipline, the two men) / "I work for Victor Sable" (needs **Respect 200**; +5 Favour; she tells the Varga men, and they mention it) |
| 4 Room Four | Nico's room | **Explore** (drawer, cash, bag; the drawer is skipped on a short search). If he found the cash, **card choice** (`nico_cash`): pocket it (+$400) / take it for Victor (+5 Favour) / leave it |
| 5 The call | Room Four | Unless he has the **burner** (and didn't come in the front door): Unknown number. "Stop looking for Nico." It names what he did at Calder (the fight, the car, listening at doors). **Choice** (`n_caller`) |
| 6 The stairs | The landing | The Stranger and a second man; he knows Rookie's face only if he saw it at Calder, and remembers the standoff. **Choice** (`n_confrontation`): fight (+10 Heat, +10 Varga; block, harder if nobody warned him, then counter, easier with the knuckle duster; a clean counter +10 Respect) / "Tell Varga that Calder cost him. Next time it costs more." (needs **Respect 210**; +15 Respect, +10 Heat, +15 Varga; slip past) / down the service stairs (bought the building) or "Nothing. I'm leaving." (break his grip) |
| 7 The note | The service stairwell | Nico's coat; the note: "Calder pickup. Time changed to 23:20. Use the gym staff pass. Same inside line. Burn this." It shows access, not guilt. **Driven** back |
| 8 Who gets it | The gym front | **Choice** (`n_report`), then the chapter's last call (`s04_note`): give it to Lucas (+10 Trust, +5 Respect; Lucas reads it: "Twenty-three twenty. That's the time I gave you.") / take it to Victor (+10 Favour, +15 Respect, −10 Trust) / keep it (Independence, Intel, −5 Trust) |
| 9 Victor | Victor's office (`BossOffice.ts`) | Victor seated behind his desk, Rookie standing; Lucas by the window unless Rookie went over his head. **Choice** (`v_open`). Victor on the note, by who got it. "Marco. Hollis Hill. Calder. I watched all of it." **Choice** (`v_terms`; asking why he picked Rookie: "Not today."). "Calder Yard is yours now." (`owns_calder`) **Choice** (`v_answer`). With Varga hostility 30+: "Enemies are proof you matter." With **Respect 300+**, **choice** (`crew_pick`): who works the yard with him |
| 10 Outside | The gym front | Two messages from unknown numbers: a photo of Nico's note, "You found the wrong part of the story. Ask Victor what happened at the gym before he found you."; and "Enjoy the yard while it's yours." Victor alone in his office, an old photograph on the desk: "So it's started." |
| Debrief | — | $1,000, Respect 80, **clean** (≤15 Heat this job) +10. The promotion to **Associate** (every route; `rankCap` 2 keeps Soldier for Chapter 2). Next job: Hold the Yard · a fifth of Calder · War (the next update) |

Stored for the next chapter: every choice id above, `s04_note`, `nico_cash`, `varga_message`, `owns_calder`, `crew_pick`, `asked_victor_why`, the variables (Varga hostility decides how hard they come for the yard) and `scene04_completed`.

## Architecture

```
src/
  app/                 App shell, GameScreen (composes the screen per beat), styles.css, noir.css (comic.css: the earlier theme)
  components/          comic/ (top bar, Next, caption boxes, story log), dialogue, choices,
                       cinematic overlays, explore markers, QTEs, menus
  story/               sceneNN.ink (the story, in Ink), sceneNN.staging.json (how each beat looks), globals.ink
  store/gameStore.ts   Zustand + persist: the current beat, Ink's saved state, choices, vars, flags, settings
  platform/native.ts   Capacitor: portrait lock, status bar, keep-awake (native apps only)
  game/
    narrative/         Data model (types.ts), StoryRuntime (Ink → beats), NarrativeEngine (interactive beats,
                       staging checks), ChoiceSystem, DialogueSystem (typewriter)
    engine/            GameEngine (stages beats in 3D), CinematicController (shot language),
                       EnvironmentManager (code-split sets), InteractionController (tap-to-walk),
                       HandProps (the bag and phone in a hand), SceneManager (scene registry),
                       paths.ts (obstacle avoidance)
    sets/              GymExterior, TrainingFacility, RookieQuarters, CityDrive, EstateExterior,
                       TimelineExploration, ChronosExperiment, FacilityEntrance,
                       ResearchFacilityEnvironment, ChronosMachinePresentation (written against @render)
    babylon/           The renderer backend behind `@render/*` (ARCHITECTURE.md): core (engine classes),
                       Renderer (WebGPU/WebGL2, post FX), CameraManager, LightingManager, SetBuilder,
                       AssetLoader (GLB), Effects (rain/dust), ProceduralTextures, Details
    characters/        CharacterAssets (cast outfits from one kit + clip retargeting),
                       CharacterExpressions (gesture → clip), CharacterPresentation (Actor)
    audio/             AudioManager (Howler: music, ambience, sfx, voice)
```

**Writing story content.** Each scene is two files in `src/story/`: `sceneNN.ink`, the story in [Ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md) (every visible line, the choices, what they change, the branching), and `sceneNN.staging.json`, how each beat looks (keyed by beat id). Variables every scene shares are declared in `globals.ink`. Ink is compiled when the game is built or served (the Vite plugin in `vite.config.ts`) and run by `StoryRuntime.ts`, which joins each line with its staging. In the Ink:

```ink
RAVI: Look who's finally here. #b2_l1            // a line; the tag is its beat id
>>> shot b2_enter [Downtown Gym] Evening.        // any other beat: kind, id, optional [label] and words
+ [Let's get this over with. #over]              // an option; its tag, inside the brackets, is the option id
    ~ challenge = "over"                         // stored for later scenes
    ~ discipline += 5                            // shown as a toast, and on the scene summary
```

Branching is Ink's own (conditionals, diverts, labelled gathers for hubs). A new beat needs an entry with the same id in the staging file. New scenes are registered in `SceneManager.ts`. `node --import ./scripts/lib/ts-resolve.mjs scripts/check-ink.mjs` plays every scene with several choice policies and checks that every line, command and choice finds its staging. The beat lists the scenes were first written as are in `legacy/scene-data/` (`scripts/ink-convert.mjs` made the Ink from them).

In the staging, beat types are `title`, `line`, `caption`, `shot`, `choice`, `call`, `explore`, `qte`, `video` and `complete`. A beat can also carry:

- `stage` directions (move, walk, face, pose or gesture actors, or change outfits)
- a camera `shot`, either a named shot from the set or one relative to the actors (`close:don`, `ots:rookie>don`, `two:rookie,ravi`, `follow:rookie`)
- a `cue` for music, ambience or sound effects, with a timeline of timed events
- `elapsed`: shows a measured elapsed time in a small badge (used by the legacy time-machine scene)
- `tag`: a small label on the scene panel (TRAINING MATCH during the fight)

Title beats take an optional `scene` line between the chapter and the title. A line beat with `thought: true` is an unspoken thought: a dashed bubble in italics, and the speaker doesn't animate. Stage directions can also `look` at an actor or a mark (a held head turn; `null` looks ahead again; a mark's third value is the height looked at), and `y` together with `walk` climbs or descends to that height over the walk (the gym's stair).

Timeline events can trigger full-screen effects with `fx`: `distort` (the picture slips), `whiteout` (the transfer), `silence` (all sound drains away) or `blackout` (a fade to black that holds until the next scene). Explore beats can set their own walkable `bounds`, record which hotspot was visited first (`firstVisit`), and hotspots can `sets` flags on arrival. A scene's `outfits` carry clothes over from earlier choices (Rookie's jacket from Scene 02).

**Camera**: named shots are static (`handheld: 0`), actor-relative shots hold still, and only tracking shots drift slightly. When the player picks a reply, Rookie says it in the shot the choice was made in.

**Body language**: when a line has no gesture, each character works through their own rotation of speaking poses (Rookie mostly still, the Don sometimes arms crossed, the scientist explaining), so hands aren't waving on every line. Nods, head shakes and held looks are procedural head turns layered over the current pose. They are built in world space and carried into the head bone's frame, so they work the same on the kit characters and the Mixamo models (whose bone axes differ). Held end poses (knocked down) loop their final frame at full weight rather than pausing, so a fighter rebuilt on resume or skip stays down, and getting up blends without a T-pose flash. Fighters use `guard` (hands up, the jab's first frame), `block` (a short cover-up), `duck` (a dip toward the crouch) and the punches. Held poses (`phone`, `sleep`, `palm`, `lean_rail`) stay put while the character speaks. A character with clips of their own can perform a gesture differently (`ACTOR_GESTURES` in `CharacterExpressions.ts`): Rookie's guard is a breathing loop, his block, duck and palm are his own clips, and gestures he has no clip for (arms crossed, lying down, getting up, picking up, sitting down) are left out of his scenes. If one is played anyway he holds his current pose.

Options can be conditional in the Ink (`+ {saw_permit} [It had a Downtown Gym permit on the dash…]`), so what Rookie can say depends on what he saw; Scene 03 keeps three options on every pick by pairing each conditional option with its opposite. Its three ways of handling the sedan are stitches (`= confront`, `= avoid`, `= trust`) that rejoin at `= collect`.

A `call` beat is an incoming phone call: the call card over the scene (caller, a line under it, Answer); the phone keeps buzzing until it is answered. Stage directions can put something in a hand with `carry`: `bag` (his gym bag, by the handles; `carry: null` drops it to the floor beside him, and `carry: bag` again picks up the one on the floor, even behind a cut) or `phone` (at his ear, with the `phone` pose). Props follow the bones every frame (`HandProps.ts`).

## Asset pipeline

**Rookie**, **both bodyguards** and **the Don** are complete rigged characters from Mixamo: Rookie ("Roddy", November 2026) is a character made low-poly for phones (8.3k triangles, one mesh, in a dark jacket), built on the Don's recipe: `art-source/rookie/rookie_rig.fbx` is the kit skeleton with weights hand-fitted to him and his arms-crossed clip, `rookie_mesh.glb` the textured game mesh fitted onto it, and the other files his Mixamo clips (downloaded for him on Mixamo's rig, retargeted onto the fitted skeleton); until a Mixamo "Walking" is downloaded for him he walks with the kit's walk. The suited Rookie before him is in `art-source/rookie/old-suit/` (with `rookie_14k.glb`, the last build of him), and the one before that, "Ch08", in `old-ch08/`; the bodyguards share "Ch18" (`art-source/alex/alex.fbx`, black tactical gear, cap and sunglasses), and the Don is a heavy-set generated character in a white three-piece suit (`art-source/don/kingpin/`), with Mixamo clips and a hand-made arms-crossed (see below; the previous Don, "Ch01" in a separately downloaded white suit, is `art-source/don/gaurd2.fbx` and `white-suit.glb`, still buildable as `don_ch01`). Mixamo characters and animations may be used in a game, but the raw files may not be redistributed on their own. Every other character and all other animations are **CC0** from Quaternius. The sources are in `art-source/quaternius/` with their licence files:

- [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html): body, hair, beard
- [Universal Animation Library 1 & 2](https://quaternius.com/packs/universalanimationlibrary.html): 27 clips (idle, walk, talk, punches, hits, knockdown, get up, sit, nod…)

| Command | Output |
|---|---|
| `npm run assets:characters` | `public/assets/models/character_kit.glb`: the body split into segments, plus generated clothing shells (tank, tee, hoodie, suit jacket with shirt, knee-length lab coat, trousers, shorts, shoes, hand wraps), hair, sunglasses and clear glasses. Needs Blender 4.2+ |
| `npm run assets:animations` | `public/assets/models/animations.glb`: skeleton plus clips only, with quantised rotations (about 930 KB; 29 clips, including the crouch used for the duck) |
| `npm run assets:models` | `public/assets/models/rookie.glb` (1.1 MB), `alex.glb` (1.5 MB) and `don.glb` (0.9 MB): the characters with textures reduced to 1–2K WebP (Rookie's 4K maps to 1K) and meshes held to the phone budget (`scripts/simplify-character.mjs`: Rookie is made at 8.3k and passes through; the Don and the bodyguards are reduced to 10k; their full-detail builds are kept in `art-source/models-full/`); Rookie and the Don with their own clips, the bodyguards with every clip retargeted from the Quaternius libraries onto their skeleton (see below). Needs Blender 4.4+ |
| `npm run assets:avatar` | HUD portrait rendered from the 3D Rookie |
| `npm run assets:cars` | The cars in `public/assets/models/environment/` (`sedan`, Rookie's and the default traffic; `sedan_sports`, the grey car at the rail yard; `suv`, Victor's people; `taxi` and `van`, traffic), about 40 KB each, from [Kenney's Car Kit](https://kenney.nl/assets/car-kit) (CC0, unzipped in `art-source/kenney-car-kit/`) by `scripts/blender/build_cars.py`: each body is stretched to real-car proportions with the wheels kept round, the front turned to the sets' −X, and the kit's single swatch texture replaced by real materials (glossy paint, smoked glass, headlamps, tail lamps, trim, tyres, alloys) chosen face by face from the swatch each face used. The old scripted sedan is in `legacy/old-sedan-2026-11-10/` |
| `npm run assets:menu-cast` | (Not used by the menu since the key art replaced it.) A cast lineup, `public/assets/ui/menu_cast.webp` (`scripts/blender/render_menu_cast.py`): Rookie in front with his arms folded, Victor and Lucas either side, two of Victor's men behind, rendered in Blender from the game's own models (`art-source/models-uncompressed/`) on a transparent background and lit to match the dusk backdrop. Needs Blender 4.2+ and `cwebp` |
| `npm run assets:menu` | (Not used by the menu since the key art replaced it.) A drawn backdrop, `public/assets/ui/menu_city.svg` (`scripts/build-menu-art.mjs`): the city at dusk in flat, faceted shapes, a water tower on the left roof and the organisation's crown sign on the right, seeded so it comes out the same each time. The logo itself is drawn inline (`MenuLogo.tsx`) in the display font |
| `npm run assets:audio` | Synthesised music, ambience and sound effects in `public/assets/audio/` (WebM/Opus with an MP3 fallback) |
| `npm run voices` | Character voices, `public/assets/audio/voice/<speaker>/` (WebM/Opus and MP3; a device downloads one, 5–8 MB for the chapter, streamed line by line), listed for the game in `src/story/voices.json`. See **Voices** below |
| `npm run assets:mobile` | Phone-sized variants (`scripts/make-mobile-assets.mjs`): `public/assets/models/mobile/` (the character models with colour maps at most 1024 px and normal maps at 512, the kit at 512) and `public/assets/textures/environment/512/` (set surfaces for the Battery tier). A 2048² colour map is about 21 MB of GPU memory. `assets:characters` and `assets:models` run it on what they rebuild |
| `npm run assets:compress` | Meshopt-compresses every runtime GLB (and turns embedded JPEG/PNG into WebP); already-compressed files are skipped. The character commands above run it on what they write. The uncompressed file is kept in `art-source/models-uncompressed/` for Blender (which can't read meshopt), e.g. the avatar render |

Scene 02's and 03's sets (Rookie's room, the night drive, the facility entrance, the research facility with the Chronos machine, and the avenue one year earlier) are built the same way. `ChronosExperiment.ts` adds the human-trial hardware to the chamber (the safety cage, the prep cart, the return rack, the countdown board, the light flicker); `TimelineExploration.ts` is the past; `ExperimentState.ts` holds the experiment's facts and the conditions later scenes use. The drive is a treadmill: the car stays put and the street scrolls past, so every camera is a fixed shot. The machine is driven by a single energy level (ring speed, glow, particles, light) plus pulse and payload events.

The gym (with its viewing deck and stair), the gym's street front and the estate are built in code from primitives and canvas-painted textures (`ProceduralTextures.ts`). The estate (`EstateExterior.ts`) isn't used by any scene since Scene 01 now opens at the gym; it stays registered, and is only downloaded if a scene asks for it. To replace a set with an authored Blender GLB, load it through `AssetLoader.loadContainer` inside that environment's factory. The marks, shots and events it exposes stay the same.

**Complete models** (`CharacterDef.model` in `CharacterAssets.ts`) bring their own meshes, materials and clips instead of being dressed from the kit. `scripts/blender/build_character.py` builds them from Mixamo FBX files downloaded with skin; each character is an entry in its `CHARACTERS` table (source file, meshes to keep or drop, whether the FBX's own clip is a talking loop). To add one, add an entry, add its name to `assets:models` in `package.json`, and set `model` on its `CharacterDef`. The recipe: the bones are renamed to the kit's names (`pelvis`, `spine_01`, `hand_r`, `Head`…), so nods, look-ats and effects keep working, and each Quaternius clip is retargeted in world space, with the hips scaled to the new leg length. Clips where a hand touches the body (`CONTACTS`: the phone at the ear, arms crossed) get a two-bone arm solve, because Mixamo arms are shorter than the mannequin's and copied rotations alone stop short. A character can instead bring all its clips from Mixamo (`clips` in its entry, as Rookie does): each game clip names a downloaded FBX (made for the same uploaded character, so the skeletons match) and a frame range, and nothing is retargeted. Options per clip: `loop` eases the last frames into the first; `travel` shortens how far a lunge carries the hips and feet across the floor (each foot moves the same fraction of its path, with a two-bone leg solve, so planted feet stay planted; the fighters stand a metre apart); `in_place` and `pace` take the drift out of a walk and retime it to the game's walking speed so the feet don't slide. `head_height` scales a model to size (Rookie's FBX is 1.16 m tall). His palm-on-the-scanner pose has no Mixamo clip: it is built from the idle with the left wrist solved onto a fixed point (`palm`), and the build logs where the palm lands for `PALM` in `FacilityEntrance.ts`. To swap one of his clips, drop the new FBX in `art-source/rookie/`, point its entry at it with the frames to use, and run `npm run assets:models` (or just the rookie: see the command in `package.json`). Several actors can share one model (both bodyguards use `alex.glb`). A character can also wear a separate, unrigged outfit (`outfit` in its `CHARACTERS` entry, see `dress()`): the outfit is scaled so its collar sits around the neck, its heights below the neck are remapped onto the skeleton's hip, knee and ankle, the limbs are posed to the outfit's A-pose, each piece is weighted by distance to the nearest bones and then un-posed into the T-pose rest, and the shirt, trousers and jacket lining are cut away wherever the jacket covers them. Only the character's head and neck are kept; the gloves and shoes are the hands and feet. The suit's normals are carried through every step (moving vertices alone would leave the imported normals pointing the old way). **The Don** is built on a rig made outside Mixamo (`mesh_from` in his entry), because Mixamo's automatic skin weights crush his jacket sleeves when his arms fold. `art-source/don/kingpin/kingpin_rig.glb` is a kit skeleton with weights hand-fitted to his build and his arms-crossed clip (saved out of `idle_foldarms_loop_fit.glb`, its mesh welded and cut to 75k vertices, only read for its weights). The build scales the game mesh (`king_source.glb`, 20k triangles, whose textures were saved out as `king_*.png` because the Mixamo FBX doesn't embed them) to the rig mesh's height, copies each vertex's weights from the nearest point of the rig mesh, and drops the rig mesh. His Mixamo clips (`cross`) are retargeted onto that skeleton in world space; his walk is one stride cut from "Start Walking" (he has no walking loop), retimed to his own slower walking speed (`ACTOR_PACE` in `CharacterExpressions.ts`). `hands` on a clip re-aims hands after the fact: in his arms-crossed the hand underneath is tucked into his chest and the top hand rests on the other arm in view. A model with its own clips does only what they cover (`ACTOR_GESTURES`): the Don stands, talks, folds his arms and walks.

A complete model's outfit is fixed: Rookie wears his jacket in every scene, so the training tank and wraps and the Scene 02 jacket or hoodie don't show (the choices are still stored).

**Known limits of the CC0 art:** every character shares one male head mesh. They are told apart by skin tone, hair, beard, build, clothing and sunglasses, and there are no facial expressions (emotion comes from body gesture and camera framing). The clothing is generated geometry, not sculpted cloth; the lab coat's skirt is skinned partly to the thighs, so it bends with the legs rather than swinging. Commissioned characters can be dropped in by matching the bone names in `CharacterAssets.ts`.

### Voices

Every spoken line is voiced: what each character says, the question a choice is asked with, the line Rookie says back after a pick (every dialogue option has its own recording), and his asides when he looks at something. Thoughts stay silent. The music dips while someone speaks; Settings has a Voices volume.

`scripts/build-voices.mjs` finds the lines by playing each scene's story through 1,500 random routes, so lines that change with the story (an amount, a name) are caught in every form; each recording is named by its speaker and exact words (`src/game/audio/voiceKey.ts`), so a reworded line plays silent until it's voiced again, and only that line is redone.

- **Kokoro** (free, runs on this machine, nothing is sent anywhere) voices them: `cd tools/kokoro && npm install` once (kept apart from the game's dependencies; the 90 MB model downloads on first use into `tools/kokoro/.cache`), then `npm run voices -- --generate`. About 7 minutes for the chapter's 372 lines.
- **Casting** is in `src/story/voices.cast.json`: each character's brief and Kokoro voice, either one of Kokoro's or a blend of several (`mix`, by weight; Kokoro has few good male voices, and blends give each man his own), with an accent and a speed. `npm run voices -- --audition` writes one line per character to `art-source/voices/auditions/` to compare them; after recasting someone, `npm run voices -- --redo=victor --generate`.
- **Real recordings** replace generated ones line by line: `art-source/voices/scripts/<speaker>.md` is each character's script sheet (brief, every line with what's said just before it, the file name to use); drop the files (wav, m4a, mp3, webm) in `art-source/voices/inbox/` and run `npm run voices`. Takes in `art-source/voices/takes/` are the masters; each is trimmed of silence, levelled to −16 LUFS and converted. `--prune` moves takes no current line uses to `art-source/voices/unused/`.

## Mobile (Capacitor)

The same build runs as an Android and an iOS app (`capacitor.config.ts`, `android/`, `ios/`): portrait only, status bar hidden, screen kept on during play (`src/platform/native.ts`).

```bash
npm run mobile:sync      # build, copy dist/ and plugins into both projects, drop the Android build's MP3s (it always plays the WebM)
npm run mobile:android   # …and open Android Studio (needs JDK 21)
npm run mobile:ios       # …and open Xcode
```

## Testing

With `npm run dev` running:

```bash
node --import ./scripts/lib/ts-resolve.mjs scripts/check-ink.mjs        # every scene's Ink against its staging, and no staged beat the script never names (no browser)
node --import ./scripts/lib/ts-resolve.mjs scripts/check-economy.mjs    # thousands of random routes through all four scenes: every route promoted on time, the ledger accounts for every change, cash never negative, each prep pick plays its own beats (no browser)
node --import ./scripts/lib/ts-resolve.mjs scripts/migration-test.mjs   # save migration to v5 (once only, nothing else touched) and the store's per-job ledger (no browser)
UW_UNTIL=s02 node scripts/playthrough.mjs http://localhost:5173 out 0   # the whole first session: Scene 01, its debrief, Scene 02, its debrief (logs each debrief's numbers)
npm run test:e2e        # plays the whole scene in headless Chrome at 390×844, screenshots every beat, fails on console errors
UW_SCENE=s02 npm run test:e2e        # Scene 02, from a save with Scene 01 complete
UW_SCENE=s03 npm run test:e2e        # Scene 03, from a save with Scenes 01 and 02 complete
UW_SCENE=s02 node scripts/playthrough.mjs http://localhost:5173 out 2   # third arg picks option 0/1/2 at every choice
UW_SCENE=s02 npm run test:resume     # Scene 01 choices carry over; reload mid-reply at the door on Hollis Hill
node scripts/playthrough.mjs http://localhost:5173 out 1    # third arg = which option to pick at every choice (0/1/2)
npm run test:resume     # Lucas's challenge, jump to Victor watching, reload → Continue → verifies beat, choices, vars, set, positions and the fighters' state
node scripts/shoot-beats.mjs out b2_choice b4_deck   # jump to beats and screenshot (UW_RENDERER=webgl2, UW_VIEWPORT=1440x900)
UW_SCENE=s02 UW_CHOICES='{"pickup":"friendly"}' node scripts/shoot-beats.mjs out s5_r_friendly   # a given option's reply
UW_WAIT=450 UW_URL=http://localhost:5174 node scripts/shoot-beats.mjs out b3_finish   # shoot 0.45 s into the beat, from another dev server
```

Loading and streaming (against `npm run build && npm run preview`, which is what players download; the dev server sends Babylon unminified, about 25 MB):

```bash
npm run measure:load                                   # Play → first beat, requests and bytes (title screen / loading / first seconds of play), main-thread stalls
UW_THROTTLE=fast4g UW_INSTANT=1 npm run measure:load   # on a phone connection, tapping Play before the title screen has warmed anything
npm run test:walks                                     # every explore walk (to each place, and between places) cast against the sets' real geometry at knee and waist height: fails if any passes through something (against preview on :4174)
npm run test:transition                                # Scene 1 → Scene 2 in one session: switch time, files still downloaded, GPU resources vs a fresh Scene 2 (leaks)
npm run test:soak                                      # long play: every scene again and again in one page; fails if GPU resources, meshes, materials, files or the JS heap keep growing after a warm-up cycle
UW_TIER=low node scripts/soak-test.mjs 9               # the same on another tier (lite | low | high), for more cycles
UW_URL=http://localhost:4173 node scripts/measure-lowend.mjs 1        # per beat on phone settings: draw calls, triangles, texture memory, heap (budget: 150 draws)
UW_QUALITY=lite UW_URL=http://localhost:4173 node scripts/measure-lowend.mjs 1   # the same on a given tier
```

The scripts use the `?test` debug hook (`window.__underworld`) and the installed Google Chrome. Jumping to a beat replays the scene's Ink from its start, taking any options preset with `UW_CHOICES` (otherwise the first on offer) and skill results preset with `UW_FLAGS` (otherwise a pass).
