# Street work: the contract spec

Contracts are the short jobs on Lucas's board, three a night. They are **written by an AI model from this spec**, and nothing ships until `npm run test:contracts` (`scripts/check-contracts.mjs`) passes it. The model writes the words. The rules in `contract.ink` decide what happens. This file is the brief the model gets, and it holds for anyone writing a contract by hand.

## The world

A night-time city, noir but not grim. Rookie is a young fighter who has just started working for **Victor Sable**'s organisation. **Lucas** is Victor's go-between and Rookie's handler. A rival outfit, the **Varga crew**, is moving in on Victor's streets. Street work is small and local: debts, pickups, a word in someone's ear, a favour called in. The tone is terse and dry, with British-ish phrasing ("half ten"). The people are adults with jobs and problems. Threats are implied, never gory. No slurs, no sexual content, no real brands or places.

## A contract is two files

`c_<kit>_<nn>.json` is the card on the board and the cast:

```json
{
  "id": "c_docks_03",
  "kit": "docks",
  "title": "Cold Storage",
  "client": "Lucas",
  "risk": "Medium",
  "pay": 600,
  "respect": 20,
  "mood": "scared",
  "pitch": "One sentence, under 140 characters: who, what, and why it's Rookie's problem.",
  "cast": { "contact": "kid", "heavy": "heavy2" },
  "names": { "contact": "Pip", "heavy": "Marek" },
  "hotspots": {
    "contact": "Pip",
    "clue_a": { "label": "The containers", "lines": ["What Rookie learns looking here: leverage he can press with."] },
    "clue_b": { "label": "The water's edge", "lines": ["A second fact he can use."] }
  }
}
```

`c_<kit>_<nn>.ink` holds the words. Copy the shape of `c_yard_01.ink` exactly: the same beat IDs in the same order, the same functions and the same branches. Change only the words and the numbers.

## The fixed shape

1. `~ k_start("<mood>", <pay>, <respect>)` and `~ temp r = 0`. These must match the meta.
2. `>>> title k_title`
3. `>>> job k_job [<title>] <client> ¦ $<pay> ¦ <risk> ¦ <objective>`. Must match the meta.
4. `>>> card k_prep [How do you play it?] <one line>`, then exactly three options tagged `#muscle`, `#quiet`, `#homework`, each calling `k_prepare` with its own tag.
5. `{ k_prep == "homework": >>> message k_tip [<Sal or Lucas>] <tip> }`. **The tip names the contact's temperament in plain words** (greedy: "talk money"; scared: "go easy, he spooks"; proud: "he only respects a hard man"). The rules charge a quarter of the pay for it, so the tip is the safe, cheaper-paying way to play.
6. `>>> shot k_arrive [<place>] <time and one detail>`. The place is the kit's: Calder Yard, Pier Nine or Hollis Hill.
7. `>>> explore k_explore <prompt>`
8. `CONTACT: … #k_open` (the greeting), then `CONTACT: … #k_talk1` (round 1's question), then three options tagged `#press`, `#charm` and `#threaten`. Each does `~ r = k_say(1, "<tactic>")`, then the contact's reaction: `#k_good` if it helps, `#k_bad` if it backfires. A `{ r >= 2: … - else: … }` split is welcome for the best tactic.
9. `CONTACT: … #k_talk2` (round 2), the same with `k_say(2, …)`.
10. `~ k_settle()`, then the three outcomes as in the exemplar:
    - `deal`: the handover line (`#k_hand_cash` or `#k_hand_package`), `~ k_payout("<what was collected>")`, `~ k_morning(...)`
    - `short`: a grudging handover line, `k_payout`, `k_morning`
    - else, the fight: `>>> shot k_heavy_in`, `HEAVY: … #k_heavy`, both `qte` lines, `~ k_won = k_counter >= 0.5`, the won or lost shot plus a `CONTACT: … #k_after_fight` line, `k_payout`, and a `k_morning` for won and for lost
11. `>>> shot k_leave`, `>>> complete k_complete`, `-> END`

High-risk contracts may add `~ earn("v", 5, "<reason>")` in the fight branch, when the muscle is Varga's.

## Writing people (this is the game)

The player wins by **reading the contact**. Every contact is one of three types, and their lines must show it without naming it:

| mood | How they talk | Works best | Backfires |
|---|---|---|---|
| greedy | prices, cuts, haggling, "a man has to eat" | **press**: facts, numbers, what he stands to lose | threaten |
| scared | nervous, apologetic, eyes on the door, over-explaining | **charm**: calm, reassurance, a way out | threaten (badly) |
| proud | boasts, his history, contempt for kids | **threaten**: stand up to him, call his bluff | press |

The third tactic (charm on a greedy or proud man, press on a scared one) is *fine*: it keeps the talk going but earns nothing (0). Its reaction should be neutral ("All right."), never warm. A clean deal needs the best tactic in **both** rounds, so the tells in `k_open` and `k_talk1` must be enough to read him before the first reply.

- The three options in each round must sound like their tactics. **Press** is reasoned and specific, using what the clues revealed. **Charm** is warm and lets him save face. **Threaten** is blunt. Each is under 90 characters.
- Reactions are short and in character. A greedy man threatened gets stubborn. A scared man threatened panics. A proud man pressed with facts takes offence.
- Clue lines are **leverage**: facts Rookie can press with. Ideally the round-1 press option uses one.
- Lines are under 160 characters and speech, not prose. No stage directions, and no `{ } | < > _ *` in anything the player reads.

## Numbers

| risk | pay | respect | notes |
|---|---|---|---|
| Low | 200–400 | 10–15 | on the board from the first night |
| Medium | 500–800 | 20–25 | |
| High | 900–1400 | 30–40 | needs Runner rank, and can't be taken at Heat 30+ |

Morning messages (`k_morning(from, text, fx)`) are what the player wakes up to. The sender is the contact, Lucas, Sal or "Unknown number". The text is under 120 characters. `fx` is `""`, `"c<n>"` (cash, at most a third of the pay), `"r<n>"` (Respect 5–10), `"h<n>"` (Heat 5–10) or `"t<n>"` (Lucas's trust 5). A clean deal brings a small bonus or favour, a short deal a grudge, a won fight a reputation, and a lost one Heat.

## Cast and kits

Contacts: `fence` (older man, camel coat), `dealer` (sharp navy suit), `kid` (young, red track top), `widow` (older woman, long dark coat, glasses). Heavies: `heavy` (black leather bomber), `heavy2` (bearded, green tee). Use fresh names, matched to the actor. Story characters (Victor, Lucas, Sal, Nico, Marco) never appear on screen; Lucas and Sal can send the tip or the morning message.

- `yard`: **Calder Yard**, the old rail yard. Clue spots: the boxcar, the burned-out van.
- `docks`: **Pier Nine**, a warehouse on the quay. Clue spots: the shipping containers, the water's edge.
- `estate`: **Hollis Hill**, a big house up a drive. Clue spots: the fountain, the car parked by the house.
