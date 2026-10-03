# Animation and rigging remaster — four shards

**State:** `draft` 2026-10-03 — unblocked 2026-10-03 (Jake, E404): the E357 lock ended when GAME-NORMALIZATION was archived (`5390d75f9`). E357 X4 supplies the engine rig contract, metadata clip aliases and the animation machine; A3–A7 (ask E378) build on it. Waits on Jake's picks for the broad implementation; E336's dummy pilot stays live in `d1cdcee-munun0hj`.

## Scope and evidence

Use UniMate to generate motion **offline on this Mac**, retarget it onto the actual shipped skeletons, edit and measure it, then ship compact animation clips. The runtime remains Three.js; no inference or text encoder loads in the game. Improve readable weight, anticipation, contacts and recovery while retaining gameplay timing, colliders, species identity and the existing visual art.

The [complete Explorer audit](../audits/animation-models.md) lists **every card and every variant**; its [JSON](../audits/animation-models.json) records actual joint order, skins, vertices and weight/index checks. Snapshot: Driftwood 69 cards / 160 inspections; Pine 61 / 126; Nalati 88 / 139; Nine Dragon 58 / 90. Shared cards repeat: 276 per-shard cards, 264 distinct ids, 515 inspections. Existing model migration and E322 work are ongoing; repeat the audit against the landed tree before each wave. In particular E333 removes the AR-15 from Driftwood/Nine Dragon after this snapshot.

UniMate is a motion generator, **not an automatic mesh rigger**. The [project](https://linzhanmou.com/unimate/), [code](https://github.com/Friedrich-M/UniMate) and [released model](https://huggingface.co/Linzhan/UniMate) provide arbitrary-topology conditioning, text motion, in-betweening and constrained editing. The chosen v2 release is a 74.1M-parameter denoiser, trained for 60 frames at 30 Hz and 5–70 actual joints; 71 is the padded tensor capacity. Latest preprocessing supports rest-only rigs despite the older model-card requirement for an existing clip. More joints alone do not make a better rig. Its CUDA recipe does not establish MPS compatibility; E336 measures our adapter on the Mac.

Pinned pilot code: `Friedrich-M/UniMate@5d6aabedd947297b5ba6706d8e9113e68c0c3e4f`. Weights: `~/projects/weights/manual/Linzhan/UniMate/unimate_uniml3d_f60_v2`; text encoder: `~/projects/weights/manual/google/flan-t5-base`. Code/weights MIT, encoder Apache-2.0. Fetch with the weight-store script, keep weights outside Git, use the shared model lock, and record measured speed/memory in localai. A generation is a candidate until its evaluated pose and contacts pass.

## What actually needs work

| Family | Current implementation | Proposed improvement / prerequisite |
|---|---|---|
| Shared practice dummies, all three materials | 18-joint humanoid skin, no embedded clips; procedural hit springs | E336: generated idle and five hit/recovery clips per figure, fixed base, mass-dependent playback and immediate additive hit response. Preserve mesh, skin and bone bind frames unless measurements show a defect. |
| Driftwood sailor / captain | 16-joint skins; procedural locomotion/combat | Salt-heavy idle, stagger, shamble, lunge and recover; captain anticipation and readable attack transitions. Keep actual hit frames and attacks authoritative. |
| Driftwood Wendell / trader | Rigid head/body/arm pivots | Full humanoid rig first; look-at + talk/beckon/tidy, then steps and sitting where gameplay needs them. Satchel/counter contacts remain constrained. |
| Driftwood boar / bear / crab / monkey | 20 / 20 / 20 / 19-joint skins across all listed coats | Grounded idle/walk/trot/charge/hit/death; crab lateral gait and monkey climbing are separate prompts/contact sets. Do not retarget a human walk blindly. |
| Pine deer / boar / bear / elk / Antler King | 20-joint species rigs; boss dresses an elk | Hoof/paw contacts, grazing, alert, trot, turn, charge and species-specific reactions. Antlers and gear must remain rigid to their attachment bones. |
| Pine Hale / Brandt / Mott | 11-joint skins in baseline; E322 richer NPC rig in progress | Reconcile E322 first; add natural idle/talk/point/walk, shoulder and forearm deformation, grounded lower body. No duplicate rig migration. |
| Pine birds / hare, Driftwood gull / fish | Shader / rigid instanced populations, no skin | Close-distance flap/hop/perch/swim prototype only where it improves the view; bake or retain shader motion for distant instances. |
| Nalati horse / Argymaq | 24-joint skins, 11 horse coats | Hoof contacts, breathing, walk/trot/canter/gallop, stopping/turning/jump/rear/panic. Reins/head direction must reconcile E320; ridden camera and mount physics stay authoritative. |
| Nalati wolf / sheepdog / Aqbars / Kokbori | 22-joint skins | Pack identity, sniff/alert/loiter, paw-locked gait, bite/recoil/howl; large bosses get stronger anticipation without slowing damage timing. |
| Nalati Qyran / balbal / Golden King | 10 / 16 / 18-joint skins | Wing-fold and flight cycle; stone-weight walk and strike; regal idle and attack recovery. Measure each topology separately. |
| Nalati camp people | Three-joint skin per person | Humanoid rig + new weights first. Combined 15-joint camp is five people, not a single humanoid. Cooking/seated/standing/contact motion by role. |
| Nalati ghost riders / shepherd / kokpar | Horse skin; ghost rider/appearance attached in-world and absent from its Explorer specimen; shepherd has rigid rider; kokpar rigid silhouette | Fix specimen parity, then separate rider rig and seated contact layer; synchronize hands/reins, pelvis/saddle and horse gait. Preserve distant instancing. |
| Nalati sheep / marmots / Storm Titan | Instanced shader life / procedural articulated scenery | Keep population costs; close sheep grazing/hop and marmot upright motion where visible. Titan test needs contact and scale constraints before any replacement. |
| Nine Dragon walkers / sitters / brush figures | Static figures; walkers move by rigid route transforms | Close NPC walk/turn/umbrella grip and sitting/mahjong/cooking, then instance-compatible distant motion. Walkers must stop sliding while respecting routes and crowd budget. |
| Nine Dragon first-person arms | Two seven-joint skeletons, 10 skins, 16 authored clips + cloth | Review existing clips before replacing any. Improve grip/pose transitions and blend quality while preserving jian/grapple contacts, gameplay events and tassels. |
| All weapons / hats / capes / strings | Primarily rigid props; procedural held transforms / cloth | Animate the owning hands and mechanical joints; do not give an iron sword a humanoid rig. Audit draw/reload/recoil/charge, grip and cloth intersections. |
| Buildings / rocks / vegetation / ordinary props / transit | Static merges, instances, wind, kinematic transforms | Explicitly covered by the catalogue; retain static geometry. Rig only an interaction with a real articulated requirement. No blanket conversion to individual skins. |

Every variant/coating in the audit inherits its family gate **only after** its actual rest frame, mesh, weights and scale are checked. A successful clip on one coat is not proof for another rig or another species.

## Checkpoints and picks

This table is a proposed order, not approval to build the unpicked rows. Each implementation pick gets its own ask and owner; the E336 trial has direct authorization already.

| Row | Deliverable | State / dependency | Review evidence |
|---|---|---|---|
| A0 | All four actual Explorer catalogues and source cross-check | Audited, E335 | Full card/variant table and JSON; rerun on landed baseline |
| A1 | Reproducible local UniMate adapter | Built, E336 `3ad39bbd` | Pinned setup, exact prompts/seeds; 18 finite clips, 450.271 s and 2.620 GB peak footprint |
| A2 | Three HUD arena dummy remasters | Verified/live, E336; visual review | All three in portrait arena; 18 clip + 12 runtime sweeps pass; footage and tests; `d1cdcee-munun0hj` |
| A3 | General Explorer clip review and specimen parity | Proposed | Actual playback for people/gear as well as Animal; ghost-rider attachments/material; seek, speed, loop, rest/skin/bone view; measured clip labels |
| A4 | Driftwood humanoids + close creature contacts | Proposed | NPC rig prerequisite, soldier/captain attacks, crab/monkey-specific review |
| A5 | Pine NPCs and animal gait remaster | Proposed; reconcile E322 | Every picked NPC + species/coat, paws/hooves, antler/boss constraints |
| A6 | Nalati mounted + ground motion | Proposed; reconcile E320/E322 | Horse/rider separate skeletons, saddle/reins contacts, camp people rig rebuild |
| A7 | Nine Dragon crowd + arms | Proposed; coordinate E334 hands work | No foot sliding, grips stay on props, retained attack and grapple timing |
| A8 | Close wildlife / gear / cloth audit | Proposed | Compare against existing shader motion and held-weapon animation; only replace winners |
| A9 | Runtime/performance acceptance, cleanup | Required within every approved wave | Frame-time and draw budgets, physical iPhone memory/stability, source provenance; remove losing variants after pick |

The first review after E336 should pick a small visible wave, such as Driftwood sailor/captain and Wendell, or Pine’s three NPCs after E322. Avoid loading every candidate rig into one inference batch or changing all four worlds before a visual decision.

## Build and animation contract

1. Export the actual ordered skin joints, parents, local rest transforms and inverse binds. Preserve source topology and attachment points. For missing rigs, author a source-controlled rig/weight script, inspect bind parity and joint placement, and rebuild through the project’s Blender target flow.
2. Normalize facing/height only for conditioning. Generate with prompts and seeds recorded, under the machine-wide lock. Save raw candidate output outside Git; keep approved compact clips, provenance and the adapter in Git. Runtime input never includes checkpoints or the text encoder.
3. Retarget through the original parent rest frame; resolve UniMate’s parent-shifted rotations and canonical facing. Animate rotations without changing joint scale. Root locomotion, feet/hands constraints and game simulation have explicit ownership. For the anchored dummies, root and leg motion stay fixed.
4. Edit starts/ends, contact timing, loop seams and transitions. Constrained generation/in-betweening can help, but does not prove a contact stays planted. Longer actions need measured stitched windows, not a duplicated two-second loop labelled a long clip.
5. Layer look-at, recoil and immediate damage response over clips. Interrupt/blend reactions under repeated hits; no queued animation may delay damage, collision, stagger, projectile attachment or weapon contacts. Species mass changes amplitude and recovery, not hit registration.
6. Measure the evaluated skin at sampled frames: finite joints/vertices, normalized quaternions and weights, valid indices, rest-pose parity, no negative scale, stable base/foot contacts, triangle stretch/collapse, shoulder/elbow/neck intersections, loop position/rotation seams. Gate finite/index/active-weight defects at zero, quaternion length error ≤1e-5 and loop rotation seam ≤1°. Anchored dummy base/legs must remain unchanged within 1e-5 m; locomotion contact drift must stay ≤2 cm during declared support phases. Declare critical-edge stretch/collapse thresholds per material before the wave, compare them to existing geometry, and reject newly collapsed triangles. Authored damage/contact event times stay unchanged. Measure actual motions, not their text labels.
7. Capture the picked actions in the real portrait HUD/Explorer and in-world. Validate all variants, weak/head/left/right/heavy and rapid repeated hits; existing tests plus meaningful deformation/contact tests. Serve a built tree and close every browser session.
8. Compare frame times, draws, resident memory and loading bytes against baseline. Target 60 FPS; maintain the existing 1.8 GB loading / 1.0 GB Explorer physical-device memory caps. A desktop or Simulator pass cannot establish physical iPhone acceptance. Distant populations keep batching; no facade multi-draw anywhere.

## Pilot record

The E336 pilot starts from the three committed dummy GLBs and their measured 18-joint skins. It does not regenerate their appearance. Proposed output is six clips per material: idle, body hit, head hit, left hit, right hit and heavy recovery. Rig basis, fixed legs/base, clip envelope and additive spring response are part of the remaster. Generation, evaluated pose measurements, runtime capture and release evidence will be recorded in E336 and the pilot audit. Until those pass, generated candidates are not described as shipped improvements.
