// Street work: the rules every contract on Lucas's board shares. Each
// contract (src/story/contracts/c_*.ink) INCLUDEs ../globals.ink and this file.
//
// The words of a contract are AI-written (see SPEC.md); the outcome is not.
// A contract is: a job card, one prep pick, a look round, two rounds of talk
// with the contact, and — if the talk goes wrong — a fight with his muscle.
//
// Reading people is the skill. Every contact has a temperament (k_mood) that
// the writing hints at, and every reply Rookie can give is one of three
// tactics. How a tactic lands on a temperament is this fixed table:
//
//               press (deal, facts)   charm (respect, calm)   threaten (force)
//   greedy            +2                      0                    -2
//   scared             0                     +2                    -3
//   proud             -2                      0                    +2
//
// Two rounds add up (with the bonuses below) to: 4 or more, a clean deal;
// 0–3, a deal at a discount; below 0, it turns into a fight.
//
// Balance (2026-11-27, scripts/check-contracts.mjs proves it on every route):
// a clean deal takes reading him right twice. A "fine" reply keeps the talk
// alive but earns nothing, so no tactic is safe on everyone, and no blind
// opening (probe, then react) gets a clean deal on more than one temperament
// in three. Homework names the temperament but costs a quarter of the pay,
// and only a deal read without it earns the cold-read Respect, so the ladder
// is: guessing < paying for the word < reading him yourself. A won fight pays
// less than a deal, so a bad read always costs something.

VAR k_mood = ""
VAR k_pay = 0
VAR k_respect = 0
VAR k_heat0 = 0
VAR k_prep = ""
VAR k_clue_a = false
VAR k_clue_b = false
VAR k_score = 0
VAR k_talk1 = ""
VAR k_talk2 = ""
VAR k_reads = 0
VAR k_outcome = ""
VAR k_guard = 0
VAR k_counter = 0
VAR k_won = false
VAR k_after = ""

// Clears the last contract and sets this one up: the contact's temperament,
// and what the job pays in cash and Respect when it goes clean.
=== function k_start(mood, pay, resp) ===
~ ledger = ""
~ job_grade = ""
~ k_mood = mood
~ k_pay = pay
~ k_respect = resp
~ k_heat0 = heat
~ k_prep = ""
~ k_clue_a = false
~ k_clue_b = false
~ k_score = 0
~ k_talk1 = ""
~ k_talk2 = ""
~ k_reads = 0
~ k_outcome = ""
~ k_guard = 0
~ k_counter = 0
~ k_won = false
~ k_after = ""

// The prep pick. muscle: threats land harder, but people see the car.
// quiet: he's watched before he's met (leverage, and threats cost no Heat).
// homework: someone tells him what the contact is like (the contract's tip).
=== function k_prepare(how) ===
~ k_prep = how
{ how == "muscle":
    ~ earn("h", 5, "Brought a crew. People saw the car")
}

// What Rookie found while looking round counts as leverage when he presses.
=== function k_leverage() ===
~ temp n = 0
{ k_clue_a:
    ~ n = n + 1
}
{ k_clue_b:
    ~ n = n + 1
}
{ k_prep == "quiet":
    ~ n = n + 1
}
~ return n

// How a tactic lands on this contact (the table above).
=== function k_land(tactic) ===
{
- k_mood == "greedy":
    {
    - tactic == "press":
        ~ return 2
    - tactic == "charm":
        ~ return 0
    - else:
        ~ return -2
    }
- k_mood == "scared":
    {
    - tactic == "charm":
        ~ return 2
    - tactic == "press":
        ~ return 0
    - else:
        ~ return -3
    }
- else:
    {
    - tactic == "threaten":
        ~ return 2
    - tactic == "charm":
        ~ return 0
    - else:
        ~ return -2
    }
}

// One round of talk: scores the tactic, with what he brought to it.
// Returns how it landed (2 read him right, 0 fine, below 0 backfired), so
// the contract can pick the contact's reaction.
=== function k_say(round, tactic) ===
~ temp land = k_land(tactic)
~ temp bonus = 0
{ tactic == "press" and k_leverage() > 0:
    ~ bonus = 1
}
{ tactic == "threaten" and k_prep == "muscle":
    ~ bonus = 1
}
{ tactic == "threaten" and k_prep != "quiet":
    ~ earn("h", 5, "Made threats where people could hear")
}
{ land == 2:
    ~ k_reads = k_reads + 1
}
~ k_score = k_score + land + bonus
{ round == 1:
    ~ k_talk1 = tactic
- else:
    ~ k_talk2 = tactic
}
~ return land

// After two rounds: deal, short (a deal at a discount) or fight.
=== function k_settle() ===
{
- k_score >= 4:
    ~ k_outcome = "deal"
- k_score >= 0:
    ~ k_outcome = "short"
- else:
    ~ k_outcome = "fight"
}

// Pays out by the outcome and grades the job. Call after the fight, if any.
//   deal      full pay, full Respect, + a third more Respect if read cold (no homework)
//   short     60% pay, half Respect
//   fight won 70% pay, half Respect, Heat +10
//   fight lost 30% pay, no Respect, Heat +10
// Homework's tip costs a quarter of the pay, whatever the outcome.
=== function k_payout(what) ===
{
- k_outcome == "deal":
    ~ earn("c", k_pay, what)
    ~ earn("r", k_respect, "Got it done, his way")
    { k_prep != "homework":
        ~ earn("r", k_respect / 3, "Read {k_mood_name()} man cold")
    }
- k_outcome == "short":
    ~ earn("c", (k_pay * 6) / 10, "{what}, less what it took to settle")
    ~ earn("r", k_respect / 2, "Got it done, eventually")
- k_won:
    ~ earn("c", (k_pay * 7) / 10, "{what}, less what the mess cost")
    ~ earn("r", k_respect / 2, "Took it the hard way")
    ~ earn("h", 10, "A fight in the open")
- else:
    ~ earn("c", (k_pay * 3) / 10, "{what}, what was left of it")
    ~ earn("h", 10, "A fight in the open, and he lost it")
}
{ k_prep == "homework":
    ~ earn("c", 0 - k_pay / 4, "Paid for the word on him")
}
{
- k_outcome == "deal" and heat - k_heat0 <= 10:
    ~ job_grade = "clean"
- k_outcome == "fight" and not k_won:
    ~ job_grade = "botched"
- else:
    ~ job_grade = "messy"
}

// "a greedy", "a scared", "a proud", for the debrief.
=== function k_mood_name() ===
{
- k_mood == "greedy":
    ~ return "a greedy"
- k_mood == "scared":
    ~ return "a scared"
- else:
    ~ return "a proud"
}

// The message waiting for him tomorrow, by how this went: who sends it, what
// it says, and what it does when it arrives ("c60" cash, "r5" Respect,
// "h5" Heat, "t5" Lucas's trust, "" nothing). The board delivers it the next day.
=== function k_morning(from, text, fx) ===
~ k_after = "{from}^{text}^{fx}"
