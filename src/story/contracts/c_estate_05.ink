// Street work: Finder's Fee (estate kit). Lowell Pike sold a portrait through
// Victor's contacts and is haggling the fee down. The writing hints he only
// listens to money; contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("greedy", 350, 14)
~ temp r = 0
>>> title k_title
>>> job k_job [Finder's Fee] Lucas ¦ $350 ¦ Low ¦ Lowell Pike sold a portrait through Victor's people. He owes the finder's fee and says it sold cheap. Collect.
>>> card k_prep [How do you play it?] Pike deals in paintings. Whatever you say, he'll say less.
+ [Bring two of Lucas's boys. The big ones. #muscle]
    ~ k_prepare("muscle")
+ [Walk round the side of the house first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal what Pike is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Pike? Greedy as a gull. Talk money and he's all ears. Lean on him and he'll sulk, and bill you for it.
}
>>> shot k_arrive [Hollis Hill] Ten at night. Frost on the lawn. Packing crates stacked by the garage.
>>> explore k_explore Pike's waiting on the steps. Or look around first.
CONTACT: Ah. Victor's runner. Don't touch anything on the way past, it's all for sale. #k_open
CONTACT: Bad news, I'm afraid. The portrait went for buttons. Three-fifty is a fee on a fortune. Call it one-fifty. #k_talk1
+ [The sale slip on your dash says four times that. The fee's three-fifty. #press]
    ~ r = k_say(1, "press")
    { r >= 2:
        CONTACT: ...You read my dashboard. Very thorough. All right, the number's the number. #k_good
    - else:
        CONTACT: Slips get things wrong. Rarely. Go on. #k_good
    }
+ [One-fifty's a start. Victor sends his best work to men who pay on time. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: His best work. I could stand a little more of that. #k_good
+ [Three-fifty. Or I start valuing your furniture with my boots. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Boots. Charming. Now it's a hundred, and you can wait in the car. #k_bad
-
CONTACT: Two hundred. Frames, crating, a man on the door. A man has costs, you understand. #k_talk2
+ [Auction stencil on the crate by your fountain. Public sale. Victor reads too. #press]
    ~ r = k_say(2, "press")
    { r >= 2:
        CONTACT: ...Fine. Three-fifty. I'll take it out of the framer. #k_good
    - else:
        CONTACT: Public. Yes. Well. Fine. #k_good
    }
+ [Pay it all and I'll put your name up for the next one. There's always one. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: A next one. Now that's worth three-fifty. #k_good
+ [Your costs aren't my problem. All of it. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Then my costs just went up. Gorman, would you come out a moment? #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Three-fifty, clean notes. I'd frame them if I could. Tell Victor I'm open for business. #k_hand_cash
    ~ k_payout("Pike's finder's fee")
    ~ k_morning("Lowell Pike", "A collector wants a seascape moved. Something for Victor's man. That's you. It's at Sal's.", "c50")
- k_outcome == "short":
    CONTACT: Two hundred. It's robbery. But it's my robbery. #k_hand_cash
    ~ k_payout("Pike's finder's fee")
    ~ k_morning("Lowell Pike", "Victor's fee came up short, I know. Blame the market. And your manners.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Mr Pike's closed for the night. Out you go. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Enough! You'll scuff the steps. Three-fifty. Take it and go. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Half. Trade price, for your sort. Gorman, the gate. #k_after_fight
    }
    ~ k_payout("Pike's finder's fee")
    { k_won:
        ~ k_morning("Lucas", "Pike's telling every dealer in town you're not to be haggled with. Good for business.", "r5")
    - else:
        ~ k_morning("Lucas", "The hill heard a scrap at Pike's. Someone wrote down a plate. Stay home tonight.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
