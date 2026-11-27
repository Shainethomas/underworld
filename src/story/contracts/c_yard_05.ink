// Street work: Diesel Money (yard kit). Fitz, a proud old lorry driver, borrowed
// from Sal to get his rig back on the road. It's running; Sal isn't paid. The
// writing hints he only respects someone who stands up to him; contract.ink
// decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("proud", 350, 14)
~ temp r = 0
>>> title k_title
>>> job k_job [Diesel Money] Sal ¦ $350 ¦ Low ¦ Fitz borrowed from Sal to fix his lorry. The lorry's running. Sal isn't paid. Collect.
>>> card k_prep [How do you play it?] Fitz owes Sal. Fitz thinks old men don't owe anybody.
+ [Bring two of Lucas's boys. Block the lorry in. #muscle]
    ~ k_prepare("muscle")
+ [Wait by the sidings. Watch him load up. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal about Fitz. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Fitz is proud. Thirty years of it. He only respects a hard man. Lecture him and he digs in.
}
>>> shot k_arrive [Calder Yard] Half ten. A lorry idling by the signal office, lights off.
>>> explore k_explore Find Fitz. Or look around first.
CONTACT: Sal sent you? Sal used to carry my bags. Now he sends boys round after dark. #k_open
CONTACT: I'll pay Sal when I decide it's time. Nobody tells Fitz Calloway when. Not Sal. Not you. #k_talk1
+ [Three runs this week, paid on delivery. You've got it, Fitz. #press]
    ~ r = k_say(1, "press")
    CONTACT: You read my run sheet? Thirty years on the road and some pup reads my papers. #k_bad
+ [Nobody's telling you. Sal's asking. As a favour to an old friend. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: Asking. That's more like it. #k_good
+ [Sal's telling you. Through me. Tonight. #threaten]
    ~ r = k_say(1, "threaten")
    { r >= 2:
        CONTACT: ...Hah. You've got some front on you. I like front. #k_good
    - else:
        CONTACT: Have you now. #k_good
    }
-
CONTACT: And if I say Sal can wait another month? What then, son? #k_talk2
+ [Then the interest eats those new tyres in the boxcar. Now's cheaper. #press]
    ~ r = k_say(2, "press")
    CONTACT: Don't you talk interest to me. I was lending money before Sal could count. #k_bad
+ [Then Sal waits. Shame, though. A man like you owing a man like him. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: Hm. It would be, wouldn't it. #k_good
+ [Then I sit in your cab till you change your mind. #threaten]
    ~ r = k_say(2, "threaten")
    { r >= 2:
        CONTACT: ...You would, too. All right. All of it. Tell Sal I paid like a pro. #k_good
    - else:
        CONTACT: Would you. #k_good
    }
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Every note. Tell Sal that Fitz Calloway never stiffed anyone in his life. #k_hand_cash
    ~ k_payout("Sal's loan on the lorry")
    ~ k_morning("Fitz", "Run to the coast Thursday. Need a second man in the cab. Pays. Thought of you.", "c100")
- k_outcome == "short":
    CONTACT: Most of it. Sal can whistle for the rest. #k_hand_cash
    ~ k_payout("Sal's loan on the lorry")
    ~ k_morning("Fitz", "Told the cafe you were polite. Meant it as an insult.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Uncle Fitz says you're making a scene. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: All right, son. All right. Here. You've made your point. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Here's half. Tell Sal the boy he sent wants feeding up. #k_after_fight
    }
    ~ k_payout("Sal's loan on the lorry")
    { k_won:
        ~ k_morning("Sal", "Dom's limping round the cafe telling everyone about you. Next time ask nicely first.", "r5")
    - else:
        ~ k_morning("Sal", "Fitz is telling the whole cafe. Keep your head down a night or two.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
