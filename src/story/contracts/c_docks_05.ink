// Street work: The Gate (docks kit). Walter, a proud old gateman, charges
// the night lorries to use Victor's gate and keeps it all. The writing
// shows a man who thinks his years make him untouchable; contract.ink
// decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("proud", 350, 14)
~ temp r = 0
>>> title k_title
>>> job k_job [The Gate] Lucas ¦ $350 ¦ Low ¦ Walter charges the night lorries to use Pier Nine's gate. Victor's gate. Collect Victor's share.
>>> card k_prep [How do you play it?] Walter's worked the gate since before Victor. He thinks that makes it his.
+ [Bring two of Lucas's boys. Let him see the car. #muscle]
    ~ k_prepare("muscle")
+ [Come in on foot past the lorries. Watch him first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas what Walter is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Walter's a proud old dog. He only respects a hard man. Show him sums and he'll take it as an insult.
}
>>> shot k_arrive [Pier Nine] Quarter to ten. A lorry idling at the gate, Walter's hand out of the hut window.
>>> explore k_explore Find Walter. Or look around first.
CONTACT: Another of Victor's. Getting younger, aren't they. I was on this gate when Victor was in short trousers. #k_open
CONTACT: This gate's mine. Thirty-one years. Victor's share is what I say it is, and tonight I say it's nothing. #k_talk1
+ [Forty lorries this week, Walter. Chalked on container nine. That's a lot of nothing. #press]
    ~ r = k_say(1, "press")
    CONTACT: Counting my chalk marks? Like a little clerk? Get off my gate. #k_bad
+ [Thirty-one years. Nobody runs a gate better. Victor knows it. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: He should. Doesn't change the share. #k_good
+ [It's Victor's gate. You just stand at it. The share, Walter. #threaten]
    ~ r = k_say(1, "threaten")
    { r >= 2:
        CONTACT: Ha. Bit of steel. Didn't think they made them like that any more. #k_good
    - else:
        CONTACT: Hm. #k_good
    }
-
CONTACT: I've had harder men than you try that. Dockers. Coppers. Your boss's old man, once. Why should I pay you? #k_talk2
+ [The tin under the water steps holds more than you declare. Sal can count. #press]
    ~ r = k_say(2, "press")
    CONTACT: Don't you tell me what's in my tin, son. Dunc! Dunc, come here. #k_bad
+ [Pay up and I'll tell Victor his gate's in the best hands on the river. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: Best hands. Fair. That's fair enough. #k_good
+ [Because I'm here and they're not. Pay. #threaten]
    ~ r = k_say(2, "threaten")
    { r >= 2:
        CONTACT: Ha! All right. You'll do. Here. The lot. #k_good
    - else:
        CONTACT: Fine. #k_good
    }
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Victor's share, to the penny. Tell him the old man on the gate still counts true. #k_hand_cash
    ~ k_payout("Victor's share of the gate")
    ~ k_morning("Walter", "Waved your car through free tonight. Don't get used to it.", "r5")
- k_outcome == "short":
    CONTACT: That's his share. Near enough. Gate's been slow. Don't look at me like that, I've seen worse than you. #k_hand_cash
    ~ k_payout("Victor's share of the gate")
    ~ k_morning("Sal", "Walter paid short and told every driver why. Go easy round the gate a while.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Walt says you've been rude at his gate. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Right. Take it, then. And don't tell the lads it was a kid did that to Dunc. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Here's half. Least you can do is walk out the gate, not crawl. #k_after_fight
    }
    ~ k_payout("Victor's share of the gate")
    { k_won:
        ~ k_morning("Lucas", "The drivers are calling you the lad who put Dunc down. Walter paid early this morning.", "r5")
    - else:
        ~ k_morning("Lucas", "Walter's telling every driver about you. Stay away from the gate tonight.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
