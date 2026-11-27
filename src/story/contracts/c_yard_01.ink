// Street work: The Copper Run (yard kit). Dez, a greedy copper thief, owes
// Victor his cut. The writing hints he only listens to money and numbers;
// contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("greedy", 300, 15)
~ temp r = 0
>>> title k_title
>>> job k_job [The Copper Run] Lucas ¦ $300 ¦ Low ¦ Dez owes Victor a cut of the copper he strips out of the yard. Collect it.
>>> card k_prep [How do you play it?] Dez is expecting somebody. He just doesn't know it's you.
+ [Bring two of Lucas's boys. Let him see the car. #muscle]
    ~ k_prepare("muscle")
+ [Walk in along the tracks. Watch him first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal what Dez is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Dez? Counts his change twice. Talk numbers and he'll listen. Talk tough and he'll call his cousin.
}
>>> shot k_arrive [Calder Yard] Ten at night. A light in the old signal office.
>>> explore k_explore Find Dez. Or look around first.
CONTACT: Victor's new boy. Lucas said you'd come. Lucas didn't say you'd be so young. #k_open
CONTACT: Look, the market's dead. Copper's down. I can do half this month, the rest when it picks up. #k_talk1
+ [Copper's not down, Dez. You got paid Tuesday. In cash. #press]
    ~ r = k_say(1, "press")
    { r >= 2:
        CONTACT: ...You've been in my van. Fine. Fine! You've done your sums. #k_good
    - else:
        CONTACT: Who told you about Tuesday? #k_good
    }
+ [Half now is fine. Victor remembers people who pay on time. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: That's all I'm saying. A man has to eat. #k_good
+ [Pay all of it, or I break your hands. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Easy. Easy! My cousin's just over there, you know. #k_bad
-
CONTACT: So what's it going to be? Half now, half next month, and nobody gets excited? #k_talk2
+ [Do the maths. Short Victor and you lose the whole yard. #press]
    ~ r = k_say(2, "press")
    { r >= 2:
        CONTACT: ...All right. All of it. Don't tell him I argued. #k_good
    - else:
        CONTACT: Numbers, numbers. Fine. #k_good
    }
+ [Pay it all and I'll tell Victor you're reliable. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: Reliable. I like that. Sounds like money. #k_good
+ [Last chance, Dez. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: That's it. Teo! #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: All of it. Counted twice. Tell Victor the copper business is very healthy. #k_hand_cash
    ~ k_payout("Victor's cut of the copper")
    ~ k_morning("Dez", "Found another signal box. Victor gets his cut early this time. Tell him.", "r5")
- k_outcome == "short":
    CONTACT: Most of it. The rest is... coming. Don't look at me like that. #k_hand_cash
    ~ k_payout("Victor's cut of the copper")
    ~ k_morning("Dez", "Rest of the money's at Sal's. Don't come to the yard again.", "c60")
- else:
    >>> shot k_heavy_in
    HEAVY: Dez says you're bothering him. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: All right! All right. Take it. Take it and go. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Here. Half. Now get out before he gets up again. #k_after_fight
    }
    ~ k_payout("Victor's cut of the copper")
    { k_won:
        ~ k_morning("Lucas", "Dez's cousin is telling everyone you put him down. Victor's smiling. Don't make it a habit.", "r5")
    - else:
        ~ k_morning("Lucas", "Heard about the yard. Lie low tonight. People are talking.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
