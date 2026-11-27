// Street work: Friday's Game (docks kit). Lenny, a greedy card player,
// lost at Victor's Friday game and paid in promises. The writing shows a
// man who haggles over everything; contract.ink decides how each reply
// lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("greedy", 250, 12)
~ temp r = 0
>>> title k_title
>>> job k_job [Friday's Game] Lucas ¦ $250 ¦ Low ¦ Lenny lost three hands at Friday's game in the warehouse and paid in a promise. Collect it.
>>> card k_prep [How do you play it?] Lenny says he's good for it. Lenny always says he's good for it.
+ [Bring two of Lucas's boys. Let him see the car. #muscle]
    ~ k_prepare("muscle")
+ [Walk the quay in the dark. Watch him first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas what Lenny is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Lenny's all arithmetic. Talk money, what he owes and what he'd lose, and he folds. Lean on him and he digs in.
}
>>> shot k_arrive [Pier Nine] Gone eleven. Lenny's launch knocking at the steps, the cabin light on.
>>> explore k_explore Find Lenny. Or look around first.
CONTACT: Ah. The collection. I was going to bring it round, you know. Sit, sit. Mind the suit. #k_open
CONTACT: Here's the thing. The game was crooked, so the debt's crooked. Call it a hundred and we all go home happy. #k_talk1
+ [You're hosting your own game in container twelve tonight. House takes ten percent. #press]
    ~ r = k_say(1, "press")
    { r >= 2:
        CONTACT: You've been counting my chairs. All right. The game wasn't that crooked. #k_good
    - else:
        CONTACT: Who's been talking about my table? #k_good
    }
+ [A hundred's a start. Victor likes a man who comes to the table. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: See? Reasonable. Reasonable men do business. #k_good
+ [All of it, Lenny, or the suit goes in the water. With you in it. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Gus. Come and hear what this one just said to me. #k_bad
-
CONTACT: Meet me in the middle. One-fifty. Call it a fee for my discretion. I hear things down here. #k_talk2
+ [There's a new engine on your launch with the price tag still on. You can pay. #press]
    ~ r = k_say(2, "press")
    { r >= 2:
        CONTACT: Tag's still on. I'm an idiot. Fine. The whole amount, and that's my last offer. #k_good
    - else:
        CONTACT: It was on offer. Fine. #k_good
    }
+ [Pay in full and you keep your seat at Victor's table. That's worth more. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: My seat. Yes. A seat's an investment, when you think about it. #k_good
+ [Discretion? Say that word again. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Gus! Gus, we have a situation. #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: The full amount. Count it, I already did. Twice. Tell Victor I'm in again Friday. #k_hand_cash
    ~ k_payout("Lenny's card debt")
    ~ k_morning("Lenny", "Won it all back off a ship's cook. Left you something at Sal's. Don't spend it on cards.", "c40")
- k_outcome == "short":
    CONTACT: That's what's in the wallet. The rest is tied up in the market, so to speak. #k_hand_cash
    ~ k_payout("Lenny's card debt")
    ~ k_morning("Lenny", "Paid Sal the rest, with interest I didn't owe. You're off my Christmas list.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Lenny says you're spoiling his evening. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Take it. Take it! The suit was rented anyway. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Half. That's what bad manners cost. Now go. #k_after_fight
    }
    ~ k_payout("Lenny's card debt")
    { k_won:
        ~ k_morning("Lucas", "Lenny's telling the card table you put Gus in the drink. Debts are coming in faster.", "r5")
    - else:
        ~ k_morning("Lucas", "Lenny's telling everyone his boy saw you off. Sit out a night.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
