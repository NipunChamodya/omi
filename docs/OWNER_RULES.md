# Owner-defined OMI rules

Source: owner specification version 1.0, section 4. Authoritative requirements; not yet implemented in Stage A.

## Players

Exactly four players. Two teams. Two players per team. Teammates sit opposite each other. Counterclockwise gameplay.

## Deck

32 playing cards. Ranks: A, K, Q, J, 10, 9, 8, 7.
Ranking: A > K > Q > J > 10 > 9 > 8 > 7.

Suits:

- ♠ ස්කෝප්ප
- ♥ හාරත
- ♦ රුයිත
- ♣ කලාබර

Cards below 7 are කැට කොල scoring counters. They are not part of the playing deck.

## Dealer

Randomly choose the initial dealer. Dealer shuffles. Player on dealer's left cuts the deck. Implement the cut as an interactive action. The backend controls the actual deck.

## First deal

Dealer gives four cards to each player. Start with the player on the dealer's right. Continue counterclockwise. Dealer receives cards last.

## Trump — තුරුම්පු

The player on the dealer's right chooses trump. The selected suit must exist in their first four cards. After trump selection, deal four additional cards to each player. The trump selector leads the first trick.

## Tricks

Four cards form one trick. Normally, players follow the leading suit when they have it. If trump cards are present, the highest trump wins. Otherwise, the highest card of the leading suit wins. The trick winner leads the next trick.

## බාල්දුයි

Players may intentionally violate the follow-suit rule. This is permitted gameplay deception.

The backend must:

- Accept the played card.
- Record the original hand privately.
- Record the violation privately.
- Never automatically announce the violation.
- Never automatically warn opponents.
- Never automatically apply penalties.

Opponents must manually notice and report. The backend verifies accusations. A valid accusation transfers 3 කැට කොල from the offending team to the opposing team.

The exact accusation window remains an unresolved rule. Do not invent it.

## අත පොලේ ගහන්න

If the opposing team has no trump cards, they can report the situation.
The confirmed outcome:

- Cancel the current round.
- Shuffle again.
- Select a new dealer.
- Restart the entire dealing process.

The exact replacement dealer selection remains unresolved. Do not invent it.

## Scoring

Trump-selecting team wins: 1 කැට කොල.

Trump-selecting team loses: 2 කැට කොල for opponents.

Kapothi: If a team wins all eight tricks, award 3 කැට කොල.

Draw: A 4–4 result is සෙපෝරු. Carry 1 කැට කොල forward.

Confirmed example: One draw followed by a 2-point winning result gives 3 කැට කොල total.

Do not invent repeated-draw behavior. Do not invent unconfirmed bonus combinations.

## Forbidden rule changes

Do not add Half Court, Full Court, automatic cheating penalties, automatic cheating warnings, alternative card rankings, alternative trump selection, or unrequested scoring mechanics.
