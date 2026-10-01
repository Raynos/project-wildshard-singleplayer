# J15 · Play the template from Developer mode

- `template-deck.jpg`: 390×844 phone-tier title deck, hidden template last with DEVELOPER ONLY ribbon.
- `template-play.jpg`: template in play, banner below the existing top HUD (no overlap with minimap or vitals).
- `proof.json`: capture build, workflow, measurements and all-seven boot error evidence.

Captured through agent-browser after `scripts/browser-lane.sh wait`, on a scratchpad served build with a retained exec lease. Desktop Chromium emulates the requested iPhone portrait viewport; these are not physical-iPhone captures. Source: clean HEAD export e0a462fe plus J15 runtime files; build `b-muq140bv`.

The first banner placement overlapped the minimap and was moved to the first clear row below it. Loading/animation frames were discarded; both delivered images were inspected. Browser session and preview closed.

The required boot gate (`fingerprint+poses`, m5, phone, all shards) completed twice, with empty `boot.errors` for all seven shards. Full parity is red on the intentionally changed template HUD and device save reads, plus existing pose/GPU baseline drift; it is not claimed green. Lead owns full parity acceptance and deployment.
