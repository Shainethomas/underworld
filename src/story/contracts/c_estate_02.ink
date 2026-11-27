// Street work: The Housekeeper (estate kit). Mrs Pruett passes the Ashdowns'
// monthly envelope to Victor. This month she froze. The writing hints she needs
// calm and a way out; contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("scared", 250, 12)
~ temp r = 0
>>> title k_title
>>> job k_job [The Housekeeper] Lucas ¦ $250 ¦ Low ¦ Mr Ashdown leaves Victor an envelope with his housekeeper each month. This one never came. Fetch it.
>>> card k_prep [How do you play it?] Lucas says she's done this for years without a hitch. Something's changed.
+ [Bring two of Lucas's boys. Make it official. #muscle]
    ~ k_prepare("muscle")
+ [Leave the car at the gate. Walk up quietly. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas what Mrs Pruett is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Pruett's a nervous sort. Go easy, she spooks. Raise your voice and she'll lock herself in the pantry.
}
>>> shot k_arrive [Hollis Hill] Eleven. The Ashdowns are away. One light on, in the kitchen.
>>> explore k_explore Mrs Pruett's at the foot of the steps. Or look around first.
CONTACT: Oh. You're from Mr Sable. I'm sorry, I wasn't expecting anyone so late. I'd have put the porch light on. #k_open
CONTACT: There's been a car. Every night this week. I can't hand things over with someone watching, can I? I'm sorry. #k_talk1
+ [That car's the gardener's. Crisps on the seat. Nobody's watching you. #press]
    ~ r = k_say(1, "press")
    CONTACT: The gardener's? Is it? Oh. Oh, I do feel silly. #k_good
+ [You did right to be careful. Nobody's cross with you, Mrs Pruett. #charm]
    ~ r = k_say(1, "charm")
    { r >= 2:
        CONTACT: Thank you. Thank you. I've not slept properly since Sunday. #k_good
    - else:
        CONTACT: That's kind. You're kinder than the last one. #k_good
    }
+ [Get the envelope. Now. Or I go in and get it myself. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Please don't. Please. Carrick's only in the garage, I'll scream, I will. #k_bad
-
CONTACT: If Mr Ashdown finds out I've, well. He thinks it goes to the bank. What do I tell him? #k_talk2
+ [Wet footprints from the fountain to your door. It's out there. Let's get it. #press]
    ~ r = k_say(2, "press")
    CONTACT: You saw that. All right. It's under the lip, by the stone fish. #k_good
+ [Tell him nothing. You'll be in bed and it'll be done. I'll see to it. #charm]
    ~ r = k_say(2, "charm")
    { r >= 2:
        CONTACT: ...All right. It's in the fountain. I'm sorry. I didn't know where else to put it. #k_good
    - else:
        CONTACT: In bed. Yes. All right. #k_good
    }
+ [Tell him whatever you like. Just hand it over. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Carrick! Carrick, please! #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Here. It's a bit damp at the corner. Please tell Mr Sable I'm sorry for the fuss. #k_hand_package
    ~ k_payout("the Ashdown envelope")
    ~ k_morning("Mrs Pruett", "Slept all night for the first time this week. Left a little something with Sal. And a lemon cake.", "c40")
- k_outcome == "short":
    CONTACT: There. Some went on the boiler man. It was that or questions, I'm sorry. #k_hand_package
    ~ k_payout("the Ashdown envelope")
    ~ k_morning("Lucas", "Ashdown's envelope came up light. Victor asked why. I said the boiler. Don't make me say it twice.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Mrs Pruett's had enough of you. Off the gravel. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Stop it, stop! Here, take it. It's all there. Please. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: This is what's dry. The rest went in the water. Please just go. #k_after_fight
    }
    ~ k_payout("the Ashdown envelope")
    { k_won:
        ~ k_morning("Lucas", "Ashdown's driver has a black eye and a story about you. Respect is respect. Still. A housekeeper.", "r5")
    - else:
        ~ k_morning("Lucas", "A housekeeper screamed the hill awake. Two squad cars by midnight. Stay home tonight.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
