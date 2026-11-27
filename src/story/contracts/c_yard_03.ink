// Street work: House Rules (yard kit). Leon Marsh, a proud old card dealer,
// runs a game in the signal office and has stopped paying Victor's rake. The
// writing hints he only respects someone who stands up to him; contract.ink
// decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("proud", 650, 22)
~ temp r = 0
>>> title k_title
>>> job k_job [House Rules] Victor ¦ $650 ¦ Medium ¦ Leon's card game in the signal office stopped paying Victor's rake. Collect it.
>>> card k_prep [How do you play it?] Leon thinks the game is his. Victor thinks the yard is.
+ [Bring two of Lucas's boys. Fill the doorway. #muscle]
    ~ k_prepare("muscle")
+ [Wait under the signal gantry. Count who goes in. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal about Leon Marsh. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Leon's proud as a cat. Do sums at him and he sulks. He only respects a man who stands up to him.
}
>>> shot k_arrive [Calder Yard] Midnight. Cigar smoke and laughter from the old signal office.
>>> explore k_explore Find Leon. Or look around first.
CONTACT: So Victor sends boys now. I was dealing cards in this yard when you were in a pram. #k_open
CONTACT: I built this game. My table, my players, my name on it. Tell me why Victor gets a slice. #k_talk1
+ [Eleven hundred in Friday's pot, and Victor's column's blank. I can count. #press]
    ~ r = k_say(1, "press")
    CONTACT: You've been through my things. You think a sum on a scrap of paper makes you a man? #k_bad
+ [Nobody runs a table like you. Victor knows it. That's why he lets you. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: Lets me. Well. At least someone taught you manners. #k_good
+ [Because your table sits on his yard. Pay, or the table goes in the canal. #threaten]
    ~ r = k_say(1, "threaten")
    { r >= 2:
        CONTACT: ...Ha. There's a spine in there after all. Sit down, then. #k_good
    - else:
        CONTACT: Big words. #k_good
    }
-
CONTACT: Say I pay. Then every pup Victor sends thinks he can walk in here and talk to me like that. #k_talk2
+ [You're running three tables, not one. Victor's been generous. Do the sums. #press]
    ~ r = k_say(2, "press")
    CONTACT: Don't you do sums at me in my own office, boy. #k_bad
+ [Only me. And I'll tell Victor you paid like a gentleman. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: A gentleman. Somebody still remembers what that is. #k_good
+ [Not every pup. Just me. And I'm not leaving without it. #threaten]
    ~ r = k_say(2, "threaten")
    { r >= 2:
        CONTACT: ...You'll do. The others always blink. Kurt, fetch the tin. #k_good
    - else:
        CONTACT: Hm. #k_good
    }
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Victor's share. Counted at the table, in front of witnesses. Leon Marsh pays his debts. #k_hand_cash
    ~ k_payout("Victor's rake from the card game")
    ~ k_morning("Leon", "There's a seat at Friday's table if you want it. Bring money. I don't give lessons free.", "r5")
- k_outcome == "short":
    CONTACT: Take it. Less the house cut. There's always a house cut. #k_hand_cash
    ~ k_payout("Victor's rake from the card game")
    ~ k_morning("Leon", "Told the table you got lucky. Next time, tell Victor to send a man.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Mr Marsh is finished talking to you. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Enough. Kurt, enough. Give him the tin. He's earned it, God help us. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: There. Half. Now see yourself out of my office. #k_after_fight
    }
    ~ k_payout("Victor's rake from the card game")
    { k_won:
        ~ k_morning("Lucas", "Leon's telling Friday's table you put Kurt through the stove. Victor laughed.", "r8")
    - else:
        ~ k_morning("Lucas", "Leon's dining out on last night. Stay off the yard till it cools.", "h8")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
