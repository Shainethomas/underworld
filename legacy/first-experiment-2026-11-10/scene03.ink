// The First Experiment: chapter 1, scene 3.
// Converted from the beat list by scripts/ink-convert.mjs; this file is the source now.
// Staging (shots, blocking, cues) for each tagged beat is in scene03.staging.json.

INCLUDE globals.ink

-> scene03

=== scene03 ===
>>> title s1_title
>>> shot s1_open [The Chronos Chamber] 2:04 AM. The last checks are done. Nobody has gone home.
SCIENTIST: We've completed the final preparations. #s1_l1
VICTOR: Then what are we waiting for? #s1_l2
SCIENTIST: We still need a volunteer. #s1_l3
VICTOR: You have an entire organisation of people working on this project. #s1_l4
SCIENTIST: They understand the risks. Nobody has agreed to be the first human subject. #s1_l5
VICTOR: Interesting. Everyone wants to change the world until they're asked to take the first step. #s1_l6
>>> shot s1_silence Victor looks around the chamber. No one answers.
>>> explore s1_explore Take a look at the chamber before anyone decides anything.
- (s1_hub)
SCIENTIST: Ask what you want. I'd rather someone in this room understood. #s1_hub
+ {not asked_danger} [What makes this so dangerous? #danger]
    ~ risk = "danger"
    ~ timeline_knowledge += 5
    ~ asked_danger = true
+ {not asked_odds} [How likely is this to succeed? #odds]
    ~ risk = "odds"
    ~ timeline_knowledge += 5
    ~ asked_odds = true
+ {not asked_stranded} [What happens if the subject cannot return? #stranded]
    ~ risk = "stranded"
    ~ timeline_knowledge += 5
    ~ asked_stranded = true
+ [That's enough. #enough]
    ~ risk = "enough"
-
{ risk == "danger":
    SCIENTIST: We've moved objects. Never a living body. A body is a system, and every part of it has to arrive at once. #s1_danger_1
}
{ risk == "danger":
    SCIENTIST: And the machine doesn't always behave the same way twice. We still don't know why. #s1_danger_2
}
{ risk == "odds":
    SCIENTIST: Reaching the destination? Every time. We hit the coordinates on every test. #s1_odds_1
}
{ risk == "odds":
    ROOKIE: And coming back? #s1_odds_2
}
{ risk == "odds":
    SCIENTIST: Returning a living subject has never been tested. I can't give you a number I don't have. #s1_odds_3
}
{ risk == "stranded":
    SCIENTIST: Then he stays wherever he lands. Whenever he lands. #s1_stranded_1
}
{ risk == "stranded":
    ROOKIE: How far apart are the two points? #s1_stranded_2
}
{ risk == "stranded":
    SCIENTIST: On paper, a year. In practice, we don't know how time passes between here and there. #s1_stranded_3
}
{(not (risk == "enough") && not ((asked_danger && asked_odds && asked_stranded))): -> s1_hub}
VICTOR: Perhaps we should abandon the entire project. #s2_abandon
>>> shot s2_look
>>> card s2_reason [The Chronos Chamber] Every eye in the room is on the floor. Rookie's are on the machine. Why does he step forward?
+ [Because Victor needs someone, and he has never let Victor down. #don]
    ~ reason = "don"
    ~ don_loyalty += 5
    ~ volunteered = true
+ [Because he wants to see it with his own eyes. #see]
    ~ reason = "see"
    ~ independence += 5
    ~ volunteered = true
+ [Because somebody has to go first. #someone]
    ~ reason = "someone"
    ~ experiment_commitment += 5
    ~ volunteered = true
-
ROOKIE: I'll do it. #s2_l1
>>> shot s2_turn Everyone turns.
SCIENTIST: What? #s2_l2
+ [I said I'll do it. #said]
    ~ insist = "said"
+ [You heard me. #heard]
    ~ insist = "heard"
    ~ independence += 5
+ [Someone has to. Let it be me. #me]
    ~ insist = "me"
    ~ experiment_commitment += 5
-
VICTOR: Now that's the attitude I've come to expect. #s2_l4
SCIENTIST: Wait. You haven't understood what you're agreeing to. #s2_l5
+ [I understand enough. #enough]
    ~ understand = "enough"
+ [Then tell me what I'm agreeing to. #tell]
    ~ understand = "tell"
    ~ scientist_trust += 5
    SCIENTIST: Then hear the one part that matters. #s2_r_tell
+ [Victor trusts it. That's enough for me. #trusts]
    ~ understand = "trusts"
    ~ don_loyalty += 5
-
SCIENTIST: We cannot guarantee your return. #s2_l7
+ [Then make sure you do your job. #job]
    ~ no_guarantee = "job"
+ [Nobody guarantees anything in my line of work. #line]
    ~ no_guarantee = "line"
    ~ independence += 5
+ [I'll take the chance. #chance]
    ~ no_guarantee = "chance"
    ~ experiment_commitment += 5
-
{ scientist_trust >= 10:
    SCIENTIST: I told you to talk to me first. This is not talking to me first. #s2_l8_warned
}
>>> shot s2_uneasy
VICTOR: Doctor, prepare the chamber. #s2_l9
>>> shot s3_open [Final Preparations] The sample mast sinks into the platform. What it leaves is a space the size of a man.
>>> shot s3_belongings Phone. Watch. Wallet. Everything that ties him to tonight goes on the tray.
{ (phone == "hide" && nerve >= 0.67):
    SCIENTIST: And the phone Security missed. #s3_phone_1
}
{ (phone == "hide" && nerve >= 0.67):
    ROOKIE: ...You noticed. #s3_phone_2
}
{ (phone == "hide" && nerve >= 0.67):
    SCIENTIST: Nothing goes into that field that I haven't accounted for. Nothing. #s3_phone_3
}
>>> shot s3_sensors Sensors at the temples, the wrists, over the heart. On his left wrist, a steel band: the return beacon.
>>> shot s3_don_glass Victor has gone back up. He watches from behind the glass.
>>> shot s3_rack The doctor checks the return system twice. Then a third time.
SCIENTIST: Once you enter, we'll initiate the transfer. #s3_l1
SCIENTIST: Your destination will be approximately one year in the past. #s3_l2
+ [Approximately? #approx]
    ~ approx = "approx"
+ [Why a year? #why_year]
    ~ approx = "why_year"
    ~ timeline_knowledge += 5
+ [A year. Fine. #fine]
    ~ approx = "fine"
    ~ experiment_commitment += 5
-
SCIENTIST: We can control the destination coordinates, but we don't yet understand how time will behave between the two points. #s3_l4
+ [And getting back? #back]
    ~ getting_back = "back"
    SCIENTIST: The return signal should bring you back to this chamber. #s3_l6
+ [So you're guessing. #guessing]
    ~ getting_back = "guessing"
    ~ independence += 5
    SCIENTIST: Calculating. Then hoping. The return signal should bring you back to this chamber. #s3_r_guessing
+ [What do you need from me? #need]
    ~ getting_back = "need"
    ~ scientist_trust += 5
    SCIENTIST: Stand still and keep that band on your wrist. The return signal should bring you back to this chamber. #s3_r_need
-
+ [Should? #should]
    ~ should = "should"
+ ["Should" is a big word, Doctor. #big_word]
    ~ should = "big_word"
    ~ independence += 5
+ [Then let's find out. #find_out]
    ~ should = "find_out"
    ~ experiment_commitment += 5
-
SCIENTIST: That's why this is an experiment. #s3_ready
+ [I'm ready. Start the experiment. #start]
    ~ ready = "start"
    ~ experiment_commitment += 10
+ [Make sure I can return. #return]
    ~ ready = "return"
    ~ scientist_trust += 10
+ [If I don't come back, tell them I didn't hesitate. #hesitate]
    ~ ready = "hesitate"
    ~ scientist_trust += 5
-
{ ready == "start":
    SCIENTIST: Very well. Onto the platform. #s3_r_start
}
{ ready == "return":
    SCIENTIST: I will bring you back. You have my word, for whatever my word is worth down here. #s3_r_return
}
{ ready == "hesitate":
    SCIENTIST: No. You'll come back and tell them yourself. That isn't a request. #s3_r_hesitate
}
>>> shot s4_walk
>>> shot s4_inside The cage rises out of the plinth around him and locks.
>>> qte s4_lock
SCIENTIST: Chronos system online. #s4_l1
SCIENTIST: Temporal coordinates locked. #s4_l2
SCIENTIST: Destination: One year prior. #s4_l3
VICTOR: Let's see what the future holds. #s4_l4
SCIENTIST: Initiating transfer in three... #s4_l5
SCIENTIST: two... #s4_l6
SCIENTIST: one. #s4_l7
>>> shot s4_build
>>> shot s4_transfer
>>> shot s5_wake Cold air. Birds. Somewhere, bread is baking.
>>> shot s5_up
ROOKIE: What the hell... #s5_l1
>>> shot s5_check The band on his wrist: NO SIGNAL.
ROOKIE: Come on... #s5_l2
>>> explore s5_find Find a date. Something here has to say when this is.
{ date_source == "newspaper":
    >>> shot s5_paper [The City Herald] MONDAY, 3 NOVEMBER 2025
}
{ date_source == "display":
    >>> shot s5_display [City Information] MON 03 NOV 2025 · 06:48
}
ROOKIE: One year... #s5_l3
>>> shot s5_pause
ROOKIE: It actually worked. #s5_l4
>>> shot s5_tower Across the avenue, Meridian Tower. In his time it is sixty floors of glass. Here it is a steel frame and a crane.
>>> explore s5_look The signal will find you. Until then, look around.
>>> shot s5_wait_1 The signal doesn't come that morning.
>>> shot s5_wait_2 Or that week. Or that month.
>>> card s5_year [One Year Earlier] Autumn turns to winter, winter to spring. The tower climbs. How does he spend the year he was never meant to have?
+ [Lying low. Touching nothing. Changing nothing. #low]
    ~ year = "low"
    ~ experiment_commitment += 5
+ [Watching Victor's people from a distance. #watch]
    ~ year = "watch"
    ~ don_ambition_knowledge += 5
+ [Finding out who burns down Rossi's. #match]
    ~ year = "match"
    ~ independence += 5
-
{ year == "low":
    ROOKIE: Touch nothing. Change nothing. Just wait. #s5_year_low
}
{ year == "watch":
    ROOKIE: Victor a year younger, making the same moves. I know how every one of them ends. #s5_year_watch
}
{ year == "match":
    ROOKIE: Rossi's burns in the spring. Somebody lights it. I'm going to see who. #s5_year_match
}
>>> shot s6_signal [Late October] The band on his wrist lights up. SIGNAL ACQUIRED.
ROOKIE: Finally. #s6_l1
>>> shot s6_pull
>>> shot s7_down [The Chronos Chamber] The cage stands empty. The return signal is running.
>>> shot s7_back
>>> shot s7_rush The technicians run to him. Victor does not.
VICTOR: You're back. #s7_l1
+ [Where else would I go? #where]
    ~ welcome = "where"
+ [Told you I would. #told]
    ~ welcome = "told"
    ~ independence += 5
+ [Did it work? #worked]
    ~ welcome = "worked"
    ~ experiment_commitment += 5
-
{ ready == "hesitate":
    SCIENTIST: You came back. Now you can tell them yourself. #s7_l2_hesitate
}
SCIENTIST: How long were you there? #s7_l3
+ [Almost a year. #year]
    ~ how_long = "year"
+ [A year. Give or take a few days. #give_take]
    ~ how_long = "give_take"
    ~ timeline_knowledge += 5
+ [Long enough to watch the seasons turn. #seasons]
    ~ how_long = "seasons"
-
SCIENTIST: What? #s7_l5
+ [I was there for almost a year. I saw the city. I walked around. I found the date. #told_all]
    ~ year_told = "told_all"
    ~ scientist_trust += 5
+ [A year, Doctor. I counted every day of it. #counted]
    ~ year_told = "counted"
    ~ timeline_knowledge += 5
+ [Check your clocks. #clocks]
    ~ year_told = "clocks"
    ~ independence += 5
-
>>> shot s7_clock The doctor looks up at the lab clock.
SCIENTIST: Impossible. #s7_l7
ROOKIE: What? #s7_l8
SCIENTIST: Only one minute has passed here. #s7_l9
>>> shot s7_pause
ROOKIE: One minute? #s7_l10
SCIENTIST: According to our system, you disappeared for exactly sixty seconds. #s7_l11
+ [Then your machine doesn't just move people through time. It changes how time passes. #changes]
    ~ conclusion = "changes"
    ~ timeline_knowledge += 5
+ [A year for me. A minute for you. #minute]
    ~ conclusion = "minute"
+ [So nobody here even missed me. #missed]
    ~ conclusion = "missed"
    ~ independence += 5
-
>>> shot s7_disbelief The doctor stares at the machine as if he has never seen it before.
VICTOR: Now that's interesting. #s7_l14
>>> complete s7_complete
-> END
