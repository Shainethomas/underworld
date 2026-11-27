// Street work: Marker Due (estate kit). Julian Marsh lost at Victor's card
// room and signed a marker. Now he wants to haggle it down. The writing hints
// he only listens to money; contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("greedy", 650, 22)
~ temp r = 0
>>> title k_title
>>> job k_job [Marker Due] Lucas ¦ $650 ¦ Medium ¦ Julian Marsh signed a marker for six-fifty at Victor's card room. It's a month late. Collect it.
>>> card k_prep [How do you play it?] Marsh sells houses for a living. He'll try to sell you one.
+ [Bring two of Lucas's boys. Let them lean on his car. #muscle]
    ~ k_prepare("muscle")
+ [Come up through the garden. See what he's hiding. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal what Marsh is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Marsh is greedy. Talk money and he'll listen. Lean on him and he digs in, just for the sport.
}
>>> shot k_arrive [Hollis Hill] Midnight. A party ended an hour ago. Glasses lined up on the fountain wall.
>>> explore k_explore Marsh is waiting on the steps. Or look around first.
CONTACT: The collector. Good. I'd rather deal with the organ grinder, but let's see what you've brought me. #k_open
CONTACT: Six-fifty is the sticker price. Nobody pays sticker. Four hundred tonight, cash, and we all go to bed happy. #k_talk1
+ [You played Victor's tables again Monday. Broke men don't. It's six-fifty. #press]
    ~ r = k_say(1, "press")
    { r >= 2:
        CONTACT: ...Somebody's been fishing in my fountain. All right. You know your numbers. #k_good
    - else:
        CONTACT: Monday was a loan. Mostly. Go on. #k_good
    }
+ [Four's a start. Victor likes men who settle. It buys you credit. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: Credit. Now you're speaking my language. #k_good
+ [Six-fifty, Marsh, or we start taking it out of the furniture. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Threats. Lovely. Now it's three-fifty, and I want a receipt. #k_bad
-
CONTACT: Five hundred. Final offer. I have costs, you understand. A house like this eats money. #k_talk2
+ [There's a signed offer on your car, sitting on the seat. You can cover it. #press]
    ~ r = k_say(2, "press")
    { r >= 2:
        CONTACT: ...You read other people's post. Fine. Six-fifty. It comes off the car. #k_good
    - else:
        CONTACT: Friday's Friday. But fine. #k_good
    }
+ [Pay in full and I'll ask Victor to drop the late fee. Saves you money. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: Drop the fee. Now there's a lovely phrase. #k_good
+ [The final offer's mine. All of it, or the car goes tonight. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Now you've cost yourself money. I don't pay people who shout. Bram? #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Six-fifty. Count it, I insist. Tell Victor I'll see him at the tables. #k_hand_cash
    ~ k_payout("Marsh's marker")
    ~ k_morning("Julian Marsh", "Got more for the car than it's worth. Sent a little to Sal for you. Good collectors get a cut.", "c100")
- k_outcome == "short":
    CONTACT: Four hundred. Take it or don't. The rest when the market turns. #k_hand_cash
    ~ k_payout("Marsh's marker")
    ~ k_morning("Julian Marsh", "Rest of the marker's on hold. I'll discuss it with Victor, not his errand boy.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Party's over, son. Mr Marsh wants his drive clear. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: All right! Six-fifty. It was always six-fifty. I was only negotiating. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Half. Call it a settlement. Bram, see him down the hill. #k_after_fight
    }
    ~ k_payout("Marsh's marker")
    { k_won:
        ~ k_morning("Lucas", "Marsh's man says you put him in the fountain. The card room's been paid on time since.", "r5")
    - else:
        ~ k_morning("Lucas", "Marsh is dining out on you. A neighbour rang the law about the noise. Keep your head down.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
