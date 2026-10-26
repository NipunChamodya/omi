# Rule clarifications

Owner specification v1.0 remains authoritative. No owner clarification has yet been supplied for the entries below.

| Unresolved detail                                                    | Stage B behavior                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact manual cheating accusation window                              | `accuse` returns `ACCUSATION_WINDOW` unless a trusted, owner-confirmed eligibility policy is supplied. No automatic warning or penalty.                                                                                                                                                  |
| Replacement dealer selection after අත පොලේ ගහන්න                     | Restart returns `REPLACEMENT_DEALER_SELECTION` without an explicit replacement seat. No default selection algorithm.                                                                                                                                                                     |
| Repeated-draw carry behavior                                         | Second consecutive draw returns `REPEATED_DRAW`; prior carry/ledger remain unchanged.                                                                                                                                                                                                    |
| Unconfirmed bonus combinations, including carry with Kapothi         | `KAPOTHI_WITH_CARRY` returns unresolved without awarding points. Ordinary 1/2-point results receive the specified one-point carry.                                                                                                                                                       |
| No-trump report timing and original-deal versus remaining-hand basis | Raised during Stage B: a late report could otherwise be accepted simply because all trump has been played. `reportNoTrump` returns `NO_TRUMP_REPORT_BASIS_OR_TIMING` without explicit trusted policy. Both possible hand checks are infrastructure only; neither is installed as a rule. |

The confirmed draw then 2-point win example produces 3. Kapothi by itself awards 3 and does not stack the ordinary win award.

Tests supply explicit hypothetical eligibility/basis callbacks to verify mechanics. These fixtures are not owner decisions or production defaults. Policy callbacks, round state and ledger must never come from client payloads. Owner answers are needed before activating the affected paths in a playable game.

Normal inter-round dealer rotation, starting physical counter inventories, score floor and match-ending threshold are not specified. Stage B does not add them.
