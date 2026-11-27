// Street work: The Councillor (estate kit). Councillor Vane took Victor's
// thousand and then voted the Varga crew's way. She is frightened of both of
// them. The writing hints she needs a way out; contract.ink decides how each
// reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("scared", 1000, 32)
~ temp r = 0
>>> title k_title
>>> job k_job [The Councillor] Victor ¦ $1,000 ¦ High ¦ Councillor Vane took Victor's money and voted the other way. Get it back, or her vote on Thursday.
>>> card k_prep [How do you play it?] Victor says she's never been trouble before. Something got to her first.
+ [Bring two of Lucas's boys. Let the street see Victor's car. #muscle]
    ~ k_prepare("muscle")
+ [Come up the back way. See who else is here. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas what Vane is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Vane? Frightened of her own shadow since the Varga lot turned up. Go easy, she spooks. Lean on her and she'll call them.
}
>>> shot k_arrive [Hollis Hill] Midnight. A black car by the house that isn't the councillor's.
>>> explore k_explore Councillor Vane's waiting at the foot of the steps. Or look around first.
CONTACT: You came yourself. Good. No. I mean, I'm glad it's someone sensible. It's late, isn't it. #k_open
CONTACT: I couldn't help the vote. You have to understand, there were people at my door. I didn't have a choice. #k_talk1
+ [Their list is in that car. Thursday's ticked too. They'll own you for good. #press]
    ~ r = k_say(1, "press")
    CONTACT: Thursday as well? They said it was only the once. They said. #k_good
+ [Nobody blames you for being frightened. Victor can keep them off your step. #charm]
    ~ r = k_say(1, "charm")
    { r >= 2:
        CONTACT: Could he? Truly? I haven't opened the curtains in a week. #k_good
    - else:
        CONTACT: That's what they said too. That they'd keep people off my step. #k_good
    }
+ [You took his money and sold the vote. That's a choice. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Please, keep your voice down. They're inside. They're in my kitchen. #k_bad
-
CONTACT: If I give back the money, they'll know. If I keep it, you'll know. What am I supposed to do? #k_talk2
+ [You haven't spent a note. It's under the fountain. Give it back, it never happened. #press]
    ~ r = k_say(2, "press")
    CONTACT: You found it. Of course you did. Yes. Take it. Take it before I change my mind. #k_good
+ [Vote with Victor on Thursday. We'll be the ones outside your door. #charm]
    ~ r = k_say(2, "charm")
    { r >= 2:
        CONTACT: Thursday. Yes. I can do Thursday. And the money, here, I never wanted it. #k_good
    - else:
        CONTACT: Thursday. If you're really outside. All right. #k_good
    }
+ [What you're supposed to do is pay up before this gets worse. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Lazar! Lazar, he's threatening me! #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: All of it. And Thursday, I'll vote how Victor likes. Just keep them away from me. #k_hand_cash
    ~ k_payout("Victor's money back from the council")
    ~ k_morning("Unknown number", "The councillor changed her mind about Thursday. You'll pay for that.", "r10")
- k_outcome == "short":
    CONTACT: Most of it. They took some for themselves. I'm sorry. I'm so sorry. #k_hand_cash
    ~ k_payout("Victor's money back from the council")
    ~ k_morning("Lucas", "Vane's sick on Thursday. Not voting either way. Victor calls that half a win.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: The councillor works for Mr Varga now. Go home, boy. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Oh God. Take it. It's under the fountain, all of it, take it! #k_after_fight
        ~ earn("v", 5, "Put Varga's man down on Hollis Hill")
    - else:
        >>> shot k_beaten
        CONTACT: Here. Half. It's all I could get to. Please go before he gets up. #k_after_fight
        ~ earn("v", 5, "Fought Varga's man on Hollis Hill")
    }
    ~ k_payout("Victor's money back from the council")
    { k_won:
        ~ k_morning("Lucas", "Varga's man on a councillor's drive, flat on his back. The whole hill's heard. Victor's pleased.", "r10")
    - else:
        ~ k_morning("Lucas", "A Varga man beat you on a councillor's drive. That's a story going round. Lie low.", "h10")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
