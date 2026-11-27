// Street work: Hill Insurance (estate kit). Ambrose Kell, a proud old hand,
// has stopped paying Victor to keep his hill quiet. The writing hints he only
// respects someone who stands up to him; contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("proud", 300, 15)
~ temp r = 0
>>> title k_title
>>> job k_job [Hill Insurance] Lucas ¦ $300 ¦ Low ¦ Ambrose Kell pays Victor to keep Hollis Hill quiet. Two months now he hasn't. Collect.
>>> card k_prep [How do you play it?] Kell's been on that hill thirty years. He'll want you to know it.
+ [Bring two of Lucas's boys. Park them on his gravel. #muscle]
    ~ k_prepare("muscle")
+ [Walk up the drive on foot. Look before you knock. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas what Kell is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Kell's proud. He only respects someone who stands up to him. Argue figures and he'll take it personally.
}
>>> shot k_arrive [Hollis Hill] Half nine. Every window lit, and the fountain running for nobody.
>>> explore k_explore Kell's waiting on the steps. Or look around first.
CONTACT: So Victor sends boys now. When I started, he sent men. Or came himself, cap in hand. #k_open
CONTACT: I paid this hill's way before Victor Sable could spell protection. Why would I pay you? #k_talk1
+ [New lions on the fountain, new car by the door. You can pay, Mr Kell. #press]
    ~ r = k_say(1, "press")
    CONTACT: You've been pricing my garden? Get off my steps and send me an adult. #k_bad
+ [Nobody doubts what you've done. Victor would like it kept that way. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: Kept that way. Hm. At least somebody taught you manners. #k_good
+ [Victor's not asking, and neither am I. Two months. Tonight. #threaten]
    ~ r = k_say(1, "threaten")
    { r >= 2:
        CONTACT: Ha. There's a spine in there after all. Go on, then. #k_good
    - else:
        CONTACT: Tonight. You do have nerve, I'll give you that. #k_good
    }
-
CONTACT: Say I pay. What stops Victor raising it next spring? I've been robbed politely before. #k_talk2
+ [Do the sums. Victor's rate costs less than one break-in up here. #press]
    ~ r = k_say(2, "press")
    CONTACT: Don't lecture me on sums. I was making money when your father was in short trousers. #k_bad
+ [Pay tonight and I'll tell Victor you were a gentleman about it. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: Tell him I was gracious. It'll confuse him. #k_good
+ [Nothing stops him. That's the point. Pay, or tell him yourself. #threaten]
    ~ r = k_say(2, "threaten")
    { r >= 2:
        CONTACT: ...You'd make a decent doorman. Wait there. #k_good
    - else:
        CONTACT: Nerve. Fine. Wait there. #k_good
    }
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Two months, in an envelope. Tell Victor he's finally found himself a proper one. #k_hand_cash
    ~ k_payout("Kell's two months")
    ~ k_morning("Kell", "You'll do. If Victor ever stops paying you, come and work for a real house.", "r5")
- k_outcome == "short":
    CONTACT: One month. The second when Victor rings me himself, and not before. #k_hand_cash
    ~ k_payout("Kell's two months")
    ~ k_morning("Kell", "Second month is with Sal. Paid for Victor's sake, not yours.", "c60")
- else:
    >>> shot k_heavy_in
    HEAVY: Mr Kell's finished with you. Down the steps. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Enough. Dunne, get up, you're embarrassing the house. Here. Take it. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Half, for the walk down. Dunne, see him to the gate. #k_after_fight
    }
    ~ k_payout("Kell's two months")
    { k_won:
        ~ k_morning("Lucas", "Kell rang Victor to complain you hit his man. Victor laughed. First time this month.", "r5")
    - else:
        ~ k_morning("Lucas", "Kell's telling the hill Victor's boy got thrown down his steps. Stay off it a few nights.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
