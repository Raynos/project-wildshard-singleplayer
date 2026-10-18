# Standalone Puffer mechanics proof

Runtime tree: `a876b85139e740f59b6ddb56717a28fd708b5e96`.
Captured 2026-10-18 in a portrait touch browser, 402×874 CSS pixels, using the
actual production build and existing game combat, physics, weapon, guest,
animation, death, loot and retry systems. The geometry shown is an explicitly
rejected mechanics fixture, not the approved replacement art.

Verified in `puffer-smoke.json`:
- Clean entry: one Brine Puffer, zero visible practice dummies, 45 HP.
- Eight real touch attack taps: Puffer reaches 0 HP and the real dead state.
- Actual coin arrivals report 2 local practice coins.
- Retry restores Puffer to 45 HP and player to 100 HP.
- Local/session storage remains unchanged; no uncaught page errors.

The player was diagnostically repositioned for the melee check. Its exact pose,
the runtime tree and diagnostic-script hash are recorded in the receipt. The
entry portrait precedes that repositioning and uses the actual game HUD/materials.

The initial clean boot exposed an omitted coin recipe, documented in
`missing-coin-recipe.json`. The fix carries the existing prepared coin geometry
as a verified product blob and installs it through the ordinary pickup catalogue.
Nine focused product/coin tests, strict entry-closure typechecking and the actual
pre-commit gate passed for the correction.

Still open: enemy-to-player damage/defeat, failed-initial-load recovery, longer
performance testing, approved artwork/rig integration and public playable delivery.
The five-entry selector remains available; this run covers only Brine Puffer.
Software-rendered cloud timings are not phone performance acceptance.
