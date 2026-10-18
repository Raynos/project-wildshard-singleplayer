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

Still open: longer
performance testing, approved artwork/rig integration and public playable delivery.
The five-entry selector remains available; this run covers only Brine Puffer.
Software-rendered cloud timings are not phone performance acceptance.

## Mounted artifact and failure recovery

Tree `214d74abf4282a4b84aea426105cb2669f8d7dd0`, captured 2026-10-18.
`mounted-recovery-smoke.json` records a deliberately failed first guest-Wasm
request, the visible failure status, and a successful real Start retry on a fresh
canvas. The same run repeats the Puffer win, two collected coins and fresh bout.
All requests remain under `/practice/`; local/session storage is unchanged and
there are no uncaught page errors. `mounted-puffer-entry.jpg` is the actual
portrait before diagnostic melee repositioning.

The retained static artifact has 144 files totaling 9,947,303 bytes. It contains
the actual game code, minimal admitted product, shared body archive, sword arms
and physics library. Its shared body archive includes existing unused variants;
it does not boot the island world. This is a tested export, not a claim that the
public review deployment has already been updated.

## Player defeat and retry

On the same `214d74ab` artifact, `puffer-defense.json` records an idle defense
observation. After one recorded diagnostic player placement, actual Puffer bursts
reduce health from 100 to 0 over about 48 simulation seconds. Health, AI, damage
and simulation time are not modified. Defeat latches at zero, the player is
immobilized, and a real attack tap leaves the Puffer at 45 HP. Retry restores
player health to 100 and Puffer health to 45, with stalking active again. Storage
is unchanged and no uncaught page errors occur. `puffer-defeat.jpg` shows the
actual defeat status and scene; the demo selector partially overlaps the vitals
HUD, which remains a presentation issue.
