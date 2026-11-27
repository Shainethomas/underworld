// Street work: The Engine Shed (yard kit). Tanner used to run for Victor; now
// he strips stolen cars in the engine shed under Varga's wing and calls it his.
// The writing hints he only respects someone who stands up to him;
// contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("proud", 1300, 38)
~ temp r = 0
>>> title k_title
>>> job k_job [The Engine Shed] Victor ¦ $1,300 ¦ High ¦ Tanner strips cars in the engine shed under Varga's wing. Victor wants his share of it.
>>> card k_prep [How do you play it?] Tanner used to run for Victor. Now he runs the engine shed, and says it's his.
+ [Bring two of Lucas's boys. Let Varga's lot see them. #muscle]
    ~ k_prepare("muscle")
+ [Climb the coal stage. Watch who's in the shed. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal about Tanner. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Tanner thinks he's royalty now. He only respects a hard man. Explain things and he hears an insult.
}
>>> shot k_arrive [Calder Yard] One in the morning. Angle grinders throwing sparks past the signal office.
>>> explore k_explore Find Tanner. Or look around first.
CONTACT: Victor's errand boy. I used to fetch his coffee too. Now look at me. Look at all this. #k_open
CONTACT: This shed's mine. I made it pay. Victor never did. So what does he think he's owed? #k_talk1
+ [You pay Varga half of everything. It's in your book. You're their tenant. #press]
    ~ r = k_say(1, "press")
    CONTACT: You read my book? That's an arrangement. Between men. You wouldn't know. #k_bad
+ [Nobody says you didn't build something. Victor just wants what's his. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: At least you can see it. Most of his lot can't see past their noses. #k_good
+ [He's owed the shed. You're standing in it. Pay, or I take it off you. #threaten]
    ~ r = k_say(1, "threaten")
    { r >= 2:
        CONTACT: ...Bold. Walking in here on your own. Fine. Let's talk like grown men. #k_good
    - else:
        CONTACT: Big talk. #k_good
    }
-
CONTACT: Say I pay Victor. Varga's lot ask why. And I don't answer to anyone, me. Not any more. #k_talk2
+ [Varga's mark is on every crate. You answer to them already. Pay Victor too. #press]
    ~ r = k_say(2, "press")
    CONTACT: Don't explain my own business to me. I was running this when you were on the bus. #k_bad
+ [Pay Victor and tell Varga it was your call. A man who picks his side. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: My call. Yeah. That's how I'd put it. #k_good
+ [Tonight you answer to me. Pay, or Varga can find themselves a new tenant. #threaten]
    ~ r = k_say(2, "threaten")
    { r >= 2:
        CONTACT: ...You've got nerve. More than his last three. Szabo, bring the bag. #k_good
    - else:
        CONTACT: You reckon. #k_good
    }
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Victor's money. All of it. Tell him Tanner says no hard feelings. Tell him I said it first. #k_hand_cash
    ~ k_payout("Victor's share from the engine shed")
    ~ k_morning("Tanner", "Varga's lot moved their crates out this morning. Said the shed felt crowded. Your doing?", "r10")
- k_outcome == "short":
    CONTACT: Most of it. The rest is Varga's. Take it up with them, if you're brave. #k_hand_cash
    ~ k_payout("Victor's share from the engine shed")
    ~ k_morning("Tanner", "Szabo wants your name. I haven't given it him. Yet.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: The shed's Varga's. So's the boy. You're leaving. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    ~ earn("v", 5, "Fought Varga's man in the engine shed")
    { k_won:
        >>> shot k_down
        CONTACT: Enough! Szabo, leave it. Give him the bag. He's earned it. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: There. Half. Victor can come for the rest himself. #k_after_fight
    }
    ~ k_payout("Victor's share from the engine shed")
    { k_won:
        ~ k_morning("Lucas", "Varga lost a man and a shed in one night. Victor wants to buy you a drink. Watch your back.", "r10")
    - else:
        ~ k_morning("Lucas", "Varga's crew are toasting you in the engine shed. Stay off the streets.", "h10")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
