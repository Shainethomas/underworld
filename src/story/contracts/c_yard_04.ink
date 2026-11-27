// Street work: Boxcar Nine (yard kit). Victor's hijacked load has turned up
// in a boxcar on Mrs Doran's siding, and she wants paying to release it, with
// a Varga offer in her pocket. The writing hints she only listens to money;
// contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("greedy", 1100, 35)
~ temp r = 0
>>> title k_title
>>> job k_job [Boxcar Nine] Lucas ¦ $1,100 ¦ High ¦ Victor's hijacked load is sitting in Mrs Doran's boxcar. Get the key off her.
>>> card k_prep [How do you play it?] Victor's load is in her boxcar. She thinks that makes it hers.
+ [Bring two of Lucas's boys. Park them by the gate. #muscle]
    ~ k_prepare("muscle")
+ [Walk the sidings first. Check the seals. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas how she does business. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Mrs Doran prices everything, even the weather. Talk money. Get tough and she whistles up her help.
}
>>> shot k_arrive [Calder Yard] Eleven at night. A kettle whistling in the signal office.
>>> explore k_explore Find Mrs Doran. Or look around first.
CONTACT: Lucas's lad. Mind the rails. Storage on that siding is forty a night, and it's been nine nights. #k_open
CONTACT: Nine nights, my siding, my risk. Fifteen hundred and the key's yours. Fair's fair, love. #k_talk1
+ [Varga offered eight hundred. And you've already had two cases out of it. #press]
    ~ r = k_say(1, "press")
    { r >= 2:
        CONTACT: ...You've been reading my post. Fine. The cases were a handling fee. Standard. #k_good
    - else:
        CONTACT: Who said eight? #k_good
    }
+ [Victor values people with sidings. He'd rather pay you than replace you. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: That's nice to hear. Nice doesn't pay the rates, love. #k_good
+ [Hand me the key or lose the siding. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Will I? Bela. Come and hear what the boy just said to me. #k_bad
-
CONTACT: So meet me in the middle. Twelve hundred, and I forget the Varga boys ever rang. #k_talk2
+ [Sell to Varga and Victor stops buying your scrap. That's your whole year. #press]
    ~ r = k_say(2, "press")
    { r >= 2:
        CONTACT: ...My whole year. All right. The key, the cases, the lot. Don't tell him I haggled. #k_good
    - else:
        CONTACT: Hm. You do your sums, I'll give you that. #k_good
    }
+ [Hand it over and I'll see your scrap gets first look. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: First look. That's worth something. Not much. Something. #k_good
+ [I'm done haggling with you. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Then we're done. Bela, the boy's leaving. #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Key to nine. Both cases back inside. I'm a businesswoman, not a thief. #k_hand_package
    ~ k_payout("Victor's load from boxcar nine")
    ~ k_morning("Mrs Doran", "Siding's Victor's at cost from now on. Varga rang again. I hung up. Tell him that.", "r8")
- k_outcome == "short":
    CONTACT: Key. The two cases stay with me. Call it storage. #k_hand_package
    ~ k_payout("Victor's load from boxcar nine")
    ~ k_morning("Mrs Doran", "Storage rates went up this morning. For you especially.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Mrs Doran's sold the car. You're late. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    ~ earn("v", 5, "Fought Varga's man for boxcar nine")
    { k_won:
        >>> shot k_down
        CONTACT: Stop it! Here, the key. It was only ever business, love. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Take the key. The good half's already gone to Varga. Off my siding. #k_after_fight
    }
    ~ k_payout("Victor's load from boxcar nine")
    { k_won:
        ~ k_morning("Lucas", "You put a Varga man on the rails. They'll remember that. So will Victor.", "r8")
    - else:
        ~ k_morning("Lucas", "Varga's crew are laughing about the yard. They know your face now. Lie low.", "h10")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
