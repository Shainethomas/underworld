// Street work: Container Seven (docks kit). Robbie, a scared kid on the
// night book, let a case of cigarettes walk off one of Sal's containers.
// The writing shows a frightened boy who wants a way out; contract.ink
// decides how each reply lands.

INCLUDE ../globals.ink
INCLUDE contract.ink

-> contract

=== contract ===
~ k_start("scared", 300, 15)
~ temp r = 0
>>> title k_title
>>> job k_job [Container Seven] Sal ¦ $300 ¦ Low ¦ A case of cigarettes walked off container seven on Robbie's shift. Get Sal his money back.
>>> card k_prep [How do you play it?] Robbie keeps the night book. He hasn't looked anyone in the eye since Thursday.
+ [Bring two of Lucas's boys. Park where he can see the car. #muscle]
    ~ k_prepare("muscle")
+ [Come along the quay on foot. Watch him first. #quiet]
    ~ k_prepare("quiet")
+ [Ask Sal what Robbie is like. #homework]
    ~ k_prepare("homework")
-
{ k_prep == "homework":
    >>> message k_tip [Sal] Robbie's a good kid having a bad week. Go easy, he spooks. Be kind and he'll tell you everything. Shout and he runs.
}
>>> shot k_arrive [Pier Nine] Half eleven. One lamp on in the tally hut, a radio playing very quietly.
>>> explore k_explore Find Robbie. Or look around first.
CONTACT: Sorry. Sorry, I didn't hear you. You're from Sal, aren't you? Do you want a tea? There's tea. #k_open
CONTACT: The seal was like that when I got here, I swear. I wrote it down. I write everything down. You can check. #k_talk1
+ [You wrote it twice, Robbie. Seal checked at ten, then again at two. Why twice? #press]
    ~ r = k_say(1, "press")
    CONTACT: Because I knew somebody would look. I'm no good at this. I'm really no good at this. #k_good
+ [Sit down. Drink your tea. Nobody's angry yet. I'm here so it stays that way. #charm]
    ~ r = k_say(1, "charm")
    { r >= 2:
        CONTACT: Yet. Okay. Okay, I can work with yet. Thank you. #k_good
    - else:
        CONTACT: Okay. #k_good
    }
+ [Tell me where the case went or you go off the end of the pier. #threaten]
    ~ r = k_say(1, "threaten")
    CONTACT: Callum! Callum, there's a man here! I'm sorry, I'm sorry, I didn't do anything! #k_bad
-
CONTACT: If Sal finds out it was me, that's it, isn't it? Job gone. My mum finds out. Everyone finds out. #k_talk2
+ [Your moped's at the water steps. Carton wrappers in the water. It ends tonight. #press]
    ~ r = k_say(2, "press")
    CONTACT: You've been down the steps. Right. Yeah. I've been really stupid, haven't I. #k_good
+ [Give me the money and it's a mistake you fixed. That's all Sal ever hears. #charm]
    ~ r = k_say(2, "charm")
    { r >= 2:
        CONTACT: A mistake I fixed. I can be that. It's all here, in the biscuit tin. I didn't spend it. #k_good
    - else:
        CONTACT: All right. #k_good
    }
+ [The money. Now. Or Sal hears your name tonight. #threaten]
    ~ r = k_say(2, "threaten")
    CONTACT: No. No, no, no. Callum! Callum, he's going to tell Sal! #k_bad
-
~ k_settle()
{
- k_outcome == "deal":
    CONTACT: It's all there. Every note. I couldn't spend it, I felt sick every time. Tell Sal I'm sorry. Tell him properly. #k_hand_cash
    ~ k_payout("Sal's money for the cigarettes")
    ~ k_morning("Robbie", "Sal kept me on. He said you put a word in. I won't forget it. Night book's spotless.", "r5")
- k_outcome == "short":
    CONTACT: That's most of it. I put some on the moped, I'm sorry. I'll pay the rest. A bit every week, honest. #k_hand_cash
    ~ k_payout("Sal's money for the cigarettes")
    ~ k_morning("Sal", "Robbie's paying the rest off weekly. Next time, bring all of it.", "c50")
- else:
    >>> shot k_heavy_in
    HEAVY: My little brother's in bits. You made my little brother cry. #k_heavy
    >>> qte k_guard {gear_knuckles:easy}
    >>> qte k_counter {gear_knuckles:easy}
    ~ k_won = k_counter >= 0.5
    { k_won:
        >>> shot k_down
        CONTACT: Stop! Stop. It's all here. Please. Just take it and go. #k_after_fight
    - else:
        >>> shot k_beaten
        CONTACT: Take half. Just take it and go. Callum, leave him. Please, that's enough. #k_after_fight
    }
    ~ k_payout("Sal's money for the cigarettes")
    { k_won:
        ~ k_morning("Lucas", "The quay says you flattened Robbie's brother. Sal's not thrilled, but he got paid.", "r5")
    - else:
        ~ k_morning("Lucas", "Robbie's brother is telling the whole pier he saw you off. Keep your head down.", "h5")
    }
}
>>> shot k_leave
>>> complete k_complete
-> END
