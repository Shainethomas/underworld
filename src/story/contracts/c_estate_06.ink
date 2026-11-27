// Street work: Body Work (estate kit). Danny, the Calloways' young driver,
// holds the keys to a car someone dented, and Victor's fee to make it go away.
// He thinks he'll take the blame. The writing hints he needs calm and a way
// out; contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("scared", 550, 20)
~ temp r = 0
>>> title k_title
>>> job k_job [Body Work] Lucas ¦ $550 ¦ Medium ¦ Collect the dented car's keys and Victor's fee from the Calloways' driver before the family gets home.
>>> card k_prep [How do you play it?] Danny was told to wait by the car. Lucas says he hasn't answered his phone all day.
+ [Bring two of Lucas's boys. He hands over keys, not excuses. #muscle]
    ~ k_prepare("muscle")
+ [Walk up the drive on foot. Look at the car first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas what Danny's like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Danny's nineteen and terrified of losing the job. Go easy, he spooks. Shout and he'll run with the keys.
}
>>> shot k_arrive [Hollis Hill] Half eleven. The Calloways are at the opera until one.
>>> explore k_explore Danny's waiting at the foot of the steps. Or look around first.
CONTACT: You're Lucas's? Right. Right, okay. I didn't do it. I want that said first, before anything. #k_open
CONTACT: They'll say I drove it. I didn't drive it. If I give you the keys, that's me saying I did, isn't it? #k_talk1
+ [The seat's racked right back. You couldn't reach the pedals. Somebody else drove. #press]
    ~ r = k_say(1, "press")
    CONTACT: ...Yeah. Yeah, it is back, isn't it. Mr Calloway's son. I knew it. #k_good
+ [Nobody's blaming you, Danny. I'm here so it all goes away quietly. #charm]
    ~ r = k_say(1, "charm")
    { r >= 2:
        CONTACT: Quietly. Okay. That's all I want. I've been sick about it all day. #k_good
    - else:
        CONTACT: You promise? Because the last time someone said that... #k_good
    }
+ [Keys. Now. Or you'll need a driver yourself. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Don't! Don't. I'll scream, there's people inside, I swear I'll scream. #k_bad
-
CONTACT: And the fee. Mr Calloway gave me Victor's envelope. If it goes missing, that's me finished here. #k_talk2
+ [It hit the fountain, not a person. Paint on the rim. This is a small job. #press]
    ~ r = k_say(2, "press")
    CONTACT: Just the fountain. Nobody hurt. Okay. Here. Keys and the envelope. #k_good
+ [Give it to me, and you were never here tonight. You've got my word. #charm]
    ~ r = k_say(2, "charm")
    { r >= 2:
        CONTACT: Never here. I like that. Here. All of it. Thank you. #k_good
    - else:
        CONTACT: Your word. Okay. Okay. #k_good
    }
+ [You're finished either way. Hand it over. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Rourke! Rourke, he's going to hurt me! #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Keys. Envelope. It's all there, I counted it twice. Tell them I was helpful. #k_hand_cash
    ~ k_payout("Victor's fee for the Calloway car")
    ~ k_morning("Danny", "Car's fixed and back in the garage. Nobody's asked me a thing. Thank you. Really.", "r5")
- k_outcome == "short":
    CONTACT: The keys. And most of it. I needed a bit for the bus out of here. Sorry. #k_hand_cash
    ~ k_payout("Victor's fee for the Calloway car")
    ~ k_morning("Lucas", "The Calloway boy quit and left town. The family's asking questions. Keep your head down.", "h5")
- else:
    >>> shot k_heavy_in
    HEAVY: The kid's under my care. You're not. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Take them! Take the keys, take the money, please, just go! #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Here. The keys and half of it. Please go before the family's back. #k_after_fight
    }
    ~ k_payout("Victor's fee for the Calloway car")
    { k_won:
        ~ k_morning("Lucas", "You put the Calloways' minder on their own drive. They paid, and they won't forget it.", "r5")
    - else:
        ~ k_morning("Lucas", "A fight on Hollis Hill. The neighbours called it in. Stay off the hill for a night.", "h10")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
