// Scene 01 — The Unexpected Call (chapter 1, scene 1).
// Evening. Rookie turns up late at the gym, takes Lucas's challenge and beats
// Marco while Victor Sable, the boss, watches from the deck without a word.
// At home, Lucas calls.
//
// Lines are `SPEAKER: words #beat_id`; `>>> kind beat_id [label] words` is any
// other beat. Each beat id's staging (shots, blocking, cues) is in
// scene01.staging.json. See ARCHITECTURE.md, "Game and story runtime".

INCLUDE globals.ink

-> scene01

=== scene01 ===
// ── Arriving late ────────────────────────────────────────────────────────
>>> title b1_title
>>> shot b1_enter
>>> shot b2_enter [Downtown Gym] Evening. The session started forty minutes ago.
LUCAS: Look who's finally here. Thought you'd skipped training today. #b2_late
+ [Had a few things to take care of. #business]
    ~ late = "business"
    LUCAS: Whatever. Get changed. You're already late. #b2_l3
+ [I'm here now, aren't I? #here]
    ~ late = "here"
    ~ independence += 5
    LUCAS: Barely. Get changed. You're already late. #b2_l3_here
+ [Miss me? #missed]
    ~ late = "missed"
    ~ ravi_trust += 5
    LUCAS: Like a toothache. Get changed. You're already late. #b2_l3_missed
-
>>> shot b2_bag

// ── The challenge ────────────────────────────────────────────────────────
>>> shot b2_ravi
LUCAS: You've got some energy today. #b2_l4
ROOKIE: Just getting started. #b2_l5
LUCAS: Then let's see what you've got. There's a guy here who's been asking for a fight. Pretty tough, apparently. #b2_l6
ROOKIE: And? #b2_l7
LUCAS: I told him I knew someone who could handle him. #b2_l8
LUCAS: Come on. One match. What do you say? #b2_choice
+ [Let's get this over with. #over]
    ~ challenge = "over"
    ~ discipline += 5
    LUCAS: That's what I like to hear. Ring's yours. #b2_r_over
+ [Who exactly am I fighting? #who]
    ~ challenge = "who"
    LUCAS: Marco. Came over from the docks last month. Nobody here has put him down yet. #b2_r_who
    ROOKIE: Yet. #b2_r_who2
+ [I'm here to train, not entertain people. #train]
    ~ challenge = "train"
    ~ independence += 5
    LUCAS: Then train on him. One match. Humour me. #b2_r_train
    ROOKIE: One. #b2_r_train2
-

// ── The fight ────────────────────────────────────────────────────────────
// Played with the skill moments: each result (0–1, the share of taps that
// landed) is kept for later. The player picks the opening: all in (Rookie
// attacks first and walks onto Marco's hook) or start low (guard up, read
// him, slip the hook, counter). Marco's big hook always gets through, and
// Rookie always wins; how cleanly is up to the player.
>>> shot b3_square
>>> card b3_opening [Training Match] Marco squares up. How does Rookie open?
+ [Go all in. Take it to him from the first bell. #all_in]
    ~ opening = "all_in"
    ~ independence += 5
    >>> qte b3_blitz
    >>> shot b3_hook
    >>> qte b3_mash
+ [Start low. Guard up, read him first. #low]
    ~ opening = "low"
    ~ discipline += 5
    >>> qte b3_guard
    >>> shot b3_hook
    >>> qte b3_slip
    >>> qte b3_counter
    >>> qte b3_mash
-
>>> shot b3_finish
>>> shot b3_crowd
{
- opening == "all_in":
    LUCAS: Straight at him from the bell. Reckless, but that's what I'm talking about! #b3_after_allin
- fight_guard >= 0.5 and fight_slip >= 0.5:
    LUCAS: That's what I'm talking about! #b3_after
- else:
    LUCAS: Took a few on the chin, but that's what I'm talking about! #b3_after_hit
}
+ [You said he was tough. Didn't look that tough. #easy]
    ~ after_fight = "easy"
    LUCAS: Don't get carried away. #b3_l3
+ [He hits harder than he looks. #credit]
    ~ after_fight = "credit"
    ~ discipline += 5
    LUCAS: And you still put him down. Don't get carried away. #b3_r_credit
+ [Somebody get him some ice. #ice]
    ~ after_fight = "ice"
    ~ ravi_trust += 5
    LUCAS: Look at you, all heart. He'll live. #b3_r_ice
-

// ── Someone is watching ──────────────────────────────────────────────────
>>> shot b4_deck
>>> shot b4_leave
>>> shot b4_notice

// ── Going home ───────────────────────────────────────────────────────────
>>> shot b5_out [Downtown Gym] The session winds down.
LUCAS: Same time tomorrow? #b5_tomorrow
+ [We'll see. #see]
    ~ tomorrow = "see"
+ [Same time. #same]
    ~ tomorrow = "same"
    ~ discipline += 5
    LUCAS: Don't be late this time. #b5_r_same
+ [Don't count on it. #nope]
    ~ tomorrow = "nope"
    ~ independence += 5
    LUCAS: You say that every night. #b5_r_nope
-
>>> shot b5_leave
>>> shot b6_enter
>>> shot b6_sofa

// ── The phone call ───────────────────────────────────────────────────────
>>> shot b7_buzz
>>> shot b7_screen
>>> call b7_call [Lucas] Mobile phone • Evening
>>> card b7_open [Phone] Lucas is on the line.
+ [What now? We just saw each other. #now]
    ~ call_open = "now"
+ [Make it quick. I'm dead on my feet. #quick]
    ~ call_open = "quick"
    ~ discipline += 5
+ [Missed me already? #missed]
    ~ call_open = "missed"
    ~ ravi_trust += 5
-
LUCAS: Listen. I need to talk to you about something. #b7_l2
ROOKIE: Can't it wait until tomorrow? #b7_l3
LUCAS: No. This one's important. #b7_l4
>>> shot b7_fade
>>> complete b7_complete
-> END
