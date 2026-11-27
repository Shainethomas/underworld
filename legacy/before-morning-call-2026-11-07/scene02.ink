// The Other Empire: chapter 1, scene 2.
// Converted from the beat list by scripts/ink-convert.mjs; this file is the source now.
// Staging (shots, blocking, cues) for each tagged beat is in scene02.staging.json.

INCLUDE globals.ink

-> scene02

=== scene02 ===
>>> title s1_title
>>> shot s1_enter [Rookie's Quarters] 11:58 PM. Training is long over. Sleep is not coming.
>>> card s1_unwind [Rookie's Quarters] Midnight. Ravi's call is still going round in his head.
+ [Pick up the old photograph on the nightstand. #photo]
    ~ unwind = "photo"
    ~ don_loyalty += 5
+ [Stand at the mirror for a long moment. #mirror]
    ~ unwind = "mirror"
    ~ independence += 5
+ [Lights out. Tomorrow starts early. #sleep]
    ~ unwind = "sleep"
    ~ discipline += 5
-
{ unwind == "photo":
    >>> shot s1_photo
}
{ unwind == "photo":
    ROOKIE: The day he took me in. I was eleven. #s1_photo_l1
}
{ unwind == "photo":
    ROOKIE: Everything I know came from him. He never lets me forget it. #s1_photo_l2
}
{ unwind == "mirror":
    >>> shot s1_mirror
}
{ unwind == "mirror":
    ROOKIE: The Don's finest creation. Whatever that's worth at midnight. #s1_mirror_l1
}
>>> shot s1_bed
>>> shot s1_sleep 1:12 AM.
>>> shot s1_ring
>>> card s1_wake [1:12 AM] His phone is buzzing on the nightstand. Nobody calls at this hour with good news.
+ [Answer it. #answer]
    ~ wake = "answer"
    ~ discipline += 5
+ [Check who it is first. #check]
    ~ wake = "check"
+ [Let it ring. #ignore]
    ~ wake = "ignore"
    ~ independence += 5
    ~ don_loyalty -= 5
-
{ wake == "check":
    >>> shot s1_check THE DON.
}
{ wake == "ignore":
    >>> shot s1_ignore It stops. Then it starts again. With him, it always starts again.
}
>>> shot s1_up
{ wake == "ignore":
    DON: You let it ring. Don't make a habit of it. #s1_call_ignored
}
{ not (wake == "ignore"):
    DON: Good. You're awake. #s1_call_awake
}
DON: I want you at the research facility. #s1_call_1
ROOKIE: Now? #s1_call_2
DON: Immediately. There's a car downstairs. #s1_call_3
DON: Immediately. There's a car downstairs. #s1_call
+ [I'm on my way. #onway]
    ~ call = "onway"
    ~ don_loyalty += 5
+ [What's at a research facility? #what]
    ~ call = "what"
    ~ don_ambition_knowledge += 5
+ [It's one in the morning. #hour]
    ~ call = "hour"
    ~ independence += 5
    ~ don_loyalty -= 5
-
{ call == "onway":
    DON: Of course you are. #s1_call_onway
}
{ call == "what":
    DON: My future. Yours too, if you hurry. #s1_call_what
}
{ call == "hour":
    DON: Then you'll be the only man awake who matters. Hurry. #s1_call_hour
}
>>> shot s1_hangup
>>> card s1_dress [Rookie's Quarters] One in the morning, a summons from the Don. What does he put on?
+ [The dark jacket. The Don notices these things. #jacket]
    ~ dress = "jacket"
    ~ don_loyalty += 5
+ [The hoodie. He said immediately. #hoodie]
    ~ dress = "hoodie"
    ~ discipline += 5
-
{ dress == "jacket":
    >>> shot s1_dressed
}
>>> shot s1_knock
RAVI: Research facility? Since when does he have one? #s1_l4
ROOKIE: Apparently, there's a lot I don't know. #s1_l5
{ answer == "loyal":
    RAVI: Go on, then. He calls, the son of the house comes running. #s1_l5_loyal
}
{ answer == "free":
    RAVI: And maybe don't tell him what you're capable of tonight. #s1_l5_free
}
{ dress == "jacket":
    RAVI: The jacket, too. You really want him to like you. #s1_l5_jacket
}
RAVI: Try not to get yourself into trouble. #s1_l6
RAVI: Try not to get yourself into trouble. #s1_choice
+ [Trouble usually finds me first. #trouble]
    ~ farewell = "trouble"
    ~ independence += 5
+ [If he calls, I go. That's the job. #job]
    ~ farewell = "job"
    ~ don_loyalty += 5
+ [If I'm not back by morning, come looking. #cover]
    ~ farewell = "cover"
    ~ discipline += 5
    ~ ravi_alerted = true
-
{ farewell == "trouble":
    RAVI: That's exactly what worries me. #s1_r_trouble
}
{ farewell == "job":
    RAVI: Spoken like his finest creation. #s1_r_job
}
{ farewell == "cover":
    RAVI: Morning. Got it. Now go, before he calls again. #s1_r_cover
}
>>> shot s1_leave
>>> shot s1_city [Across the City] Past the last of the lights. Wherever the Don keeps his secrets, it is not on any map.
>>> card s1_drive [Across the City] The partition is up. The driver hasn't said a word since the estate.
+ [Knock on the partition. Ask where they are going. #ask]
    ~ drive = "ask"
    ~ independence += 5
+ [Quietly try the door handle. #doors]
    ~ drive = "doors"
    ~ discipline += 5
+ [Sit back. The Don sent the car. That is enough. #trust]
    ~ drive = "trust"
    ~ don_loyalty += 5
-
{ drive == "ask":
    DRIVER: Somewhere you've never been, sir. Sit back and enjoy the ride. #s1_drive_ask
}
{ drive == "doors":
    >>> caption s1_drive_doors [Across the City] Locked. From the front.
}
{ drive == "trust":
    >>> caption s1_drive_trust [Across the City] The city slides past the glass. He lets it.
}
>>> shot s1_city_portal [Industrial District] 1:40 AM. A private road with no name.
>>> shot s2_bay [Sublevel 4] Four storeys under an empty lot. Guards, scanners, steel doors.
>>> shot s2_out
SENTRY: Phone, keys, anything with a battery. You'll get them back on the way out. #s2_frisk
SENTRY: Phone, keys, anything with a battery. You'll get them back on the way out. #s2_phone
+ [Here. All of it. #hand]
    ~ phone = "hand"
    ~ discipline += 5
+ [The Don invited me. Ask him. #push]
    ~ phone = "push"
    ~ independence += 5
+ [Hand over the keys. Keep the phone. #hide]
    ~ phone = "hide"
    ~ independence += 5
-
{ phone == "hand":
    SENTRY: Appreciated. Through the door, palm on the plate. #s2_phone_hand
}
{ phone == "push":
    SENTRY: He did. He also wrote the rule. Phone. #s2_phone_push
}
{ phone == "push":
    >>> caption s2_phone_push2 Rookie hands it over. The guard does not blink.
}
{ phone == "hide":
    SENTRY: Arms out. #s2_phone_hide
}
{ phone == "hide":
    >>> qte s2_nerve
}
{ (phone == "hide" && nerve >= 0.67):
    SENTRY: Clean. Go on. #s2_nerve_ok
}
{ (phone == "hide" && not (nerve >= 0.67)):
    SENTRY: Nice try. I will take that too. #s2_nerve_bad
}
{ (phone == "hide" && not (nerve >= 0.67)):
    ROOKIE: Worth a shot. #s2_nerve_bad2
}
>>> shot s2_walk [Sublevel 4] One door left. It answers to one hand at a time.
>>> qte s2_palm
>>> shot s2_blast
>>> shot s2_corridor [Research Facility] Glass, steel and silence. Scientists working through the night.
>>> shot s2_labs
DON: Welcome to the other side of my empire. #s2_l1
ROOKIE: I didn't know you owned a research facility. #s2_l2
DON: There are many things you don't know about me. #s2_l3
ROOKIE: Apparently. #s2_l4
{ answer == "free":
    DON: You know what you're capable of, you said. Tonight, we find out. #s2_l4_free
}
{ answer == "loyal":
    DON: You said you would never disappoint me. Tonight, we shall see. #s2_l4_loyal
}
{ drive == "ask":
    DON: My driver says you asked a lot of questions on the way here. #s2_l4_driver
}
{ (phone == "hide" && not (nerve >= 0.67)):
    DON: Security tells me you tried to keep your phone. #s2_l4_phone
}
{ (phone == "hide" && not (nerve >= 0.67)):
    ROOKIE: Old habit. #s2_l4_phone2
}
{ (phone == "hide" && not (nerve >= 0.67)):
    DON: Lose it. #s2_l4_phone3
}
DON: Come. I want you to see something. #s2_l5
>>> shot s2_deck [Observation Deck] Beyond the glass, something enormous waits in the dark.
>>> explore s2_explore The Don is waiting at the window. Look around first if you like.
>>> shot s3_meet
SCIENTIST: Good evening. #s3_l1
DON: Doctor, this is the man I told you about. #s3_l2
SCIENTIST: Ah. The Don's finest creation. #s3_l3
ROOKIE: That's what he calls me. #s3_l4
SCIENTIST: Then I hope you live up to the title. #s3_l5
SCIENTIST: Welcome to Project Chronos. #s3_l6
ROOKIE: What's Chronos? #s3_l7
SCIENTIST: A way to travel through time. #s3_l8
>>> shot s3_pause
ROOKIE: You're telling me you can send someone into the past? #s3_l9
SCIENTIST: We believe we can. #s3_l10
ROOKIE: That's not exactly reassuring. #s3_l11
>>> shot s4_turn
>>> shot s4_lights
>>> shot s4_orbit
>>> shot s4_top [Project Chronos] Rings within rings, and the hum of something drawing a great deal of power.
SCIENTIST: We have successfully transferred small objects across temporal boundaries. #s4_l1
ROOKIE: Temporal boundaries? #s4_l2
SCIENTIST: Time. We have managed to send objects into a different point in history and retrieve them. #s4_l3
SCIENTIST: Would you like to see it? You could start the cycle yourself. #s4_offer
SCIENTIST: Would you like to see it? You could start the cycle yourself. #s4_honours
+ [Show me how. #press]
    ~ honours = "press"
    ~ timeline_knowledge += 5
+ [Your machine, Doctor. I'll watch. #watch]
    ~ honours = "watch"
    ~ scientist_trust += 5
+ [Let him do it. It's his money. #don]
    ~ honours = "don"
    ~ don_loyalty += 5
-
{ honours == "don":
    DON: I don't press buttons. I own them. Doctor. #s4_honours_don
}
{ honours == "press":
    >>> shot s4_console
}
{ honours == "press":
    SCIENTIST: The field drifts as it charges. Hold it steady on each peak. Gently. #s4_console_l1
}
{ honours == "press":
    >>> qte s4_calibrate
}
>>> shot s4_demo [Live Test] Sample forty-two, locked in the field.
>>> shot s4_pulse
>>> shot s4_gone The cradle is empty.
>>> shot s4_back
{ (honours == "press" && calibration >= 0.67):
    SCIENTIST: A perfect return. Not a microsecond out. Steady hands. #s4_steady
}
{ (honours == "press" && calibration >= 0.67):
    ROOKIE: I was trained by the best. #s4_steady2
}
{ (honours == "press" && not (calibration >= 0.67)):
    SCIENTIST: It came back. Eleven seconds late. These things are... sensitive. #s4_shaky
}
{ (honours == "press" && not (calibration >= 0.67)):
    DON: Eleven seconds. Imagine if that had been a person. #s4_shaky2
}
DON: Well? #s4_well
DON: Well? #s4_react
+ [That's... incredible. #awe]
    ~ reaction = "awe"
    ~ don_loyalty += 5
+ [Whoever controls this controls everything. #power]
    ~ reaction = "power"
    ~ don_ambition_knowledge += 5
+ [That's a lot of power for one room. #wary]
    ~ reaction = "wary"
    ~ scientist_trust += 5
-
{ reaction == "awe":
    DON: Incredible is what I pay for. #s4_r_awe
}
{ reaction == "power":
    DON: Now you're starting to think like me. #s4_r_power
}
{ reaction == "wary":
    SCIENTIST: More than you'd think. Far more. #s4_r_wary
}
ROOKIE: And people? #s4_l4
SCIENTIST: That's what we're trying to establish. #s4_l5
- (s5_hub)
SCIENTIST: You have questions. Ask them. #s5_hub
+ {not asked_risks} [What are the risks? #risks]
    ~ question = "risks"
    ~ timeline_knowledge += 5
    ~ asked_risks = true
+ {not asked_ambition} [What does the Don plan to gain? #ambition]
    ~ question = "ambition"
    ~ don_ambition_knowledge += 5
    ~ asked_ambition = true
+ {not asked_worked} [Has it ever worked before? #worked]
    ~ question = "worked"
    ~ scientist_trust += 5
    ~ asked_worked = true
+ [I've heard enough. #done]
    ~ question = "done"
-
{ question == "risks":
    SCIENTIST: We don't know the full extent. A destination can be reached, but returning safely is another challenge. #s5_risks_1
}
{ question == "risks":
    ROOKIE: So someone could get stuck? #s5_risks_2
}
{ question == "risks":
    SCIENTIST: That is one possibility. #s5_risks_3
}
{ question == "ambition":
    SCIENTIST: Ask him. #s5_ambition_1
}
{ question == "ambition":
    DON: When this works, nobody will be able to compete with us. Not governments. Not corporations. Nobody. #s5_ambition_2
}
{ question == "ambition":
    ROOKIE: An empire that controls time? #s5_ambition_3
}
{ question == "ambition":
    DON: An empire that controls everything. #s5_ambition_4
}
{ question == "worked":
    SCIENTIST: We have successfully transferred objects. We have also received data from different temporal destinations. #s5_worked_1
}
{ question == "worked":
    ROOKIE: But nobody has travelled? #s5_worked_2
}
{ question == "worked":
    SCIENTIST: Not a human subject. #s5_worked_3
}
{(not (question == "done") && not ((asked_risks && asked_ambition && asked_worked))): -> s5_hub}
SCIENTIST: We've reached a point where further progress requires a living subject. #s6_l1
ROOKIE: Then why hasn't anyone volunteered? #s6_l2
SCIENTIST: Because we cannot guarantee what happens after activation. #s6_l3
DON: People are afraid of what they don't understand. #s6_l4
SCIENTIST: This isn't a matter of courage. We are dealing with something we have never tested. #s6_l5
DON: Doctor, I didn't invest billions to hear reasons why something cannot be done. #s6_l6
DON: Doctor, I didn't invest billions to hear reasons why something cannot be done. #s6_side
+ [He's telling you it isn't ready. #doctor]
    ~ side = "doctor"
    ~ scientist_trust += 10
    ~ don_loyalty -= 5
+ [Then find a way, Doctor. #don]
    ~ side = "don"
    ~ don_loyalty += 10
    ~ scientist_trust -= 5
+ [Stay out of it. #quiet]
    ~ side = "quiet"
    ~ discipline += 5
-
{ side == "doctor":
    DON: He tells me a great many things. Most of them cost money. #s6_side_doctor
}
{ side == "doctor":
    SCIENTIST: ...Thank you. #s6_side_doctor2
}
{ side == "don":
    SCIENTIST: A way. Of course. #s6_side_don
}
{ side == "don":
    DON: You see, Doctor? He understands. #s6_side_don2
}
{ side == "quiet":
    >>> shot s6_side_quiet Rookie keeps his mouth shut. Both of them notice.
}
ROOKIE: And what happens if the experiment fails? #s6_l7
SCIENTIST: We don't know. #s6_l8
{ scientist_trust >= 10:
    SCIENTIST: If anyone asks you to step inside that ring... talk to me first. #s6_l8_trust
}
>>> shot s6_pause
DON: Interesting, isn't it? #s6_l9
DON: Interesting, isn't it? #s6_stance
+ [Interesting isn't the word I'd use. #word]
    ~ stance = "word"
    ~ independence += 5
+ [You want someone to go through. #someone]
    ~ stance = "someone"
    ~ don_ambition_knowledge += 5
+ [Say nothing. Look at the machine. #silent]
    ~ stance = "silent"
-
{ stance == "word":
    DON: No. But it's the one you'll remember. #s6_r_word
}
{ stance == "someone":
    DON: I want the right someone. #s6_r_someone
}
>>> shot s6_look
>>> shot s6_rings
{ side == "doctor":
    >>> shot s6_close_doctor Behind the glass, the doctor is watching him. So is the Don.
}
{ side == "don":
    >>> shot s6_close_don The Don looks at the machine the way he looks at a winning hand.
}
{ (phone == "hide" && nerve >= 0.67):
    >>> shot s6_phone In his pocket, the phone he was never supposed to keep.
}
>>> complete s6_complete
-> END
