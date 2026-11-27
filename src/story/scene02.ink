// Scene 02 — The Opportunity (chapter 1, scene 2). Rookie's first job.
// The job was accepted at Scene 01's debrief, so the scene opens on the
// details: that evening outside the gym Lucas gives him the job — collect a sealed parcel from Sal on Pier Nine, take it to the man
// at the door on Hollis Hill, bring back what he's given — and Rookie chooses
// how to play it (the route, and what to spend the fight purse on). Sal tries
// a fee on him; at the house a grey sedan is parked by the door. Lucas pays
// him back at the gym and pockets an envelope he won't explain; at home the
// next job is already on its way, and it's not like this one.
//
// Session one ends here: the debrief promotes him to Runner. The pickup
// time Sal was given, the sedan and the envelope are the chapter's
// background threads; they cost nothing to miss.
//
// Every line Rookie says is the player's pick. Lines are `SPEAKER: words
// #beat_id`; `>>> kind beat_id [label] words` is any other beat. Each beat
// id's staging is in scene02.staging.json. The economy (earn()) is in
// globals.ink and README.md, "Progression". The earlier Scene 02 (the Don's
// call, the facility) is kept in legacy/.

INCLUDE globals.ink

-> scene02

=== scene02 ===
~ ledger = ""
~ job_grade = ""
// The job was taken at Scene 01's debrief: the scene opens on the details.
>>> title s1_title

// ── 1. The brief, and how to play it ─────────────────────────────────────
>>> shot s4_arrive [Downtown Gym] That evening.
LUCAS: There he is. Boss liked what he saw last night, so here's your first real job. #s4_l1
LUCAS: Pier Nine. The warehouse at the end, with the light on. Ask for Sal. Be there at half ten. #s4_l2
LUCAS: You take his parcel up to the house on Hollis Hill. A man at the door takes it, nobody else. He gives you something, you bring it straight back here. #s4_l3
>>> job s4_job [The Delivery] Victor ¦ $800 ¦ Low ¦ Collect a sealed parcel from Sal on Pier Nine at half ten. Deliver it to the man at the door on Hollis Hill. Bring back what he gives you.
>>> card s4_prep [Prep] How do you play it?
+ [By the book. Lucas's route, on time. #book]
    ~ s02_prep = "book"
    ~ discipline += 5
    LUCAS: That's what he likes to hear. #s4_r_done
+ [Back streets. Slower, but nobody follows me. #back]
    ~ s02_prep = "back"
    ~ independence += 5
    LUCAS: Your call. Sal hates waiting. #s4_r_got
+ [Get to the pier early. Look around before Sal sees me. #scout]
    ~ s02_prep = "scout"
    ~ intel += 5
    LUCAS: Just don't let him catch you poking around. #s4_r_someone
-
>>> card s4_shop [Lucas knows a guy] Spend some of the fight money before you go? Whatever you buy, you keep.
+ [Knuckle duster · $300. Your counters land easier. #knuckles #need:cash:300]
    ~ s02_shop = "knuckles"
    ~ gear_knuckles = true
    ~ earn("c", -300, "Knuckle duster")
+ [Burner phone · $150. Your real number stays quiet. #burner #need:cash:150]
    ~ s02_shop = "burner"
    ~ gear_burner = true
    ~ earn("c", -150, "Burner phone")
+ [Keep the cash for a bigger job. #save]
    ~ s02_shop = "save"
-
LUCAS: Go on. Don't keep them waiting. #s4_l5
>>> shot s4_leave
{ s02_prep == "back":
    >>> drive s4_drive_back [Pier Nine] The long way round, through the back streets.
- else:
    >>> drive s4_drive [Pier Nine] Drive down to the docks.
}

// ── 5. The pickup ────────────────────────────────────────────────────────
// Sal was told ten; Lucas told Rookie half ten. Whoever moved the time, it
// isn't Rookie's problem tonight.
~ sal_time = true
{
- s02_prep == "scout":
    >>> shot s5_arrive [Pier Nine] Ten o'clock. Early.
    >>> explore s5_scout Look around before Sal sees you. Then find him.
    SAL: Ten on the dot. That's what they told me. Lucas's boys are never on time. #s5_l0_scout
- s02_prep == "back":
    >>> shot s5_arrive [Pier Nine] Twenty to eleven.
    >>> explore s5_explore Find Sal. The warehouse at the end, with the light on.
    SAL: Forty minutes late. I was told ten. #s5_l0_back
- else:
    >>> shot s5_arrive [Pier Nine] Twenty past ten.
    >>> explore s5_explore Find Sal. The warehouse at the end, with the light on.
    SAL: You're late. I was told ten. #s5_l0
}
+ [Lucas told me half ten. #half_ten]
    ~ sal_reply = "half_ten"
    SAL: Then somebody's lying to one of us. #s5_r_half
+ [I'm here now. #here]
    ~ sal_reply = "here"
    ~ discipline += 5
    SAL: So you are. #s5_r_here
+ [Who told you ten? #who_told]
    ~ sal_reply = "who_told"
    ~ intel += 5
    SAL: Same people who tell me everything. A phone call. #s5_r_who_told
-
SAL: On the bench. It's sealed, and it stays sealed. #s5_l3
+ [What's in it isn't my business. #sealed]
    ~ pickup = "sealed"
    ~ discipline += 5
    SAL: Lucas said you were smart. #s5_r_sealed
+ [Heavy? #heavy]
    ~ pickup = "heavy"
    SAL: Heavier than it looks. Most things around here are. #s5_r_heavy
+ [You always this friendly? #friendly]
    ~ pickup = "friendly"
    ~ independence += 5
    SAL: Only with people I don't plan on seeing again. #s5_r_friendly
-
SAL: One more thing. There's a handling fee. Two hundred. Lucas didn't mention it? #s5_fee
+ [Pay him. · $200 #pay #need:cash:200]
    ~ sal_fee = "pay"
    ~ earn("c", -200, "Sal's handling fee")
    ~ earn("r", -5, "Paid Sal's fee without a word")
    ~ contact_sal = true
    SAL: A pleasure. Come back any time. #s5_r_pay
+ {s02_prep == "scout"} [There's no fee, Sal. I saw your containers. #lean]
    ~ sal_fee = "lean"
    ~ earn("r", 10, "Leaned on Sal, and he folded")
    ~ contact_sal = true
    SAL: ...You didn't see any containers. And there's no fee. We understand each other. #s5_r_lean_seals
+ {s02_prep != "scout"} [There's no fee, Sal. #lean]
    ~ sal_fee = "lean"
    ~ earn("r", 10, "Leaned on Sal, and he folded")
    ~ earn("h", 10, "Leaned on Sal in front of his crew")
    SAL: Fine. No fee. But people heard you, kid. Don't come back here. #s5_r_lean_open
+ [Call Lucas and ask. #call]
    ~ sal_fee = "call"
    ~ earn("t", 5, "Checked with Lucas first")
    ~ earn("r", -5, "Needed Lucas to handle a dock rat")
    ~ contact_sal = true
    >>> caption s5_call_lucas [Phone] Lucas: "There's no fee. Put him on." Sal listens for a moment, and the fee is gone.
-
>>> shot s5_take
SAL: Hollis Hill. Don't stop on the way. #s5_l4

// ── 6. The drive ─────────────────────────────────────────────────────────
>>> drive s6_drive [Hollis Hill] Take the parcel up to Hollis Hill. Don't stop on the way.

// ── 7. The delivery ──────────────────────────────────────────────────────
// Lucas's route and the early start get there while a grey sedan is still at
// the house; the back streets get there after it has gone.
{ s02_prep == "back":
    >>> shot s7_arrive_clear
- else:
    >>> shot s7_arrive
}
>>> shot s7_out
{ s02_prep == "back":
    -> the_door
}
~ s02_sedan = true
>>> card s7_sedan [Hollis Hill] A grey sedan parked up by the house, engine still ticking, somebody behind the wheel. Somebody got here just before you.
+ [Note the plate and keep walking. #plate]
    ~ s02_car = "plate"
    ~ intel += 5
    ~ earn("r", 5, "Noted the sedan's plate for Lucas")
+ [Leave it. Not your business. #ignore]
    ~ s02_car = "ignore"
    ~ discipline += 5
+ [Knock on its window. #knock]
    ~ s02_car = "knock"
    ~ earn("r", 5, "Knocked on a rival's window")
    ~ earn("h", 10, "Made a scene at the drop")
    ~ earn("v", 10, "Showed the Varga crew your face")
    >>> caption s7_knock [Hollis Hill] The window drops an inch. Nobody says a word. Then the sedan pulls away.
-
-> the_door

= the_door
>>> explore s7_explore Take the parcel up to the house. The man at the door, nobody else.
GUARD1: That's far enough. #s7_l1
+ [Delivery. From Lucas. #delivery]
    ~ door_greet = "delivery"
+ [Easy. I'm expected. #expected]
    ~ door_greet = "expected"
    ~ independence += 5
    GUARD1: Everybody says that. #s7_r_expected
+ [You're the man at the door? #door]
    ~ door_greet = "door"
    ~ discipline += 5
    GUARD1: I'm the only man you'll talk to. #s7_r_door
-
GUARD1: I know you. Victor's fighter. The one who put Marco on the floor. #s7_known
{ s02_car == "knock":
    GUARD1: And the one who just knocked on that car's window. Brave or stupid. We'll see which. #s7_r_knock
}
GUARD1: Anyone follow you up the hill? #s7_l3
+ [No. I made sure. #clean]
    ~ doorstep = "clean"
    ~ discipline += 5
    GUARD1: Good. #s7_r_clean
+ [Would I be standing here if they had? #cocky]
    ~ doorstep = "cocky"
    ~ independence += 5
    GUARD1: You'd be surprised who ends up standing here. #s7_r_cocky
+ [Check for yourself. #check]
    ~ doorstep = "check"
    GUARD1: I already did. #s7_r_check
-
>>> shot s7_handover
GUARD1: For Lucas. Now get off the hill. #s7_l4
>>> shot s7_leave

// ── 8. Handover and payment ──────────────────────────────────────────────
>>> shot s8_arrive [Downtown Gym] Close to midnight.
LUCAS: Good work. I knew he was right about you. #s8_l1
+ [Here. Everything's done. #done]
    ~ handover = "done"
+ [Told you I'd handle it. #told]
    ~ handover = "told"
    ~ independence += 5
+ [It went clean. Nobody followed me. #clean]
    ~ handover = "clean"
    ~ discipline += 5
-
>>> card s8_cy [Downtown Gym] Lucas turns the envelope over. Two letters in pencil on the back: "C.Y." For a second he goes very still.
+ [What's C.Y.? #ask]
    ~ envelope_ask = "ask"
    LUCAS: Not your concern. #s8_r_cy
+ [Something wrong? #wrong]
    ~ envelope_ask = "wrong"
    ~ ravi_trust += 5
    LUCAS: Nothing that's yours to worry about. #s8_r_wrong
+ [Say nothing. Let him have it. #nothing]
    ~ envelope_ask = "nothing"
    ~ discipline += 5
-
~ envelope_cy = true
LUCAS: I'll get this straight to Victor. #s8_l3
+ [And my cut? #cut]
    ~ cut = "cut"
    LUCAS: Eight hundred. Already counted. Your first proper step forward. #s8_l5
+ [Tell him thanks from me. #thanks]
    ~ cut = "thanks"
    ~ discipline += 5
    LUCAS: He'll hear it. Eight hundred, already counted. Your first proper step forward. #s8_r_thanks
+ [So what happens now? #what_now]
    ~ cut = "what_now"
    ~ ravi_trust += 5
    LUCAS: Now you get paid. Eight hundred, already counted. Your first proper step forward. #s8_r_now
-
>>> shot s8_cash
~ earn("c", 800, "Victor's pay for the delivery")
~ earn("r", 70, "Delivered Victor's parcel")
{ s02_prep == "back":
    ~ earn("c", -100, "Docked for keeping Sal waiting")
    ~ earn("r", -5, "Late to the pickup")
}
{ s02_car == "plate":
    ~ earn("t", 5, "Brought Lucas the sedan's plate")
}
// Clean: on time, no fee paid, nothing that drew attention.
{ s02_prep != "back" and sal_fee != "pay" and s02_car != "knock" and not (sal_fee == "lean" and s02_prep != "scout"):
    ~ job_grade = "clean"
    ~ earn("r", 20, "A clean job")
- else:
    ~ job_grade = "messy"
    ~ earn("r", 5, "The job got done")
}
>>> shot s8_leave

// ── 9. Home: the next job ────────────────────────────────────────────────
>>> shot s9_enter [Rookie's Quarters] 12:40 AM.
>>> shot s9_buzz
>>> message s9_message [Lucas] Boss heard how it went. He wants you on something real. Pays triple. Not like tonight.
>>> card s9_reply [Phone] Lucas is still online.
+ [Reply: "I'm in." #in]
    ~ reply = "in"
    ~ earn("f", 5, "Said yes before hearing the job")
+ [Reply: "Not like tonight how?" #how]
    ~ reply = "how"
    ~ intel += 5
    >>> message s9_answer [Lucas] Another crew's been sniffing round the job. That's all I'll say on the phone.
+ [Turn the phone face down. He can wait. #face_down]
    ~ reply = "face_down"
    ~ independence += 5
-
>>> shot s9_end
>>> complete s9_complete
-> END
