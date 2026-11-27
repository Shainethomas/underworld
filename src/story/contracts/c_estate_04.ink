// Street work: Son and Heir (estate kit). Jasper Wren runs Varga business
// out of his father's house on Victor's hill, and thinks nobody can touch him.
// The writing hints he only respects someone who won't blink; contract.ink
// decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("proud", 1200, 36)
~ temp r = 0
>>> title k_title
>>> job k_job [Son and Heir] Lucas ¦ $1,200 ¦ High ¦ Jasper Wren moves Varga business through his father's parties, on Victor's hill. Collect Victor's twelve hundred.
>>> card k_prep [How do you play it?] Jasper's twenty-two and has never once been told no.
+ [Bring two of Lucas's boys. Fill the drive. #muscle]
    ~ k_prepare("muscle")
+ [Come over the side wall. See who else is here. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas what Jasper is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Spoilt, and proud of it. He only respects someone who doesn't blink. Quote his dad's money at him and he'll dig in.
}
>>> shot k_arrive [Hollis Hill] One in the morning. Music from the pool house. A car on the drive that isn't family.
>>> explore k_explore Jasper's lounging on the steps. Or look around first.
CONTACT: You're Victor's? You're my age. Has he run out of grown-ups? #k_open
CONTACT: My father has lunch with the chief constable. The Vargas look after me. Tell me why I'd give Victor a penny. #k_talk1
+ [Varga cash under your fountain, your father's lawyer in the glovebox. Think. #press]
    ~ r = k_say(1, "press")
    CONTACT: You went through my father's car? You're done. You are actually done. #k_bad
+ [You've done well for yourself. Victor just wants his share of the hill. #charm]
    ~ r = k_say(1, "charm")
    CONTACT: Done well. Yes. I have, haven't I. #k_good
+ [The Vargas aren't here. I am. Twelve hundred, Jasper. #threaten]
    ~ r = k_say(1, "threaten")
    { r >= 2:
        CONTACT: ...Nobody talks to me like that. It's almost refreshing. Go on. #k_good
    - else:
        CONTACT: Bold. Stupid, but bold. #k_good
    }
-
CONTACT: Say I pay. I'm not apologising. I don't do that. Ask anyone in this house. #k_talk2
+ [One more incident and Daddy cuts you off. It's in writing. Pay, stay rich. #press]
    ~ r = k_say(2, "press")
    CONTACT: Don't you ever talk about my father. Kristof! #k_bad
+ [Skip the sorry. Pay, and Victor hears you were a gentleman about it. #charm]
    ~ r = k_say(2, "charm")
    CONTACT: A gentleman. I can do gentleman. #k_good
+ [You'll apologise, or you'll explain it to Victor in person. Pick. #threaten]
    ~ r = k_say(2, "threaten")
    { r >= 2:
        CONTACT: ...Tell him sorry. Don't tell him I said it nicely. #k_good
    - else:
        CONTACT: Fine. I'll say it. Once. #k_good
    }
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Twelve hundred. Tell Victor I'm sorry. There. Don't make me say it twice. #k_hand_cash
    ~ k_payout("Victor's twelve hundred from the Wren house")
    ~ k_morning("Jasper", "The Vargas won't take my calls. Was that you? Can I work for Victor instead?", "r5")
- k_outcome == "short":
    CONTACT: That's what I've got. The rest is my father's money and I'm not touching it. #k_hand_cash
    ~ k_payout("Victor's twelve hundred from the Wren house")
    ~ k_morning("Jasper", "Told my father about you. He's ringing his friend at the station. Have a lovely week.", "h5")
- else:
    >>> shot k_heavy_in
    HEAVY: Varga's friend says you're upsetting him. Wrong hill, wrong house. #k_heavy
    ~ earn("v", 5, "Put hands on Varga muscle at the Wren house")
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Kristof? Kristof, get up. Oh, for, here. Take it. All of it. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Half. Call it a tip. Kristof, walk him to the gate. Gently, he's Victor's. #k_after_fight
    }
    ~ k_payout("Victor's twelve hundred from the Wren house")
    { k_won:
        ~ k_morning("Lucas", "Varga's man is out of hospital and the Vargas are out of the Wren house. Victor's pleased. They aren't.", "r10")
    - else:
        ~ k_morning("Lucas", "The Vargas are telling the city Victor's boys get beaten on Hollis Hill. Stay in tonight.", "h10")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
