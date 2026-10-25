# Game states

**Planned for Stage B; no state machine exists in Stage A.**

Confirmed sequence: initial dealer selection → shuffle → interactive cut → first four cards → constrained trump selection → remaining four cards → eight tricks → confirmed scoring.

The trump selector leads first; subsequent trick winners lead. Teammates sit opposite, turns run counterclockwise. Private cheating evidence must remain server-private when multiplayer is added.

Accusation timing, restart dealer selection and repeated-draw scoring remain unresolved; see RULE_CLARIFICATIONS.md. This document does not define missing transitions or policies.
