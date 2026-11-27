// Street work: What Edith Saw (docks kit). Edith, the scared widow who
// keeps the watch hut, saw the Varga crew meet a boat Victor paid for. The
// writing shows a frightened woman who needs a way out; contract.ink
// decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("scared", 1000, 32)
~ temp r = 0
>>> title k_title
>>> job k_job [What Edith Saw] Lucas ¦ $1000 ¦ High ¦ A boat Victor paid for came in early and left empty. Edith keeps the watch. Get what she has.
>>> card k_prep [How do you play it?] Edith's husband kept the watch for twenty years. Now she does. She's stopped answering the hut phone.
+ [Bring two of Lucas's boys. Park where she can see the car. #muscle]
    ~ k_prepare("muscle")
+ [Come along the quay on foot. Watch the hut first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal what Edith is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Edith's frightened half to death. Go easy, she spooks. One raised voice and she locks that door for good.
}
>>> shot k_arrive [Pier Nine] One in the morning. The watch hut shutters down, a line of light underneath.
>>> explore k_explore Find Edith. Or look around first.
CONTACT: Who's that? Oh. You're Sal's. I'm sorry, I thought you were... it doesn't matter. Come in, quickly. #k_open
CONTACT: I didn't see anything. I keep the book, I make my tea, I don't look out of the window after ten. I never have. #k_talk1
+ [Container forty's floor is wet with seawater. That cargo moved tonight. #press]
    ~ r = k_say(1, "press")
    CONTACT: Tonight. Yes. Please don't make me say who. #k_good
+ [You're not in trouble. You're the only one on this pier who did her job. #charm]
    ~ r = k_say(1, "charm")
    { r >= 2:
        CONTACT: Nobody's said that since Frank. All right. Sit down. I'll tell you. #k_good
    - else:
        CONTACT: Thank you. #k_good
    }
+ [Tell me who met that boat, or you'll wish you had. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Please, no. They said they'd be watching. They'll have heard that. They'll have heard. #k_bad
-
CONTACT: They gave me an envelope. A thick one. Keep it and forget the boat, they said. What would you have done? #k_talk2
+ [The rope at the bollard was cut, not untied. They left in a hurry. They'll be back. #press]
    ~ r = k_say(2, "press")
    CONTACT: Back. Yes. That's what I'm frightened of. What do I do? #k_good
+ [Give me the envelope and the book. Victor's people watch your hut from tonight. #charm]
    ~ r = k_say(2, "charm")
    { r >= 2:
        CONTACT: From tonight? Promise me. All right. Frank's logbook, and their money. Take both. #k_good
    - else:
        CONTACT: All right. #k_good
    }
+ [You took Varga's money. Hand it over or Victor hears you did. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: I never wanted it! Vasko! Vasko, take it back, take it back! #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Frank's logbook. The time, the boat's name, the van's plate. And their envelope. I never even opened it. #k_hand_package
    ~ k_payout("Frank's logbook, and Varga's envelope")
    ~ k_morning("Edith", "Your man sat outside the hut all night. First proper sleep I've had in a week. Thank you, love.", "t5")
- k_outcome == "short":
    CONTACT: Here's their money. The book stays with me. It's all I've got left of Frank's. I'm sorry. #k_hand_cash
    ~ k_payout("Frank's logbook, and Varga's envelope")
    ~ k_morning("Lucas", "Edith kept the logbook. We need it. Go back when she's calmer, and go gently.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: Mr Varga paid for the lady's quiet. You're making noise. #k_heavy
    ~ earn("v", 5, "Fought Varga's man on Pier Nine")
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Is he breathing? Take it. Take all of it. Just get me off this pier. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: He's taking half back to Varga. Here's the rest. Please go, before he changes his mind. #k_after_fight
    }
    ~ k_payout("Frank's logbook, and Varga's envelope")
    { k_won:
        ~ k_morning("Lucas", "Varga lost a man on Pier Nine last night and knows whose it was. Good. Watch your back.", "r8")
    - else:
        ~ k_morning("Lucas", "Varga's crew are laughing about Pier Nine. Edith won't pick up. Lie low.", "h8")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
