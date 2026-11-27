// Scene 04 — No Loose Ends (chapter 1, scene 4). The organisation answers.
// Nico has vanished since Calder Yard and the Varga crew are looking for him
// too. Victor wants it handled, and he's watching who handles it. Rookie
// chooses how to go into Mercer House (quietly, loudly for Victor, or by
// buying the woman who lives there), deals with what Nico left, and gets out
// past the Varga men. The note in Nico's coat shows somebody with inside
// access moved the Calder pickup; it proves nobody's guilt. Who Rookie gives
// it to is the chapter's last call. Then Victor sees him himself, for the
// first time: Calder Yard is his now. Outside, two messages: one about
// Victor's past, one from the crew who want the yard back.
//
// Keep the insider unidentified; the note establishes access, not guilt.
// Every line Rookie says is the player's pick. Lines are `SPEAKER: words
// #beat_id`; `>>> kind beat_id [label] words` is any other beat. Each beat
// id's staging is in scene04.staging.json. The economy (earn()) is in
// globals.ink and README.md, "Progression".
INCLUDE globals.ink
-> scene04
=== scene04 ===
~ ledger = ""
~ job_grade = ""
~ s04_heat0 = heat
// ── 1. The call, and Lucas ───────────────────────────────────────────────
>>> title n_title
>>> call n_call [Lucas] Mobile phone · The next morning
>>> shot n_answer
LUCAS: Where are you? #n_where
+ [Good morning to you too. #morning]
    ~ n_greeting = "morning"
+ [Home. What's happened? #home]
    ~ n_greeting = "home"
    ~ discipline += 5
+ [Depends. Am I in trouble? #trouble]
    ~ n_greeting = "trouble"
    ~ independence += 5
-
LUCAS: Not today. Gym. Now. The boss wants yesterday dealt with. #n_summon
>>> shot n_hangup
>>> shot n_meet [Downtown Gym] Later that morning.
LUCAS: Haven't slept. Don't ask. #n_breakfast
+ [You look terrible. #expenses]
    ~ n_meeting = "expenses"
    ~ ravi_trust += 5
    LUCAS: Thanks. Feels worse. #n_expenses
+ [You said this was serious. #serious]
    ~ n_meeting = "serious"
+ [Tell me about the car. #car]
    ~ n_meeting = "car"
-
LUCAS: Grey sedan belongs to the Varga crew. Rival outfit, across the river. They shouldn't have known about Calder Yard. #n_car
{ saw_permit:
    LUCAS: That gym permit you saw? Real issue number. Could have been stolen. Could have been passed along. #n_permit
}
{ heard_nico:
    LUCAS: And Nico telling somebody he did what they asked? Boss wants to know who was on that call. #n_overheard
}
{ nico_trusted:
    LUCAS: Nico called them insurance. Looks like the policy expired. #n_insurance
}
{ s03_call == "play_up":
    // Victor's people walked the yard: the story Rookie told doesn't hold
    LUCAS: And Victor's people walked the yard last night. "All of them," you said. It wasn't all of them, was it? #n_caught
    ~ earn("r", -15, "Your Calder story didn't hold up")
    ~ earn("t", -5, "Told Lucas a bigger story than it was")
}
LUCAS: Nico's missing. Hasn't answered since you left the yard. #n_missing
+ [Why me? You have people for this. #why]
    ~ n_assignment = "why"
    LUCAS: Because you were there. And because the boss asked for you by name. #n_trust
+ [So now I'm finding people instead of delivering boxes? #people]
    ~ n_assignment = "people"
    ~ independence += 5
    LUCAS: It's a step up. Doesn't feel like one. #n_promotion
+ [Last known address? #address]
    ~ n_assignment = "address"
    ~ discipline += 5
-
LUCAS: Mercer House. Supposed to be empty, but Nico kept a room there. Find him, or find out where he went. #n_address
LUCAS: And whatever Varga wants from him, they don't get it. #n_warning
>>> job n_job [No Loose Ends] Victor ¦ $1,000 ¦ High ¦ Find Nico at Mercer House, or find out where he went. Whatever the Varga crew want from him, they don't get it.

// ── 2. Prep ──────────────────────────────────────────────────────────────
// Quiet skips the woman downstairs (more time inside, but no warning about
// the two men); the front door makes Victor's point and brings Varga early;
// buying the building gets the key and a warning when they come.
>>> card n_prep [Prep] How do you go in?
+ [Quiet. Daylight, the back stairs. Nobody sees me come or go. #quiet]
    ~ s04_prep = "quiet"
    ~ discipline += 5
    LUCAS: Good. In and out. #n_r_quiet
+ [Through the front door. Let Varga hear that Victor's people came. #message]
    ~ s04_prep = "message"
    ~ earn("r", 10, "Walked in the front door for Victor")
    ~ earn("h", 15, "Made noise at Mercer House")
    ~ earn("v", 10, "Let the Varga crew know you were coming")
    LUCAS: He'll like that more than I do. #n_r_message
+ [Buy the building. Pay whoever's there to help. · $300 #buy #need:cash:300]
    ~ s04_prep = "buy"
    ~ earn("c", -300, "Paid off the woman at Mercer House")
    LUCAS: Money talks there. Just don't let it talk too much. #n_r_buy
-
>>> drive n_drive [Mercer House] Find Nico's last known address.

// ── 3. Mercer House ──────────────────────────────────────────────────────
// Heat from earlier jobs follows him: at 25 or more, the Varga crew are
// already watching the building and there's less time inside.
{ heat >= 25:
    ~ s04_watched = true
}
{ s04_prep == "quiet":
    >>> shot n_arrive_back [Mercer House] The back stairs. Nobody on the landing.
    -> the_room
}
>>> shot n_arrive [Mercer House] Most of the windows are boarded. One landing light still works.
{ s04_watched:
    >>> caption n_watched [Mercer House] Across the street, a parked car with two men in it. They watched you walk in. You brought this much attention with you.
}
>>> explore n_local Find someone who has seen Nico.
{ s04_prep == "buy":
    ~ resident_warns = true
    ~ s04_knows_men = true
    LOCAL: You're the one who paid. Room four, here's the key. Two men came asking at dawn, a big one in a leather jacket. If they come back, I'll knock twice on the pipes. #n_bought
    -> the_room
}
LOCAL: You're the third person asking about that boy today. #n_third
+ [Which room? I'm not asking twice. #lean]
    ~ n_resident = "lean"
    ~ earn("h", 5, "Leaned on a scared woman")
    LOCAL: Four! Room four. Now leave me alone. #n_r_lean
+ [Level with me. He's in trouble, and so are you if they come back. #level]
    ~ n_resident = "level"
    ~ ravi_trust += 5
    ~ discipline += 5
    ~ s04_knows_men = true
    LOCAL: Two men. Leather jacket on the big one. Asked which room, then watched the back stairs. #n_two
+ [I work for Victor Sable. #victor #need:respect:200]
    ~ n_resident = "victor"
    ~ s04_named_victor = true
    ~ s04_knows_men = true
    ~ earn("f", 5, "Put Victor's name to work")
    LOCAL: Victor's. Then you'd better hurry. Two men, a big one in leather. They watched the back stairs. #n_r_victor
-
{ s04_prep == "message" and n_resident == "lean":
    // the front door scared her into telling all of it
    ~ s04_knows_men = true
    LOCAL: There were two before you. Big one in leather. Please, just go. #n_r_message_all
}
LOCAL: Nico went up before dawn. Came down with half a bag and no coat. Room four. Door didn't catch behind him. #n_room
-> the_room

// ── 4. Room Four ─────────────────────────────────────────────────────────
= the_room
>>> shot n_enter [Room Four] The door is ajar. No answer from inside.
{ s04_watched or s04_prep == "message":
    >>> explore n_search_short They know you're here. Search fast.
- else:
    >>> explore n_search Search Nico's room for signs of where he went.
}
>>> caption n_hurry [Room Four] An open bag. Clothes still in the drawer. Cash left on the table. He didn't leave this place calmly.
{ n_cash:
    -> the_cash
}
-> the_phone

= the_cash
>>> card n_cash_card [Room Four] Four hundred in twenties under a glass. Nico owes everyone in town, and he left it behind.
+ [Pocket it. He won't miss it. #pocket]
    ~ nico_cash = "pocket"
    ~ independence += 5
    ~ earn("c", 400, "Pocketed Nico's cash")
+ [Take it for Victor. #for_victor]
    ~ nico_cash = "victor"
    ~ earn("f", 5, "Brought Victor the cash Nico left")
+ [Leave it where it is. #leave]
    ~ nico_cash = "leave"
    ~ discipline += 5
-
-> the_phone

// ── 5. The warning call ──────────────────────────────────────────────────
// The burner keeps his real number out of it, unless he announced himself.
= the_phone
{ gear_burner and s04_prep != "message":
    >>> caption n_burner [Room Four] Your own phone is switched off in the car. Whoever is trying to reach you this morning, they can't.
    -> the_stairs
}
>>> call n_unknown [Unknown number] Number withheld
>>> shot n_pickup
// the voice knows what Rookie did at Calder
CALLER: Stop looking for Nico.{standoff == "fight": You put one of ours on the ground at Calder.}{standoff != "fight" and yard_sedan: You put your face in our car at Calder.}{standoff != "fight" and not yard_sedan and heard_nico: You listen at doors.} #n_stop
+ [Who is this? #who]
    ~ n_caller = "who"
+ [Where is he? #where]
    ~ n_caller = "where"
    ~ intel += 5
+ [You've got the wrong number. #wrong]
    ~ n_caller = "wrong"
    ~ discipline += 5
-
CALLER: Leave the room. Walk away. Don't make us tell you again. #n_threat
>>> shot n_dead
>>> caption n_watch [Room Four] The call ends. Someone knows exactly where you are.
-> the_stairs

// ── 6. The stairs ────────────────────────────────────────────────────────
= the_stairs
>>> shot n_exit [Mercer House] The same leather jacket. This time he brought someone.
{ resident_warns:
    >>> caption n_pipes [Mercer House] Two knocks on the pipes, a moment before they reach the landing.
}
{ stranger_seen_face:
    STRANGER: Delivery boy. Busy morning? #n_recognize
- else:
    STRANGER: So you're the one from the yard. Never got a good look at you before. #n_new_face
}
{ standoff == "fight":
    STRANGER: You and me have unfinished business. #n_oldfight
}
{ standoff == "talk":
    STRANGER: Still think saying the boss's name will save you? #n_oldtalk
}
{ standoff == "run":
    STRANGER: No car to hide in this time. #n_oldrun
}
{ s04_named_victor:
    STRANGER: The old woman says you work for Victor. Says it like it means something. #n_named
}
STRANGER: What did you find upstairs? Nico's gone. It's what he left behind we're worried about. #n_demand
+ [Get out of my way. #challenge]
    ~ n_confrontation = "challenge"
    ~ earn("h", 10, "Fought them in the stairwell")
    ~ earn("v", 10, "Fought two Varga men")
    STRANGER: There's two of us, kid. #n_outnumbered
    { s04_knows_men:
        >>> qte n_guard
    - else:
        // nobody warned him: they're on him before he's set
        >>> qte n_guard hard
    }
    { gear_knuckles:
        >>> qte n_counter easy
    - else:
        >>> qte n_counter
    }
+ [Tell Varga that Calder cost him. Next time it costs more. #message #need:respect:210]
    ~ n_confrontation = "message"
    ~ varga_message = true
    ~ earn("r", 15, "Sent the Varga crew a message")
    ~ earn("h", 10, "Threatened the Varga crew to their face")
    ~ earn("v", 15, "Threatened the Varga crew to their face")
    STRANGER: You've got a mouth on you. Let's see if it lasts. #n_r_message
    >>> caption n_distraction [Mercer House] The second man glances up at the landing. An opening, just wide enough.
    >>> qte n_dodge
+ {resident_warns} [Back down the service stairs, the way she showed you. #slip]
    ~ n_confrontation = "slip"
    ~ n_escape = 1
    >>> caption n_slip [Mercer House] Down the service stairs before they reach the landing. They hear the door, too late.
+ {not resident_warns} [Nothing. I'm leaving. #leave]
    ~ n_confrontation = "leave"
    ~ discipline += 5
    STRANGER: Then you won't mind us checking your pockets. #n_pockets
    >>> qte n_break
-
{ n_escape < 0.5 and n_confrontation != "challenge":
    >>> caption n_hit [Mercer House] His hand catches your collar. You take a blow against the wall, twist out of the coat grip, and stumble toward the service passage.
    ~ earn("h", 5, "Took a beating on the way out")
}
{ n_confrontation == "challenge":
    { n_counter_result < 0.5:
        >>> caption n_scrappy [Mercer House] Your counter barely connects. A shoulder into the loose service door buys you a way out.
        ~ earn("h", 5, "A scrappy fight, and witnesses")
    - else:
        >>> caption n_clean [Mercer House] He folds against the wall. The second man lunges; you slip through the service door before he reaches you.
        ~ earn("r", 10, "Put a Varga man down twice")
    }
}
>>> shot n_escape_shot
>>> caption n_stairs [Service passage] You wedge the loose door behind you. In the stairwell: Nico's coat, snagged on a broken rail. Something stiff inside the lining.
>>> explore n_evidence Check the coat before the men force the door.
~ n_evidence_found = true
~ intel += 10
>>> caption n_note [Nico's note] "Calder pickup. Time changed to 23:20. Use the gym staff pass. Same inside line. Burn this."
>>> caption n_implication [Service passage] The changed pickup time. A staff pass. Someone with access to the boss's operation was feeding Nico instructions. No name. No proof of who.
>>> drive n_return [Downtown Gym] Get the note out of here.

// ── 7. Who gets the note ─────────────────────────────────────────────────
>>> shot n_back [Downtown Gym] Afternoon.
LUCAS: Tell me you found something. #n_found
+ [Your contact wasn't just missing. Someone was looking for him before I got there. #looking]
    ~ n_report = "looking"
+ [Two men and a warning call. Your idea of a quiet morning needs work. #quiet]
    ~ n_report = "quiet"
    ~ ravi_trust += 5
+ [Nico left a note. It points back here. #note]
    ~ n_report = "note"
    ~ discipline += 5
-
LUCAS: Then give it here. Whatever it is. #n_decide
+ [Here. You should see it first. #lucas]
    ~ s04_note = "lucas"
    ~ earn("t", 10, "Trusted Lucas with the note")
    ~ earn("r", 5, "Kept to the chain of command")
    >>> shot n_handoff
    >>> caption n_reaction [Downtown Gym] Lucas reads the note twice. The joke he was about to make never comes.
    LUCAS: Twenty-three twenty. That's the time I gave you. #n_lucas_time
    LUCAS: I'm taking this upstairs. You're coming with me. #n_upstairs
+ [This goes to Victor. Nobody else. #victor]
    ~ s04_note = "victor"
    ~ earn("f", 10, "Took the note straight to Victor")
    ~ earn("r", 15, "Went over Lucas's head")
    ~ earn("t", -10, "Went over Lucas's head")
    LUCAS: Over my head. Fine. He's upstairs. I hope you know what you're doing. #n_over
+ [I'm keeping it. For now. #keep]
    ~ s04_note = "keep"
    ~ independence += 5
    ~ intel += 5
    ~ earn("t", -5, "Kept the note from Lucas")
    LUCAS: Then you'd better have a reason, because he's going to ask. He wants you upstairs. #n_kept
-

// ── 8. Victor ────────────────────────────────────────────────────────────
// The first time the boss sees Rookie himself. Lucas is in the room unless
// Rookie went over his head.
{ s04_note == "victor":
    >>> shot n_office_alone [Victor's office] Upstairs. Victor behind his desk, alone.
- else:
    >>> shot n_office_in [Victor's office] Upstairs. Victor behind his desk. Lucas by the window.
}
VICTOR: Most people sit. You can stand, if you like. #n_v_open
+ [I'll stand. #stand]
    ~ v_open = "stand"
    ~ independence += 5
+ [Thank you, Mr Sable. #thanks]
    ~ v_open = "thanks"
    ~ don_loyalty += 5
+ [You wanted to see me. #straight]
    ~ v_open = "straight"
    ~ discipline += 5
-
{
- s04_note == "lucas":
    VICTOR: Lucas brought me the note. You gave it to him first. Good. That's how this works. #n_v_lucas
- s04_note == "victor":
    VICTOR: You brought this to me, not to Lucas. Lucas doesn't know you're here. Keep it that way, or don't. Your call. #n_v_direct
- else:
    VICTOR: Lucas says you found something and kept it. Keep it, then. Just never keep anything from me. #n_v_kept
}
VICTOR: Marco. Hollis Hill. Calder. I watched all of it. #n_v_watch
+ [I know. I saw you on the deck. #saw]
    ~ v_terms = "saw"
    VICTOR: Then you know I don't waste my time. #n_v_r_saw
+ [Did I pass? #pass]
    ~ v_terms = "pass"
    VICTOR: You're standing in this room. #n_v_r_pass
+ [Why me? Why did you ever pick me? #why]
    ~ v_terms = "why"
    ~ asked_victor_why = true
    VICTOR: Not today. #n_v_r_why
-
VICTOR: The Varga crew want Calder Yard. They've wanted it for years. #n_v_calder
~ owns_calder = true
VICTOR: Calder Yard is yours now. You run it, you keep it, you answer to me. #n_v_yours
+ [It'll be run right. #right]
    ~ v_answer = "right"
    ~ discipline += 5
    VICTOR: I know. #n_v_r_right
+ [What's my cut? #cut]
    ~ v_answer = "cut"
    VICTOR: A fifth of everything that comes through it. Don't make me regret the number. #n_v_r_cut
+ [And when Varga comes for it? #varga]
    ~ v_answer = "varga"
    VICTOR: Then you'll find out what you're made of. So will they. #n_v_r_varga
-
{ varga >= 30:
    VICTOR: You've made yourself an enemy across the river. Good. Enemies are proof you matter. #n_v_war
}
{ respect >= 300:
    -> crew
}
-> paid

= crew
VICTOR: And you pick who works it with you. Choose well. #n_v_crew
+ [Lucas. #lucas]
    ~ crew_pick = "lucas"
    ~ earn("t", 10, "Picked Lucas to work the yard")
+ [Sal, from Pier Nine. #sal]
    ~ crew_pick = "sal"
+ [Nobody. I'll run it myself. #alone]
    ~ crew_pick = "alone"
    ~ independence += 5
-
-> paid

// ── The pay, and the stinger ─────────────────────────────────────────────
= paid
>>> shot n_v_dismiss
~ earn("c", 1000, "Victor's pay for Mercer House")
~ earn("r", 80, "Brought back what Nico left")
{ heat - s04_heat0 <= 15:
    ~ job_grade = "clean"
    ~ earn("r", 10, "Out of Mercer House without a trail")
- else:
    ~ job_grade = "messy"
}
>>> shot n_outside [Downtown Gym] Outside. The street is just a street again.
>>> message n_sender [Unknown number] A photo of Nico's note, on a table you don't recognise. Then: "You found the wrong part of the story. Ask Victor what happened at the gym before he found you."
>>> message n_varga_text [Unknown number] Enjoy the yard while it's yours.
>>> shot n_victor_alone [Victor's office] Victor, alone. An old photograph on the desk in front of him.
VICTOR: So it's started. #n_started
>>> shot n_end
>>> complete n_complete
-> END
