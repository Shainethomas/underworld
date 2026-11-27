// Street work: Six Boxes Short (docks kit). Ines, a greedy chandler, sold
// six boxes of Victor's radios out of her storage shed and calls it a fee.
// The writing shows a woman who prices everything; contract.ink decides
// how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("greedy", 600, 20)
~ temp r = 0
>>> title k_title
>>> job k_job [Six Boxes Short] Sal ¦ $600 ¦ Medium ¦ Victor's radios came out of Ines's shed six boxes short. She sold them. Get the money for all six.
>>> card k_prep [How do you play it?] Ines runs the chandlery on the quay. Everything in it has a price, her memory included.
+ [Bring two of Lucas's boys. Park outside the shop. #muscle]
    ~ k_prepare("muscle")
+ [Come along the quay in the dark. Watch her first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal what Ines is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Ines is all money. Talk money: what she owes, what she'd lose. Lean on her and she digs in out of spite.
}
>>> shot k_arrive [Pier Nine] Eleven. The chandlery lamp still lit, a till ringing somewhere inside.
>>> explore k_explore Find Ines. Or look around first.
CONTACT: Sal's errand boy. Come in, wipe your feet. Rope's twelve a coil, if you're buying. #k_open
CONTACT: Six boxes? Storage isn't free, love. Whatever went missing paid for the shelf it sat on. Call it my fee. #k_talk1
+ [Six radio boxes, flattened behind container twenty-two. Your shop tape's on them. #press]
    ~ r = k_say(1, "press")
    { r >= 2:
        CONTACT: You went round the back. Fine. I sold them. Doesn't mean I've still got the money. #k_good
    - else:
        CONTACT: So? #k_good
    }
+ [A fee's fair. Victor pays his friends. Just not out of his own radios. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: Friends. I like the sound of that. Friends get a discount. #k_good
+ [Six boxes' worth, or I take it out of your shop. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Out of my shop? Jonah, the boy wants to redecorate. #k_bad
-
CONTACT: Say I had the money. Say I keep a third for my trouble. That's business. Everybody takes a cut. #k_talk2
+ [Your board at the steps says radios, forty each. Six boxes. I can do sums too. #press]
    ~ r = k_say(2, "press")
    { r >= 2:
        CONTACT: My own chalk. Fine. All of it, and not a penny of thanks. #k_good
    - else:
        CONTACT: Fine. #k_good
    }
+ [Pay it all and Sal sends his boats to you first. That's worth a third. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: His boats first? Now that's a cut I can live with. #k_good
+ [Keep a third and lose the shop. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Jonah! The boy's making threats in my shop. #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: All of it. Count it in front of me, I like to watch. And tell Sal I want his boats. #k_hand_cash
    ~ k_payout("the money for six boxes of radios")
    ~ k_morning("Ines", "Two of Sal's boats tied up at mine this morning. Left you a little something with him.", "c100")
- k_outcome == "short":
    CONTACT: There. Less storage. I told you, nothing in this shop is free. #k_hand_cash
    ~ k_payout("the money for six boxes of radios")
    ~ k_morning("Sal", "Ines kept her storage fee. She'll want it every time now. Thanks for that.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Mrs Calloway says you've been rude in her shop. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Fine! Fine. Take it. Take a coil of rope too, no charge. Just get out. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Half. That's the price of the lesson. Mind the step. #k_after_fight
    }
    ~ k_payout("the money for six boxes of radios")
    { k_won:
        ~ k_morning("Lucas", "Ines is telling the quay you went through Jonah like a door. Shops are paying on time.", "r8")
    - else:
        ~ k_morning("Lucas", "Ines is telling everyone how you ended up on her floor. Keep away from the quay.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
