# V2.9 turn clocks, trick replay, and table release

## Turn clocks

`CASUAL_TURN_SECONDS=0` leaves enforcement off. For local verification, `CASUAL_TURN_SECONDS=30` enables the proposed 30-second policy. The server ignores this setting in production. Ranked games do not use it. No schema migration is required. SQLite stores the optional deadline in the versioned room payload together with the state that established it.

The clock begins after trump selection and advances only when the play position changes, including when a trick winner plays the next lead. Lobby, cutting, trump selection, cancelled and completed hands have no play deadline. An expired connected human turn uses the existing casual bot card selection through the same engine transition. An offline human retains the existing disconnect grace. An actual bot uses the existing bot cadence. If a human reconnects after the deadline, it stays expired. Server time is authoritative. The display uses a server timestamp and monotonic browser elapsed time, so device wall-clock changes do not modify gameplay.

## Trick presentation

The client queues completed public tricks from the round in order. Fast, Normal and Relaxed show each new trick for 2, 3 or 5 seconds. The server immediately settles the trick and may accept new plays while the client is presenting the result. The display resets its reveal queue when the round changes. Replay uses only the last completed public trick and shows its lead suit, trump, winner and four plays.

## Table removal

From Home, open **Manage saved table**. Release a lobby, permanently leave an active casual match, or remove a completed table. Until the server acknowledges release, the client retains its saved seat. A casual departure transfers the active host role when appropriate and leaves the original seat as a permanent bot, with its original match attribution. If no humans remain, the unfinished room is archived without inventing a winner. Finished results and ratings are preserved. The existing ranked reconnection and forfeit rules remain in force. A stale or repeated release for the old room cannot remove membership in a new room.

## V3.0 preparation

Keep the official site separate from the same-origin game API and WSS under the planned play hostname. The existing Azure runbook covers Linux VM service startup, the persistent SQLite mount, NGINX, TLS, backups and monitoring. Production DNS, certificates, public recovery and live TURN still require acceptance. The existing report workflow stores structured private reports. A general bug dashboard and screenshot or voice attachments remain separate work requiring evidence limits, retention, access controls and owner approval. Advertising remains gated on provider, creative and privacy approval. [Azure deployment runbook](AZURE_DEPLOYMENT.md)
