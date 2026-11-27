// Scene 03 — A Bigger Problem (chapter 1, scene 3). The first dangerous job.
// The job was accepted at Scene 02's debrief; Lucas briefs him at the gym,
// and this one isn't like the last. He's to collect a package from Nico, a contact who owes money
// all over town, at the old Calder rail yard, for $2,400. He spends some of
// what he's earned and chooses how to go in: straight at them, quietly along
// the tracks, or through Nico. The yard is being watched — a grey sedan, the
// Varga crew's, behind the boxcar, and the man in it knows Rookie's name. He
// gets the package and gets out, by fighting, talking or running; at the gym
// he decides how to tell it, and Lucas asks something he shouldn't know to
// ask. Upstairs, Victor: nobody outside the family knew where that pickup was.
//
// Each approach plays its own way: strong-arm walks up to the sedan and can't
// look around afterwards (but hits first in the fight); quiet comes in unseen
// along the tracks (search both places for free, an easier escape, and the
// man never sees his face) but needs Intel 10 or Sal's word; working Nico has
// him meet Rookie and, in the standoff, cause the distraction that lets
// Rookie talk his way out without the Respect it would otherwise take.
//
// Every line Rookie says is the player's pick. Lines are `SPEAKER: words
// #beat_id`; `>>> kind beat_id [label] words` is any other beat. Each beat
// id's staging is in scene03.staging.json. The economy (earn()) is in
// globals.ink and README.md, "Progression". The earlier Scene 03 (the time
// machine) is kept in legacy/first-experiment-2026-11-10/.

INCLUDE globals.ink

-> scene03

=== scene03 ===
~ ledger = ""
~ job_grade = ""
~ s03_heat0 = heat
// The job was accepted at Scene 02's debrief: the scene opens on the details.
>>> title s1_title
>>> shot s2_arrive [Downtown Gym] The next evening.
LUCAS: Here's the job. There's a man called Nico. He's holding something for Victor out at the old Calder rail yard. Twenty past eleven, not before. You collect it, you bring it to me. #s2_l4
LUCAS: Listen. This one isn't like the last job. Get the package, get out. Don't try to be a hero. #s2_l5
+ [What's different? #different]
    ~ different = "different"
    LUCAS: People are asking questions they shouldn't be asking. That's all you need to know. #s2_l7
+ [When have I ever tried to be a hero? #hero]
    ~ different = "hero"
    ~ independence += 5
    LUCAS: Every day since I've known you. And people are asking questions they shouldn't be asking. That's all you need to know. #s2_r_hero
+ [Understood. In and out. #in_out]
    ~ different = "in_out"
    ~ discipline += 5
    LUCAS: Good. Because people are asking questions they shouldn't be asking. That's all you need to know. #s2_r_in_out
-
LUCAS: One more thing. Nico's been jumpy lately. Owes money all over town, and he'll sell anybody to anybody. If he acts strange, you don't wait around. #s2_l8
+ [Then why are we using him? #why_him]
    ~ nico_warn = "why_him"
    LUCAS: Because he's the one holding it. Not my call. #s2_r_why
+ [Strange how? #strange]
    ~ nico_warn = "strange"
    LUCAS: You'll know it when you see it. #s2_r_strange
+ [I can handle Nico. #handle]
    ~ nico_warn = "handle"
    ~ independence += 5
    LUCAS: It's not Nico I'm worried about. #s2_r_handle
-
{ ravi_trust >= 15:
    // Lucas trusts him enough to name the rivals
    LUCAS: Between us? Varga's crew have been seen out that way. Grey sedan. If you see it, you don't play with it. #s2_varga
}
>>> job s2_job [Calder Yard] Victor ¦ $2,400 ¦ High ¦ Collect Victor's package from Nico at the old Calder rail yard at twenty past eleven. Bring it straight back to Lucas.

// ── 3. Prep: what to spend, then how to go in ────────────────────────────
>>> card s2_shop [Before you go] What do you take with you? Whatever you buy, you keep.
+ [Clean plates · $400. Less Heat on every getaway. #plates #need:cash:400]
    ~ s03_shop = "plates"
    ~ gear_plates = true
    ~ earn("c", -400, "Clean plates")
+ {not gear_knuckles} [Knuckle duster · $300. Your counters land easier. #knuckles #need:cash:300]
    ~ s03_shop = "knuckles"
    ~ gear_knuckles = true
    ~ earn("c", -300, "Knuckle duster")
+ [Sal's word on the yard · $250. Know what's waiting. #sal_tip #need:cash:250 #need:contact_sal:1]
    ~ s03_shop = "sal_tip"
    ~ sal_tip = true
    ~ intel += 10
    ~ earn("c", -250, "Sal's word on Calder Yard")
    >>> message s2_sal [Sal] Grey sedan out at Calder since this afternoon. Behind the old boxcar. Two men, maybe one. You didn't hear it from me.
+ [Keep the cash. #save]
    ~ s03_shop = "save"
-
>>> card s2_prep [Prep] How do you go in?
+ [Strong-arm. Drive straight in and let them see me. #strong]
    ~ s03_prep = "strong"
    ~ independence += 5
    LUCAS: Loud. He won't love it. But nobody takes a package off a man walking at them. #s2_r_strong
+ [Quiet. Leave the car and come in along the tracks. #quiet #need:intel:10]
    ~ s03_prep = "quiet"
    ~ discipline += 5
    LUCAS: Smart. Nobody watches the tracks. #s2_r_quiet
+ [Work Nico. Text him first, make him meet me. #nico]
    ~ s03_prep = "nico"
    ~ ravi_trust += 5
    LUCAS: Your neck. Just remember what I said about him. #s2_r_nico
    >>> message s2_nico [Nico] ok. ok. come to the light by my door. dont be early
-
LUCAS: Bring it straight back here. And watch yourself out there. #s2_l9
>>> shot s2_leave
>>> drive s2_drive [Calder Yard] Drive out to the old rail yard.

// ── 4. The rail yard ─────────────────────────────────────────────────────
{
- s03_prep == "quiet":
    -> tracks
- s03_prep == "strong":
    -> straight_in
- else:
    -> through_nico
}

= tracks
>>> shot s3_arrive_tracks [Calder Yard] 11:20 PM. The car is two streets back. You come in along the tracks.
>>> explore s3_explore_quiet Nobody has seen you yet. Look around, then find Nico by his door.
{ yard_gate:
    ~ intel += 5
}
-> meet_nico

= straight_in
>>> shot s3_arrive [Calder Yard] 11:20 PM.
>>> shot s3_direct
-> meet_nico

= through_nico
>>> shot s3_arrive [Calder Yard] 11:20 PM.
>>> explore s3_explore Find Nico. The office door, under the light.
{ yard_gate:
    ~ intel += 5
}
-> meet_nico

= meet_nico
NICO: You're Lucas's guy? You're early. Or late. Doesn't matter. #s3_l1
+ [I'm the one he sent. #sent]
    ~ nico_greet = "sent"
+ [Relax. I'm right on time. #relax]
    ~ nico_greet = "relax"
    ~ discipline += 5
    NICO: Relax. Sure. Easy for you to say. #s3_r_relax
+ [You look like you've seen a ghost. #ghost]
    ~ nico_greet = "ghost"
    ~ independence += 5
    NICO: Ghosts I could live with. #s3_r_ghost
-
{ s03_prep == "nico":
    // he answered the text: he talks before he's asked
    NICO: Car's behind the boxcar. Grey. Been sitting there an hour. And they told me midnight, not twenty past. Somebody's messing with the clock, man. #s3_nico_tells
    ~ nico_time = true
    ~ intel += 5
}
NICO: Did anybody follow you in? You see a car on the way? #s3_l3
+ [No. Should I have? #no]
    ~ on_the_way = "no"
    NICO: No. No reason. Forget I asked. #s3_r_no
+ {yard_gate} [Just your gate. Somebody cut the chain. #chain]
    ~ on_the_way = "chain"
    ~ intel += 5
    NICO: That was me. I lost the key. #s3_r_chain
+ {not yard_gate} [Just you, pacing like a cat. #pacing]
    ~ on_the_way = "pacing"
    NICO: I'm not pacing. I'm thinking. #s3_r_pacing
+ [Who are you expecting, Nico? #expecting]
    ~ on_the_way = "expecting"
    ~ intel += 5
    ~ nico_time = true
    NICO: Nobody. They told me midnight, that's all. Nobody's expecting anybody. #s3_r_expecting
-

// ── 5. The complication: the route the prep chose ────────────────────────
>>> shot s4_flash
>>> shot s4_sedan
{
- s03_prep == "strong":
    ~ approach = "confront"
    -> confront
- s03_prep == "quiet":
    ~ approach = "avoid"
    -> avoid
- else:
    ~ approach = "trust"
    -> trust
}

= confront
~ stranger_seen_face = true
~ earn("h", 15, "Walked straight up to their car")
~ earn("v", 5, "Walked up to the Varga crew's car")
~ earn("r", 10, "Went straight at them")
>>> shot s4c_walk
STRANGER: Evening. #s4c_l1
+ [You lost? #lost]
    ~ stranger_open = "lost"
    STRANGER: Not me. #s4c_r_lost
+ [Who sent you? #who_sent]
    ~ stranger_open = "who_sent"
    ~ intel += 5
    STRANGER: Maybe the same people who sent you. #s4c_r_sent
+ [Nice car. Shame about the tail light. #tail]
    ~ stranger_open = "tail"
    ~ intel += 5
    ~ saw_tail = true
    STRANGER: It's got character. #s4c_r_tail
-
~ heard_name = true
// he remembers what Rookie did before: Scene 01's call, Scene 02's window
STRANGER: You're Rookie, right? Victor's new favourite.{varga_call == "listen": The one who said he was listening. You should've called back.}{varga_call == "refuse": The one who isn't for sale. We'll see.}{varga_call != "listen" and varga_call != "refuse" and s02_car == "knock": The one who knocks on windows.} #s4c_l3
+ [How do you know my name? #how]
    ~ my_name = "how"
    ~ intel += 5
    STRANGER: People talk. #s4c_r_how
+ [Never heard of him. #never]
    ~ my_name = "never"
    ~ independence += 5
    STRANGER: Sure. #s4c_r_never
+ [And who are you? #you]
    ~ my_name = "you"
    STRANGER: Nobody you need to know. #s4c_r_you
-
STRANGER: Get your parcel and go home, kid. Tonight isn't about you. #s4c_l5
~ saw_permit = true
~ intel += 10
>>> shot s4c_dash
>>> shot s4c_back
-> collect

= avoid
NICO: Oh no. No, no, no. Don't look at them. #s4a_l1
+ [Get the package, Nico. Now. #now]
    ~ hurry = "now"
    ~ discipline += 5
+ [Don't look at them. Got it. Just walk. #walk]
    ~ hurry = "walk"
+ [Whatever this is, I don't want to know. #dont_know]
    ~ hurry = "dont_know"
    ~ independence += 5
-
NICO: Okay. Okay. Wait here. #s4a_l3
-> collect

= trust
~ stranger_seen_face = true
~ earn("h", 5, "Stood in the open where they could see you")
NICO: Them? Don't worry about them. #s4t_l1
+ [Friends of yours? #friends]
    ~ hurry = "friends"
+ [Who's in the car, Nico? #whos]
    ~ hurry = "whos"
    ~ intel += 5
+ [Tell me that's your ride. #ride]
    ~ hurry = "ride"
-
NICO: They're with me. Insurance. People don't trust me lately. #s4t_l3
+ [Fine. I believe you. Let's get this done. #fine]
    ~ insurance = "fine"
    ~ nico_trusted = true
    ~ ravi_trust += 5
+ [Insurance against what? #against]
    ~ insurance = "against"
    ~ intel += 5
    NICO: Against nobody. Forget it. #s4t_r_against
+ [You're lying, Nico. #nervous]
    ~ insurance = "nervous"
    ~ independence += 5
    NICO: Makes two of us that think so. #s4t_r_nervous
-
NICO: Wait here. Two minutes. #s4t_l5
-> collect

// ── 6. The package ───────────────────────────────────────────────────────
= collect
>>> shot s5_fetch
NICO: Here. Take it. It goes to Victor. You never saw me. #s5_l1
+ [Pleasure doing business. #pleasure]
    ~ handoff = "pleasure"
    NICO: Sure. Pleasure. #s5_r_pleasure
+ [What's in it, Nico? #whats_in]
    ~ handoff = "whats_in"
    ~ intel += 5
    NICO: Don't. Please. Just take it and go. #s5_r_whats
+ [Come with me. You're not safe here. #come]
    ~ handoff = "come"
    ~ ravi_trust += 5
    NICO: Safer than you. Go. #s5_r_come
-
>>> shot s5_door
// What he can still look at depends on who has seen him: the man by the sedan
// watched the strong-arm walk up, so there's no looking round after.
{
- s03_prep == "strong":
    >>> explore s5_look_strong He's watching every step you take. Get back to the car.
- s03_prep == "quiet":
    >>> explore s5_look_quiet Nobody's looking your way. Get back to the car, or take a look around first.
- else:
    >>> explore s5_look Get back to the car. Or take a look around first.
}
{ heard_nico:
    ~ intel += 10
    { s03_prep != "quiet":
        ~ earn("h", 5, "Lingered at Nico's door")
    }
}
{ yard_sedan:
    ~ saw_permit = true
    ~ intel += 10
    { s03_prep != "quiet":
        ~ earn("h", 10, "Looked in their car while they watched")
    }
}

// ── 7. The confrontation ─────────────────────────────────────────────────
>>> shot s6_block
STRANGER: {heard_name:Change of plan, Rookie.|Kid.} I'll take that box. #s6_l1
+ [Not happening. #fight]
    ~ standoff = "fight"
    ~ earn("h", 5, "A fight in the yard")
    ~ earn("v", 10, "Put hands on a Varga man")
    { s03_prep == "strong":
        // he came in swinging: no waiting for the first punch
        >>> shot s6_first
    - else:
        >>> qte s6_guard
    }
    { gear_knuckles:
        >>> qte s6_counter easy
    - else:
        >>> qte s6_counter
    }
    >>> shot s6_down
    STRANGER: You just made this a lot worse for yourself. #s6_r_fight
    { yard_counter >= 0.5:
        ~ earn("r", 10, "Beat him in a straight fight")
    }
+ {s03_prep != "nico"} [Whoever's paying you, it isn't enough to start a war with Victor. #talk #need:respect:130]
    ~ standoff = "talk"
    -> talked
+ {s03_prep == "nico"} [Whoever's paying you, it isn't enough to start a war with Victor. #talk]
    ~ standoff = "talk"
    >>> caption s6_nico_lights [Calder Yard] Behind him, the yard lights die. Nico, at the office switch. The man looks back, just long enough.
    -> talked
+ [Run for the car. #run]
    ~ standoff = "run"
    >>> shot s6_dash
    { s03_prep == "quiet":
        >>> qte s6_break easy
    - else:
        >>> qte s6_break
    }
    >>> shot s6_free
-
-> getaway

= talked
~ earn("h", 10, "Said Victor's name out loud")
~ earn("v", 5, "Threatened the Varga crew with Victor")
~ earn("r", 15, "Talked down a Varga man")
STRANGER: A war with Victor. You really don't know anything, do you? #s6_r_talk
STRANGER: Go on. Run it home. {stranger_seen_face:We know your face now.|Next time I'll want a look at your face.} #s6_r_talk2
-> getaway

// ── 8. The getaway ───────────────────────────────────────────────────────
= getaway
{ gear_plates and heat - s03_heat0 >= 10:
    ~ earn("h", -10, "Clean plates on the getaway car")
}
>>> shot s7_getaway
>>> drive s7_drive [Downtown Gym] Get back to Lucas. Don't stop.

// ── 9. Lucas ─────────────────────────────────────────────────────────────
>>> shot s8_arrive [Downtown Gym] 12:35 AM.
LUCAS: You're late. #s8_l1
+ [Your contact wasn't exactly making things easy. #contact]
    ~ back_late = "contact"
+ [You said in and out. It wasn't. #not_in_out]
    ~ back_late = "not_in_out"
    ~ independence += 5
+ [I've got it. That's what matters. #got_it]
    ~ back_late = "got_it"
    ~ discipline += 5
-
// How he tells it is the job's last call: straight, bigger than it was, or
// with a bill attached.
LUCAS: What happened? #s8_l3
+ {standoff == "fight"} [A guy from a grey car tried to take it off me. He's having a bad night. #straight]
    ~ report = "fought"
+ {standoff == "talk"} [A guy from a grey car wanted the package. I talked my way past him. #straight]
    ~ report = "talked"
+ {standoff == "run"} [A guy from a grey car grabbed me. I got loose and ran. #straight]
    ~ report = "ran"
+ [I handled it. Them, the car, all of it. Tell Victor that. #play_up]
    ~ report = "play_up"
    ~ s03_call = "play_up"
    ~ earn("r", 10, "Told it bigger than it was")
    LUCAS: All of it. Sure. I'll tell him. #s8_r_play
+ [That job was worth more than twenty-four hundred, and you know it. #more]
    ~ report = "more"
    ~ s03_call = "more"
    ~ earn("c", 400, "Squeezed Lucas for a bigger cut")
    ~ earn("r", -5, "Haggled over Victor's money")
    ~ earn("f", -5, "Haggled over Victor's money")
    LUCAS: Fine. Four hundred more. Don't ever ask him like that. #s8_r_more
-
{ report == "fought" or report == "talked" or report == "ran":
    ~ s03_call = "straight"
    ~ earn("t", 5, "Told Lucas straight")
}
LUCAS: Wait. You saw that car? #s8_l5
+ [Grey sedan. Parked behind the boxcar, lights off. #grey]
    ~ the_car = "grey"
+ {saw_permit} [It had a Downtown Gym permit on the dash, Lucas. Our gym. #permit]
    ~ the_car = "permit"
    ~ intel += 5
+ {not saw_permit and heard_name} [The man in it knew my name. #name]
    ~ the_car = "name"
+ {not saw_permit and not heard_name} [Not close enough. Why? #not_close]
    ~ the_car = "not_close"
+ [Why? Whose car is it? #whose]
    ~ the_car = "whose"
-
>>> shot s8_still
// Nobody has mentioned the time. Lucas does anyway.
LUCAS: Did Nico say anything about the time? #s8_time
+ [Why would he? #why_would]
    ~ time_q = "why_would"
    ~ lucas_time_asked = true
    LUCAS: No reason. #s8_r_why_would
+ {nico_time} [He said they told him midnight. You told me twenty past eleven. #midnight]
    ~ time_q = "midnight"
    ~ lucas_time_asked = true
    ~ intel += 5
    LUCAS: Then somebody told him wrong. Leave it with me. #s8_r_midnight
+ {not nico_time} [No. Should he have? #no]
    ~ time_q = "no"
    LUCAS: Forget it. Long night. #s8_r_no
+ [Not a word. #nothing]
    ~ time_q = "nothing"
    ~ discipline += 5
-
LUCAS: Stay here. #s8_l7
>>> shot s8_call

// ── The pay ──────────────────────────────────────────────────────────────
~ earn("c", 2400, "Victor's pay for Calder Yard")
~ earn("r", 70, "Brought Victor's package home")
{ heat >= 30:
    ~ earn("c", -480, "Cleanup: the yard got too hot")
}
{
- heat - s03_heat0 <= 10 and not (standoff == "fight" and yard_counter < 0.5):
    ~ job_grade = "clean"
    ~ earn("r", 25, "In and out, nothing left behind")
- heat - s03_heat0 <= 25:
    ~ job_grade = "messy"
    ~ earn("r", 10, "The package came home")
- else:
    ~ job_grade = "botched"
}
LUCAS: Your money. {heat >= 30:Less what it costs to clean up after you.|All of it.} Go home. Don't talk about this job with anyone. I'll call you. #s8_l9
+ [Who was in that car, Lucas? #who]
    ~ go_home = "who"
    LUCAS: Not tonight. Go home. #s8_r_who
+ [Fine. Call me. #fine]
    ~ go_home = "fine"
    ~ discipline += 5
+ [Tell Victor I did my job. #tell]
    ~ go_home = "tell"
    ~ don_loyalty += 5
    LUCAS: He knows. That's not the problem. #s8_r_tell
-
>>> shot s8_leave

// ── 10. Victor ───────────────────────────────────────────────────────────
>>> shot s9_victor [Upstairs] The gym is closed. One light is still on.
VICTOR: A grey sedan. You're sure? #s9_l1
VICTOR: Then nobody outside this family knew where that pickup was. #s9_l2
VICTOR: Find out who talked, Lucas. Quietly. #s9_l3
>>> shot s9_end
>>> complete s9_complete
-> END
