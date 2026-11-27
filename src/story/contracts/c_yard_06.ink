// Street work: The Yardmaster's Key (yard kit). Frank Vell kept the key to
// Victor's platform locker. Frank's dead, and his widow is frightened since
// strangers came asking. The writing hints she needs calm and a way out;
// contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("scared", 550, 20)
~ temp r = 0
>>> title k_title
>>> job k_job [The Yardmaster's Key] Lucas ¦ $550 ¦ Medium ¦ Victor's stash is in a platform locker. The late yardmaster's widow has the key. Fetch it.
>>> card k_prep [How do you play it?] Frank Vell kept the key to Victor's locker. Frank's dead. His widow kept the key.
+ [Bring two of Lucas's boys. In case the others come back. #muscle]
    ~ k_prepare("muscle")
+ [Come in along the platform. See who's watching. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas about Mrs Vell. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] She's been frightened of her own shadow since Frank went. Go easy. Be kind and she'll hand you anything.
}
>>> shot k_arrive [Calder Yard] Eleven at night. One lamp lit in the signal office, the blind half down.
>>> explore k_explore Find Mrs Vell. Or look around first.
CONTACT: You're Lucas's? Oh, thank God. Sorry. I thought you were the other ones. Come out of the light. #k_open
CONTACT: Two men came Tuesday asking about Frank's keys. I said I'd thrown them out. Was that wrong? I didn't know what to say. #k_talk1
+ [Someone's tried the locker already. Give me the key and they lose interest. #press]
    ~ r = k_say(1, "press")
    CONTACT: They tried it? Oh. Then it's not safe here at all, is it. #k_good
+ [You did fine. Nobody's angry. I'm here so you don't have to deal with it. #charm]
    ~ r = k_say(1, "charm")
    { r >= 2:
        CONTACT: ...Thank you. Frank always said Lucas looked after his own. #k_good
    - else:
        CONTACT: All right. All right. #k_good
    }
+ [Enough chat. The key, Mrs Vell. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Don't shout. Please don't shout. Jory! Jory, he's shouting at me! #k_bad
-
CONTACT: If I give you the key, what happens when they come back and I haven't got it? What do I say then? #k_talk2
+ [By then you're on that train. Your case is packed. I've seen it. #press]
    ~ r = k_say(2, "press")
    CONTACT: You've seen that too. I suppose that's... sensible. #k_good
+ [They won't. Lucas will have a man on your street till you're gone. #charm]
    ~ r = k_say(2, "charm")
    { r >= 2:
        CONTACT: ...Then here. I'm glad it was you who came, honestly. #k_good
    - else:
        CONTACT: If you say so. #k_good
    }
+ [That's your problem, not mine. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Jory, please. Make him go away. #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Frank's key. Platform two, third locker. I never opened it. I never wanted to. #k_hand_package
    ~ k_payout("Victor's stash from the platform locker")
    ~ k_morning("Mrs Vell", "On the train. Someone left flowers at the station. Frank would have liked you.", "r5")
- k_outcome == "short":
    CONTACT: Take it. Jory says I should have asked for something. I don't know. Just take it. #k_hand_package
    ~ k_payout("Victor's stash from the platform locker")
    ~ k_morning("Jory", "She cried half the night. Don't come back to the yard.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: You've upset her. Out. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Stop! Please stop. Here's the key. Here. Please. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Here's the key. Jory moved half of it weeks ago. Just go. Please just go. #k_after_fight
    }
    ~ k_payout("Victor's stash from the platform locker")
    { k_won:
        ~ k_morning("Lucas", "Jory's telling the nurses he fell. Victor's got his money. Be gentler with widows.", "r5")
    - else:
        ~ k_morning("Lucas", "A widow's lodger put you on the platform. People are laughing. Stay in tonight.", "h8")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
