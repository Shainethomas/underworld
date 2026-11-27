// Street work: The Stamp (docks kit). Ambrose Kell, a proud old customs
// man, is holding back the papers Sal paid for. The writing shows a man
// who lives on his reputation; contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("proud", 700, 22)
~ temp r = 0
>>> title k_title
>>> job k_job [The Stamp] Sal ¦ $700 ¦ Medium ¦ Kell owes Sal stamped customs papers for Thursday's boat. He wants Victor to come in person. Get them.
>>> card k_prep [How do you play it?] Kell stamped papers on this quay for thirty years. He's never let anybody forget it.
+ [Bring two of Lucas's boys. Let him see the car. #muscle]
    ~ k_prepare("muscle")
+ [Come in along the quay. Watch him first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal what Kell is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Kell's proud. Thinks he's above the lot of us. He only respects a hard man. Show him sums and he sulks.
}
>>> shot k_arrive [Pier Nine] Midnight. The old customs office at the end of the pier, a gramophone going inside.
>>> explore k_explore Find Kell. Or look around first.
CONTACT: They've sent a boy. Thirty years I stamped papers on this quay, and Victor Sable sends me a boy. #k_open
CONTACT: Tell Victor the papers are ready when he comes down himself. I don't hand my work to errand runners. #k_talk1
+ [Your stamp's on papers in container three, dated next week. Who are they for? #press]
    ~ r = k_say(1, "press")
    CONTACT: You went through my containers? You? Take your hands off my business. #k_bad
+ [Nobody on this river does it better. That's why Victor wants yours. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: At last, some manners. It won't get you the papers. #k_good
+ [Victor's not coming. I am. The papers, Mr Kell. #threaten]
    ~ r = k_say(1, "threaten")
    { r >= 2:
        CONTACT: Hm. There's a spine in there after all. Sit down. #k_good
    - else:
        CONTACT: Hm. #k_good
    }
-
CONTACT: Do you know who I was? Harbourmasters called me sir. Captains waited at my desk. And what are you? #k_talk2
+ [Your stamps sit in a tin under the gangway. Without Sal, nobody pays for them. #press]
    ~ r = k_say(2, "press")
    CONTACT: Don't recite my own habits to me like a junior clerk. Piotr! #k_bad
+ [A legend, by all accounts. Help Sal and it stays that way. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: By all accounts. Flattery's cheap, but I'll take it. #k_good
+ [I'm the one standing in your office. Papers. Now. #threaten]
    ~ r = k_say(2, "threaten")
    { r >= 2:
        CONTACT: Ha! Good. Finally, someone who doesn't ask. Here. #k_good
    - else:
        CONTACT: Fine. #k_good
    }
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Stamped, signed, dated Thursday. Tell Sal it's the finest work on the river. Because it is. #k_hand_package
    ~ k_payout("the stamped papers for Thursday's boat")
    ~ k_morning("Kell", "You'll do. Tell Sal my next set is half price. For him, mind. Not for you.", "r5")
- k_outcome == "short":
    CONTACT: Here. The back page isn't stamped. Sal can do that himself. He's always wanted to. #k_hand_package
    ~ k_payout("the stamped papers for Thursday's boat")
    ~ k_morning("Sal", "Kell left the back page blank. Cost me a night fixing it. Don't make it a habit.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Mr Kell would like you out of his office. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Enough. Enough! Take them. Thirty years, and this is how it ends. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Take half the set. The rest stays with someone who knows what it's for. #k_after_fight
    }
    ~ k_payout("the stamped papers for Thursday's boat")
    { k_won:
        ~ k_morning("Lucas", "Kell's telling the quay you put Piotr through his door. Nobody's arguing prices this week.", "r8")
    - else:
        ~ k_morning("Lucas", "Kell's laughing about you in every bar on the river. Stay off the pier a night.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
