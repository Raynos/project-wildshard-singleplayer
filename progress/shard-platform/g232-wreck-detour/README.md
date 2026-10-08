# Driftwood wreck capture detour (G232 / E435)

Pinned `7c7589f7b`, one muted iPhone 16 Pro portrait browser through browser-lane. The capture route goes south of the visible wreck via `(172, -30)` and `(120, -30)`, then returns through the foot of the east jetty landing. Inward arrived in 16.678 s; return arrived on the road in 21.010 s. Zero page/shader errors, road look and material-chain readback identical. Browser and preview closed.

This changes only the capture driver. The original straight-line 4/4 RED and the native actual-shape counterfactual remain in [the attribution receipt](../g232-wreck-attribution/README.md); no collider, navmesh or appearance change. An initial detour joined the jetty too far east at x185 and timed out below the deck on return; the corrected route joins at x172. The driver now records every leg and refuses screenshots after a timed-out entry/return.

`assertions.json.gz` preserves every successful-run assertion; `summary.json` seals it with SHA256. The portrait captures show the unchanged destination poses. This is a traversal/capture proof, not a frame-floor or memory-cap verdict.
