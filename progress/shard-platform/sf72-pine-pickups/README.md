# SF72 — shared pickup and pack laws, 2026-10-09

Plan-State: unchanged. This closes the renderer dependency of the laws, not Pine's remaining outcome differences.

The page and renderer-free consumers now use engine/world/interact/pickup.ts for the exact strict foot-radius,
height and native visibility rule. game/inventoryLaw.ts shares stacking, slots, first-pickup order and all-or-nothing
trades. The existing page wrapper still loads and filters legacy saves, saves at the same operations, and emits the
same change notifications. No new numeric restriction, save version, UI, tuning or collision is introduced.

Eight focused files / 62 checks pass, including real native wall/deck occlusion and four saved shard policies.
Saved inventory bytes are unchanged on read and match the pure law after each add/trade/checkpoint/reload, including
nonpositive no-op trades and existing zero/negative add behavior. Existing save/profile coverage remains in the full suite.

The candidate b8721e9c521021b995d1d1e0bc8e50f52160eba0 boots four real cases with no faults: Driftwood 3.870 s,
Pine 10.647 s, Developer Signal Dunes 3.589 s, grid 10.997 s. Muted iPhone 16 Pro Chromium, render scale 2.
One agent-browser session walks the ordinary player from Pine's spawn to resin-1: 7.101 s, taken/resin flags and
saved Amber resin ×1. The same session walks Driftwood's pier → Wendell, advances the real dialogue with pointer taps,
walks the hut steps, and presses the actual use action at the nearest visible chest: saved Doubloon ×2.
No inventory give, save seed, health/flag write or teleport is used. See [browser.json](browser.json) and the compressed
actual movement/save traces in browser-traces.json.gz. The browser is closed.

The first clean full suite had 5,887 passes and one refusal: Driftwood's spots provenance still hashed the old
Interactables source. The exact candidate's real spots were re-captured twice; all 30 positions/prompts and its
talk/sword/reward points are byte-identical. The new defining pickup leaf joins the source hash fence. The final clean
candidate fd436782135ac42191a8c136e21ed27550769fde passes 1,064 files / 5,895 checks in 107.34 s through the full-test
queue. Strict typing, root-config touched lint, tooling paths and the no-new-debt ratchet pass. No generated guard is
weakened or source hash invented.

Next: consume these laws with Pine's actual resin/token/bench placements and bounded pack continuation; then shared
prompt selection/dialogue. compatible:false remains intentional until the named outcomes in sf72-pine are closed.
