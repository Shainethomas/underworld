# Underworld: design writeup

**Play:** https://shainethomas.github.io/underworld/ (one click, runs in the browser on desktop or a phone) · **Code:** https://github.com/Shainethomas/underworld

**Fastest look at the core loop (2 minutes):** New Game → play Scene 01 (about 4 minutes), or skip it: after Scene 01's debrief, open **Tonight's Work** on the title screen, take a contract, and play it (60–90 seconds). Then press **Playtest: skip to tomorrow** at the foot of the board to see what the day-1 hook delivers the next morning.

---

## 1. The pitch

**Underworld is a mafia rise you play in 90-second jobs, by reading people.** You're a young fighter taken in by Victor Sable's organisation. Every night there's work: collect a debt, recover a shipment, lean on a councillor. Every job comes down to a conversation with someone who's greedy, scared or proud, and the one thing that matters is whether you read them right.

- **Who it's for:** players of story-choice games (Telltale-style drama, interactive fiction, "choices" apps) who want their choices to be a *skill*, not just a branch. They're mobile-first and play in short sessions, in portrait, one-handed.
- **Why play it:** the fantasy (starting at the bottom of a crime family and being noticed) plus a skill that's easy to start and satisfying to master (reading people). It's played in real-time 3D with voiced cast, cinematic cameras and short fights, so each job feels like a scene from a crime drama, not a text menu.

## 2. Core loop and first session

### The core loop (one contract, about 90 seconds)

```
Job card ─► Prep ─► Look round ─► Two rounds of talk ─► (Fight) ─► Debrief
 who/pay/    muscle   find          press / charm /       if the     cash, Respect,
 risk        quiet    leverage      threaten              read was    grade, and
             homework                                     wrong       what you got wrong
```

The heart of it is one rule table:

|  | Press (facts, numbers) | Charm (calm, respect) | Threaten (force) |
|---|---|---|---|
| **Greedy** | best | OK | backfires |
| **Scared** | OK | best | backfires badly |
| **Proud** | backfires | OK | best |

In numbers: best +2, OK 0, backfires −2 (threatening a scared man −3). Two rounds add up: 4 or more is a clean deal, 0 to 3 a deal at a discount, below 0 a fight.

Every contact is one of the three, and **the writing gives it away**: the greedy man talks prices, the scared one apologises and watches the door, the proud one tells you who he used to be. Each reply Rookie can say is one of the three tactics. Each reply is labelled with its tactic (press, charm or threaten), so the player always knows *what* they're doing. *Who* they're doing it to is the read. It takes two good reads to make a clean deal. Get it wrong and his muscle steps in, and it becomes a timing fight that pays less than the deal would have. Prep changes the maths: **quiet** (watch first) gives leverage that makes pressing stronger, **muscle** makes threats land harder but draws Heat, and **homework** buys a tip that names the temperament for a quarter of the pay. That makes homework the training wheels: new players buy it, and good readers stop paying for it. What you find while looking round is leverage the "press" lines use.

Why it's fun: it's a **social deduction puzzle in miniature**. The first time, you're guessing. By the third contract, you're reading a line and smiling because you know exactly who this man is. The debrief closes the loop by teaching: *"He was scared. You threatened, then charmed. Charm is what works on a scared man."* Being wrong is interesting (a fight, a grudge, a morning message), not a fail screen.

### Balance: checking the loop is a skill, not a guess

A reading game is only fun if reading matters, so I tested that with a solver before trusting a playtest (`scripts/check-contracts.mjs`). It plays every plan a player could follow *without* reading anyone: a fixed prep, an opening tactic, and a round-2 reply chosen from how the contact reacted. The first balance pass failed badly. **"Bring muscle, look round, press. If he bristles, threaten" got a clean deal on all three temperaments**, so reading people was worth about 10% of the payout. Two more problems showed up: winning a fight paid exactly as much as a clean deal, and the free homework tip named the answer.

The fix kept all 21 written contracts valid (every written reaction still matches its sign):

| How you play | Value vs. a good reader (old) | (now) |
|---|---|---|
| Read each contact yourself | 100% | 100% |
| Always buy the tip (homework) | 88% | 74% |
| Never read; adapt after round 1 | **90%, clean deal on every type** | 65% |
| Same two replies every time | 87% | 65% |

The ladder is now *guessing < paying for the word < reading him yourself*. The validator enforces it on every build: if any blind plan clean-deals more than one temperament in three, it fails. The same pass caught a real bug. Ink parsed `k_pay * 6 / 10` as `k_pay * (6/10)`, which is 0, so every "deal at a discount" had been paying **$0**. Now the validator checks the exact payout of all 108 routes in every contract.

### The first session (about 10 minutes)

1. **Scene 01, The Unexpected Call (about 4 min):** Rookie arrives late at the gym. Lucas has money on a sparring match against Marco, and Victor is watching from the deck. Dialogue picks, a prep card, then the fight as timing taps. Debrief: the first cash, Respect and a grade. That night a rival crew calls Rookie's own number.
2. **The board opens:** three street jobs at three places (the docks, a big house on the hill, the rail yard), each with a different temperament on night one, so a new player meets all three types.
3. **Play one or two contracts:** the player learns the read, levels toward the next rank (Runner at 100 Respect), and sees locked options in the story ("Needs Respect 130") that the board can open.
4. **End of session:** the debrief says *"Whatever you left behind out there, you'll hear about it in the morning,"* and the board shows the countdown to tomorrow's jobs.

## 3. Progression and metagame

### The day-1 hook (built)

Three reasons to come back tomorrow, all live in this build:

1. **A new board every night.** Three new contracts at local midnight, with a countdown on the board. Three a night is a deliberate cap: it's a nightly ritual, not a grind.
2. **The morning messages.** Every contract leaves something behind, and it arrives the next day with a real effect. Sal pays the rest of what was owed (+$60). The kid you were kind to tells you Sal kept him on, and he won't forget it (+5 Respect). Varga's people warn you off (Heat +10). The game remembers what you did, and returning pays off straight away.
3. **Heat cools overnight.** Threats and fights draw Heat. Heat 30+ locks the best-paying jobs ("Too hot. Lie low until tomorrow"), and the **story** reads the same number: Calder Yard charges a cleanup fee at 30+, and watchers wait at Mercer House at 25+. Lying low before a big story job is a real choice, and tomorrow is when you're cool again.

Plus a light streak: **nights worked in a row** (the third and seventh earn Lucas's word and a Respect bonus). It's soft on purpose. A missed night resets it quietly, with no penalty screen.

### What keeps people playing for months (proposed)

- **The story spine:** chapters of hand-authored, voiced, 3D story (Chapter 1 has four scenes here). The board's Respect and cash feed the story's locked options, and story outcomes change the board (owning Calder Yard ends Chapter 1).
- **Rank and territory:** Rookie → Runner → Associate → Soldier → Capo. From Soldier, you **own rackets** (Calder Yard is the first) that pay daily and can be taken by the Varga crew if you neglect them. That's the long-term "power" fantasy and a daily reason to check in.
- **Recurring people:** contacts remember you. The scared kid you went easy on becomes an informant; the proud man you humiliated comes back with a crew. The temperament system extends naturally to more types later (loyal, desperate, clever), once players have mastered three.
- **Crew:** recruit the people you read well onto your crew, each with a passive (a good-reader tip, cheaper prep, lower Heat).

## 4. Money (without feeling like a cash grab)

- **Premium chapters.** Chapter 1 is free and complete. Later chapters are bought one at a time, or as a **season pass** that includes everything released that season. Story is the content people pay for in this genre, and paying once for a chapter feels fair.
- **Cosmetics:** Rookie's outfits, cars and the look of owned rackets. These are visible in the 3D scenes, and they're purely cosmetic.
- **Optional rewarded ads** in the free tier, for a small cash top-up or a quicker Heat cooldown (never extra contracts, and never story content).
- **What it won't do:** no energy timer on the story, no pay-to-win stats, no paid answers to the reading puzzle, no loot boxes. The board's three-a-night cap is a design choice for session length, not a paywall, and there's no way to pay for more contracts.

## 5. AI: how it's built, and AI in the game

### Building it

- **Code:** the game (React and TypeScript UI, an Ink story runtime, a Babylon.js 3D renderer, a Blender asset pipeline, Capacitor mobile apps) was built with **Claude Code** as the main pair programmer: architecture, implementation, performance work on a low-end Android phone, and automated testing (headless-Chrome playthroughs that play every scene and screenshot every beat).
- **Voices:** every spoken line in the story (about 370) is voiced by **Kokoro**, an open text-to-speech model that runs locally. A script finds every line by playing each scene through 1,500 random routes, then casts and generates each character's voice.
- **Contract writing:** all 21 contracts on the board were **written by an AI model (Claude) from a spec** (`src/story/contracts/SPEC.md`). Several writers ran in parallel, one per location.

### AI in the game: "AI writes, rules decide"

The design question I cared most about: **how do you put generated content into a game without it becoming unfair, inconsistent or unsafe?** The answer here is a split:

- **The AI writes the people:** the situation, the contact's personality, every line, the clues, Rookie's three replies per round, and the morning-after messages.
- **The rules decide the outcomes:** the temperament table, leverage, Heat and pay are fixed code (`contract.ink`). The AI can't hand out money or make a bad read work. That keeps the game fair and learnable.
- **A validator gates everything** (`npm run test:contracts`). Each contract is played through every route (3 preps × 9 pairs of tactics × winning or losing the fight × looking round or not = 108 routes). The validator checks that the outcome is the one the rules give, that pay stays within the card, that every route ends with a morning message, that the meta and the script agree, and that the writing stays in bounds (lengths, no markup, only the allowed speakers). A generated contract that breaks the rules can't ship.

**Why pre-generated for this prototype, not live:** it's reviewable (every line was read), it's free to run, it works offline, and it has zero latency. The architecture is built to go live, though: a contract is a small structured document (JSON plus a short script) that a model can write and the validator can check in under a second. **The live version:** each night, generate that player's three contracts from their history (who they've met, who they've crossed, their Heat), validate them, and fall back to the pre-written pool if anything fails. That gives an endless, personal board where the people remember you, for about the cost of three short generations per player per day.

**Where AI goes next in the game:** in this genre, the most valuable thing an LLM can do is **play the other side of the conversation**. The table becomes the scoring rubric, and the model judges which tactic Rookie's reply amounts to and voices the contact's reaction in character. The player still picks from three replies (written live for this person and this moment), so the skill stays readable.

## 6. Shipping: what I'd test, kill criteria, soft-launch numbers

**What I'd test first:**
1. **Is reading people fun on its own?** Paper-test 10 contracts with 8–10 genre players, with no 3D. Can they tell the three types apart by the third contract? Do they *want* the fourth? If players can't read the types, the writing is the problem. If they can and don't care, the loop is the problem. Instrument it as the share of clean deals without homework on contracts 1, 3 and 6. The solver says pure guessing gets one in three, so anything near 33% means nobody is reading.
2. **Time to first decision and first fight** in Scene 01, on a mid-range Android phone, with first-time players. (Already trimmed once for this build.)
3. **Board versus story:** do players open the board after Scene 01 without being told, and do they understand that it feeds the story?

**What would make me kill it or change direction:**
- Players can't learn the read even after the debrief explains it: the core skill is too opaque. *Change:* more readable types and stronger tips, or drop to two types.
- Players learn it and get bored by night three: the loop is solved too fast. *Change:* add new types, mixed temperaments, and contacts who lie about what they are.
- People play the story and ignore the board: the D1 hook isn't the board. *Change:* fold contracts into the story itself as side jobs between scenes, and lean on the story cliffhangers.
- Day-1 retention under ~25% after fixes, in a genre that usually does better: the fantasy or the first scene isn't landing.

**The numbers I'd watch at soft launch:**
- **Day-1 and day-7 retention.** D1 is the board's job; D7 is the morning messages and streak.
- **Funnel:** Scene 01 completed → board opened → first contract finished → second session within 24 hours.
- **Read accuracy over time:** the share of "best" tactics picked on nights 1, 3 and 7. It should rise and then plateau below 100%, which shows the skill is learnable and not solved.
- **Contracts per daily active user,** and the share of players who use all three.
- Later, for money: **conversion to the first paid chapter** among players who finished Chapter 1.

## 7. Reference games

> **To fill in:** what you actually played and pulled apart. The structure below shows how each reference shaped a specific decision, so swap in your own games and observations. The examples are only prompts.

| Game | What I borrowed | What I did differently |
|---|---|---|
| *(a Telltale-style choice drama)* | Cinematic dialogue, and "they will remember that" | Choices are a **skill** with readable rules, not just branches |
| *(a "choices" / interactive-story app)* | Chapter-based premium story, mobile portrait, short sessions | No energy gate on the story; the board is the daily loop |
| *(a swipe-decision game like Reigns)* | One decision at a time, with a few numbers that matter | Decisions are about **people**, and their personality is the puzzle |
| *(a mafia management or idle game)* | Rank ladder, rackets, rival crews, daily collection | Power is earned through scenes and reads, not timers |
| *(a detective or social-deduction game)* | Reading tells from dialogue | Compressed into 90 seconds and two replies |

---

### For reviewers: where things are in the code

- The board and day rules: `src/game/board/Board.ts`. The board's interface: `src/components/menus/BoardSheet.tsx`.
- The contract rules (the "rules decide" half): `src/story/contracts/contract.ink`.
- The AI writing brief: `src/story/contracts/SPEC.md`. The contracts: `src/story/contracts/c_*.ink` and `.json`.
- The validator: `scripts/check-contracts.mjs` (`npm run test:contracts`).
- The story: `src/story/scene0*.ink` (Ink), with staging in `scene0*.staging.json`. Architecture: `ARCHITECTURE.md`.
