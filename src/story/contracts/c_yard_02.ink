// Street work: Left Luggage (yard kit). Robbie, a scared kid sleeping rough in
// the yard, has been minding a holdall for Lucas and has gone quiet since two
// strangers came asking. The writing hints he needs calm and a way out;
// contract.ink decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("scared", 250, 12)
~ temp r = 0
>>> title k_title
>>> job k_job [Left Luggage] Lucas ¦ $250 ¦ Low ¦ Robbie's been minding a holdall for Lucas in the yard. Bring it back unopened.
>>> card k_prep [How do you play it?] The kid was minding a bag for us. Since Sunday he's stopped picking up.
+ [Bring two of Lucas's boys. Make it quick. #muscle]
    ~ k_prepare("muscle")
+ [Come in over the back fence. See where he sleeps. #quiet]
    ~ k_prepare("quiet")
+ [Ask Lucas about the kid. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Lucas] Robbie spooks easy. Go gently, give him a way out. Raise your voice and he bolts with my bag.
}
>>> shot k_arrive [Calder Yard] Half eleven. A torch moving inside a boxcar. Then it goes off.
>>> explore k_explore Find Robbie. Or look around first.
CONTACT: Are you Lucas's? Sorry. Sorry, I have to ask. Two men came Sunday asking about bags. #k_open
CONTACT: I didn't open it. I swear I didn't. I only moved it somewhere safer, because of the men, that's all. #k_talk1
+ [It's under the seat of the burned-out van. Still taped. I know you didn't. #press]
    ~ r = k_say(1, "press")
    CONTACT: You found it. Right. Good. That's... good, that saves time, doesn't it. #k_good
+ [Moving it was the right call. Lucas will hear that from me. #charm]
    ~ r = k_say(1, "charm")
    { r >= 2:
        CONTACT: Was it? I thought he'd be angry. I thought everyone was going to be angry. #k_good
    - else:
        CONTACT: Really? Okay. Okay. #k_good
    }
+ [Stop talking and get me the bag. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Don't. Please. I'll shout, I will. Gaz is just over there. #k_bad
-
CONTACT: If I give it you, those men, they'll know it was me. Won't they? They'll come back for me. #k_talk2
+ [You've the coast coach circled. No bag, nothing to stay for. Be on it by morning. #press]
    ~ r = k_say(2, "press")
    CONTACT: You saw that. Right. Yes. I suppose that's... sensible. #k_good
+ [Nobody gets your name from me. You did your bit. You're done here. #charm]
    ~ r = k_say(2, "charm")
    { r >= 2:
        CONTACT: ...Okay. Okay. Wait there. Thank you. Nobody says that. #k_good
    - else:
        CONTACT: Okay. #k_good
    }
+ [They'll be the least of your worries. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: Gaz! Gaz, get up! #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: Here. Taped like it was. I never looked. Tell him I never looked. #k_hand_package
    ~ k_payout("Lucas's holdall")
    ~ k_morning("Lucas", "Bag came back taped. Kid's on a coach. Neat. I notice neat.", "t5")
- k_outcome == "short":
    CONTACT: There. Can I go now? I'd like to go now. #k_hand_package
    ~ k_payout("Lucas's holdall")
    ~ k_morning("Robbie", "Gaz says I should have asked for money. Too late. Don't come to the yard.", "")
- else:
    >>> shot k_heavy_in
    HEAVY: You're frightening my brother. Bad idea. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Stop! Stop, it's here, take it. It's here! #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Here. The tape split, half of it's gone in the ballast. I'm sorry. I'm sorry. #k_after_fight
    }
    ~ k_payout("Lucas's holdall")
    { k_won:
        ~ k_morning("Lucas", "Gaz is telling the canal pubs you're quick. Fine. The kid was terrified, though.", "r5")
    - else:
        ~ k_morning("Lucas", "Beaten by a man who sleeps in a van. Stay in tonight.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
