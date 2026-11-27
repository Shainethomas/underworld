// Scene 01 — The Unexpected Call (chapter 1, scene 1).
// Evening. Rookie turns up late at the gym, where Lucas has a fight lined up:
// Marco, a dockside brawler who resents the boss's special treatment. It's a
// test, and Victor Sable is watching from the deck. How Rookie prepares and
// how cleanly he wins sets the purse (his cut of Lucas's bet), his first
// Respect, and Victor's reaction. At home, a rival crew calls his own number
// to recruit him; Lucas's message says tomorrow he works.
//
// Lines are `SPEAKER: words #beat_id`; `>>> kind beat_id [label] words` is any
// other beat. Each beat id's staging (shots, blocking, cues) is in
// scene01.staging.json. See ARCHITECTURE.md, "Game and story runtime", and
// README.md, "Progression", for the economy (earn() is in globals.ink).

INCLUDE globals.ink

-> scene01

=== scene01 ===
~ ledger = ""
~ job_grade = ""
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
LUCAS: Then let's see what you've got. There's a guy here who's been asking for a fight. Pretty tough, apparently. #b2_l6
+ [And? #and]
    ~ tough = "and"
+ [Tough according to who? #who_says]
    ~ tough = "who_says"
    ~ discipline += 5
    LUCAS: According to everyone he's put on the floor. #b2_r_who_says
+ [Not interested. #no]
    ~ tough = "no"
    ~ independence += 5
    LUCAS: Hear me out. #b2_r_no
-
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
LUCAS: Half the gym has money on Marco. I don't. Put him down, and you get a cut of what I win. #b2_bet
>>> job b2_job [Training Match] Lucas ¦ A cut of the bet ¦ Low ¦ Put Marco on the floor. Win clean and the cut is bigger. The whole gym is watching.

// ── Marco ────────────────────────────────────────────────────────────────
MARCO: So you're the one. Private lessons with Victor himself. Must be nice. #b2_marco
+ [Jealous? #jealous]
    ~ marco_reply = "jealous"
    ~ independence += 5
    MARCO: Of a pet? No. I just want to see what he thinks he bought. #b2_marco_r_jealous
+ [I trained for it. Same as you. #earned]
    ~ marco_reply = "earned"
    ~ discipline += 5
    MARCO: Nobody trained me. I came up off the docks with my hands. #b2_marco_r_earned
+ [Let's find out if it worked. #find_out]
    ~ marco_reply = "find_out"
    MARCO: Let's. #b2_marco_r_find
-
LUCAS: Victor doesn't train anybody, Marco. He trained him. That's the whole point. #b2_marco_lucas

// ── Before the bell (prep) ───────────────────────────────────────────────
>>> card b3_prep [Before the bell] Marco heads for the ring. How do you get ready?
+ [Watch him spar first. Learn his tells. #watch]
    ~ s01_prep = "watch"
    ~ intel += 5
    ROOKIE: He drops his right shoulder before the hook. Every time. Start low, read him, and I can slip it. #b3_prep_watch
+ [Wrap up properly and warm up. #warm]
    ~ s01_prep = "warm"
    ~ discipline += 5
    ROOKIE: Hands loose. Guard tight. Whatever he throws first, I'm ready for it. #b3_prep_warm
+ [Get in his face. Make it personal. #face]
    ~ s01_prep = "face"
    ~ independence += 5
    MARCO: You want it personal? You've got it. #b3_prep_face
    LUCAS: Now the whole room's betting. Win, and your cut goes up by half. But he's coming at you from the bell. #b3_prep_purse
-

// ── The fight ────────────────────────────────────────────────────────────
// Played with the skill moments: each result (0–1, the share of taps that
// landed) is kept for later. Watching Marco first makes the slip and the
// counter easier; warming up makes the opening easier. Getting in his face
// skips the feeling-out: he rushes from the bell and everything is harder,
// for a bigger purse. Rookie always wins; how cleanly is up to the player.
{ s01_prep == "face":
    -> rush
- else:
    -> square_up
}

= rush
>>> shot b3_rush [Training Match] No feeling out. Marco comes straight off the ropes.
~ opening = "all_in"
>>> qte b3_blitz hard
>>> shot b3_hook
>>> qte b3_mash hard
-> result

= square_up
>>> shot b3_square
>>> card b3_opening [Training Match] Marco squares up. How does Rookie open?
+ [Go all in. Take it to him from the first bell. #all_in]
    ~ opening = "all_in"
    ~ independence += 5
    { s01_prep == "warm":
        >>> qte b3_blitz easy
    - else:
        >>> qte b3_blitz
    }
    >>> shot b3_hook
    >>> qte b3_mash
+ [Start low. Guard up, read him first. #low]
    ~ opening = "low"
    ~ discipline += 5
    { s01_prep == "warm":
        >>> qte b3_guard easy
    - else:
        >>> qte b3_guard
    }
    >>> shot b3_hook
    { s01_prep == "watch":
        >>> qte b3_slip easy
        >>> qte b3_counter easy
    - else:
        >>> qte b3_slip
        >>> qte b3_counter
    }
    >>> qte b3_mash
-
-> result

// ── After the bell ───────────────────────────────────────────────────────
= result
~ temp purse = 150
~ temp score = 0.0
>>> shot b3_finish
>>> shot b3_crowd

// The grade: the share of every skill moment's taps that landed.
{ opening == "all_in":
    ~ score = (fight_counter + fight_finish) / 2.0
- else:
    ~ score = (fight_guard + fight_slip + fight_counter + fight_finish) / 4.0
}
{
- score >= 0.75:
    ~ job_grade = "clean"
    ~ purse = 500
- score >= 0.4:
    ~ job_grade = "scrappy"
    ~ purse = 300
- else:
    ~ job_grade = "ugly"
}
{ s01_prep == "face":
    ~ purse = purse + purse / 2
}
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
LUCAS: Wasn't my idea, by the way. The boss asked for Marco. #b3_boss
LUCAS: Your cut. ${purse}. Don't spend it all on ice. #b3_cut
~ earn("c", purse, "Your cut of Lucas's bet")
~ earn("r", 50, "Put Marco down in front of the gym")
{
- job_grade == "clean":
    ~ earn("r", 20, "A clean win")
- job_grade == "scrappy":
    ~ earn("r", 10, "Took some hits and still won")
}
{ s01_prep == "face":
    { job_grade == "clean":
        ~ earn("r", 5, "Called him out and backed it up")
    }
    { job_grade == "ugly":
        ~ earn("r", -5, "Talked big, fought ugly")
    }
}

// ── Someone is watching ──────────────────────────────────────────────────
>>> shot b4_deck
{
- job_grade == "clean":
    ~ victor_reaction = "nod"
    >>> shot b4_nod
    ~ earn("f", 5, "Victor saw a clean win")
    >>> shot b4_leave
- opening == "all_in":
    ~ victor_reaction = "reckless"
    VICTOR: He doesn't wait to be told. #b4_victor_reckless
    >>> shot b4_leave
- job_grade == "scrappy":
    ~ victor_reaction = "learn"
    VICTOR: He'll learn. #b4_victor_learn
    >>> shot b4_leave
- else:
    ~ victor_reaction = "turned"
    >>> shot b4_turn
    >>> shot b4_leave_cold
}

// ── Going home ───────────────────────────────────────────────────────────
>>> shot b5_out [Downtown Gym] The session winds down.
{
- victor_reaction == "nod":
    LUCAS: You see that? The boss nodded at you. He doesn't nod. #b5_victor_nod
- victor_reaction == "reckless":
    LUCAS: The boss said something about you. Couldn't tell if it was good. #b5_victor_reckless
- victor_reaction == "learn":
    LUCAS: Boss says you'll learn. From him, that's practically a hug. #b5_victor_learn
- else:
    LUCAS: The boss walked out before the end. Don't read into it. #b5_victor_left
}
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

// ── The unexpected call ──────────────────────────────────────────────────
// A rival outfit, across the river, rings his own number. Somebody gave it
// to them; the Varga crew become the chapter's rivals from here.
>>> shot b6_ring
>>> call b6_call [Unknown number] Number withheld
>>> shot b6_answer
~ varga_called = true
CALLER: Good fight tonight. #b6_c1
+ [Who is this? #who]
    ~ varga_open = "who"
    CALLER: Somebody who pays fighters better than Victor does. #b6_c_who
+ [How did you get this number? #number]
    ~ varga_open = "number"
    ~ intel += 5
    CALLER: Your friends aren't careful. #b6_c_number
+ [You've got the wrong guy. #wrong]
    ~ varga_open = "wrong"
    ~ discipline += 5
    CALLER: Rookie. Victor's fighter. I don't think I do. #b6_c_wrong
-
CALLER: Victor's not the only one who pays fighters. Think about who you work for. #b6_c2
+ [Hang up on him. #hang_up]
    ~ varga_call = "hang_up"
    ~ earn("r", 5, "Hung up on a rival crew")
    ~ earn("f", 5, "Hung up on a rival crew")
+ [I'm listening. #listen]
    ~ varga_call = "listen"
    ~ independence += 5
    CALLER: Good. We'll be in touch. #b6_c_listen
+ [Tell your boss I'm not for sale. #refuse]
    ~ varga_call = "refuse"
    ~ discipline += 5
    ~ earn("v", 5, "Turned them down to their face")
    CALLER: Everybody's for sale, kid. You just don't know your price yet. #b6_c_refuse
-
>>> shot b6_hangup
>>> shot b6_buzz
>>> message b6_message [Lucas] Boss liked what he saw. Tomorrow you work. Keep your phone on.
>>> card b6_reply [Phone] Lucas is still online.
+ [Reply: "I'll be ready." #ready]
    ~ s01_reply = "ready"
    ~ discipline += 5
+ [Reply: "Some other crew just called me." #tell]
    ~ s01_reply = "tell"
    ~ earn("t", 5, "Told Lucas about the call")
    >>> message b6_lucas_back [Lucas] Don't pick up again. We'll talk tomorrow. Sleep.
+ [Turn the phone face down. #face_down]
    ~ s01_reply = "face_down"
    ~ independence += 5
-
>>> shot b6_bed
>>> shot b6_sleep
>>> complete b6_complete
-> END
