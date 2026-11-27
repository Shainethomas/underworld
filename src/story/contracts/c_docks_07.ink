// Street work: Berth Times (docks kit). Zeke, a greedy kid on the mooring
// lines, sells Victor's berth times to the Varga crew. The writing shows a
// boy who thinks everything is a deal; contract.ink decides how each reply
// lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("greedy", 1400, 40)
~ temp r = 0
>>> title k_title
>>> job k_job [Berth Times] Lucas ¦ $1400 ¦ High ¦ Zeke is selling Victor's berth times to the Varga crew. Collect what they paid him. All of it.
>>> card k_prep [How do you play it?] Zeke runs the mooring lines on Pier Nine. He's bought a new jacket every week this month.
+ [Bring two of Lucas's boys. Let him see the car. #muscle]
    ~ k_prepare("muscle")
+ [Come along the quay in the dark. Watch him first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas what Zeke is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Zeke's in it for the money. Talk money, what it pays and what it costs him. Threaten him and he runs to Varga.
}
>>> shot k_arrive [Pier Nine] Two in the morning. A Varga car parked dark at the end of the quay.
>>> explore k_explore Find Zeke. Or look around first.
CONTACT: Victor's new lad. Nice. Want a smoke? First one's free. Second one costs you. #k_open
CONTACT: Times? I tie ropes, mate. Boats come, boats go. If someone pays me to say when, that's a free market. #k_talk1
+ [Victor's berth times are chalked inside container thirty-one. Copied out in your hand. #press]
    ~ r = k_say(1, "press")
    { r >= 2:
        CONTACT: You read my handwriting. Fair play. So what's it worth to you? #k_good
    - else:
        CONTACT: So? #k_good
    }
+ [Free market. Fine. Victor pays better if you're on his side of it. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: Better how? Give me a number and I'm listening. #k_good
+ [Talk, Zeke, or you won't be tying ropes for a while. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Bruno! Bruno, Victor's boy is making threats! #k_bad
-
CONTACT: They gave me fourteen hundred. Say I hand you half and keep feeding them the wrong times. Everybody wins. #k_talk2
+ [The phone under the ladder has one number in it. Victor has it now. Do the sum. #press]
    ~ r = k_say(2, "press")
    { r >= 2:
        CONTACT: You found the phone. Right. All of it, then. Business is business. #k_good
    - else:
        CONTACT: Fine. #k_good
    }
+ [Hand it all over and you're Victor's man on the pier. That pays every week. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: Every week? Now we're talking. All right. #k_good
+ [All of it, Zeke, or you're the next thing in the water. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Bruno! Get over here, he's lost it! #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Fourteen hundred. Varga's money, Victor's pocket. Tell him I'm open for business. #k_hand_cash
    ~ k_payout("Varga's money for the berth times")
    ~ k_morning("Zeke", "Told Varga's lot the Tuesday boat comes Thursday. They're stood on the wrong pier. You owe me.", "r8")
- k_outcome == "short":
    CONTACT: That's what's left. The rest went on jackets. Good jackets, mind. #k_hand_cash
    ~ k_payout("Varga's money for the berth times")
    ~ k_morning("Lucas", "Zeke's still taking Varga's calls. We're watching him. So should you.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Zeke works for Mr Varga now. So does this pier. #k_heavy
    ~ earn("v", 5, "Fought Varga's man on Pier Nine")
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Okay, okay! Take it! Tell Victor it was a misunderstanding. A business misunderstanding. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Bruno says take half and walk. I'd do what Bruno says. #k_after_fight
    }
    ~ k_payout("Varga's money for the berth times")
    { k_won:
        ~ k_morning("Lucas", "Varga's car left Pier Nine at dawn and hasn't come back. The quay knows your name now.", "r10")
    - else:
        ~ k_morning("Lucas", "Varga's crew are saying Pier Nine is theirs now. Lie low. The heat's on you.", "h10")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
