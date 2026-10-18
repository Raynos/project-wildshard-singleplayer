# Driftwood: five new enemy designs

**Status:** draft, unread, 2026-10-18. Design and source research only.
**Plan:** [DRIFTWOOD-ENEMIES](../plans/DRIFTWOOD-ENEMIES.md), E487.
**Acceptance:** 0/5 implemented or runtime-verified. No new world placement.

Three regular enemies, one elite and one boss. These are new silhouettes,
rigs and decision patterns, not extra coats for the existing crab, monkey,
sailor, captain, boar or bear. Names and numbers below are working choices.
All eventual unfinished gameplay belongs behind Developer.

## Regular 1: Brine Puffer

- **Read:** squat ochre fish on broad teal walking fins; ivory spikes fold
  flat until its belly inflates. About 0.8 m tall at rest, 1.2 m inflated.
  Hard planar facets and large eyes preserve the island's low-poly toon look.
- **Fight:** approaches slowly, stops and inflates for 0.9 s, then releases
  one 2.2 m radial brine burst. The player retreats and returns during a
  1.1 s deflated recovery. It cannot follow the player during inflation.
  First-pass tuning: 45 HP, 12 damage, 2.4 s cooldown after recovery.
- **Animation/rig:** body, belly ribs, head, paired fins and tail; idle gulp,
  fin-waddle, inflate, burst, deflate, hit and death. Inflate must change the
  actual mesh silhouette, not just a glow or a UI circle.
- **Death/loot:** deflates and flops onto one fin; pending burst cancels
  immediately. Proposed world bounty: 2 coins, emitted once. Practice records
  a simulated reward only. No poison, persistent puddle or new status system.
- **Difference:** teaches backing out of radial range and returning to punish;
  neither crab flanking nor monkey projectile chasing.

## Regular 2: Conch Duelist

- **Read:** upright sea-snail creature carrying an asymmetric spiral shell,
  coral-pink mantle and one long ivory shell-point arm. About 1.3 m tall.
  The moving soft body remains visible; it must not resemble a crab reskin.
- **Fight:** a conspicuous 0.6 s shell brace precedes a narrow 2.4 m thrust;
  the shell opens for 0.9 s afterward. A hit during brace triggers a
  separately telegraphed counter, never instant hidden damage. First-pass
  tuning: 60 HP, 14 thrust damage, 16 counter damage.
- **Animation/rig:** mantle root, head, shell, guard arm, thrust arm and foot;
  soft-body glide, shell-turn brace, arm pullback, thrust, recoil, hit and
  collapse. Guard and counter need distinct poses readable from behind too.
- **Death/loot:** mantle collapses and shell rolls only within a short visual
  pose, with no independent damaging physics object. Proposed bounty: 3 coins.
- **Difference:** its defense is a short announced timing state, not the
  existing crab's permanent 50% frontal damage reduction. The player waits
  out a guard or punishes recovery. Damage-rule admission is a required gate.

## Regular 3: Splinter Mantis

- **Read:** thin driftwood insect with four root legs, leaf-green sail fins
  and two angular hooked forearms. About 1.5 m tall; generous negative space
  between limbs contrasts with the puffer and conch.
- **Fight:** locks its heading after a 0.75 s crouch, lunges down a narrow
  3.5 m lane, then raises the other arm for a visibly separate 0.45 s second
  lunge. No turn tracking during either committed active window. A 1.1 s
  recovery rewards a sideways dodge. First-pass: 55 HP, 10 damage per lunge.
- **Animation/rig:** torso, neck/head, four two-joint legs and two two-joint
  forearms; sway, stalking gait, crouch, two different lunges, skid, hit,
  stagger and death. Each active attack has its own once-only hit latch.
- **Death/loot:** limbs fold beneath the trunk; the second attack cancels on
  stagger or death. Proposed bounty: 3 coins.
- **Difference:** a readable two-beat directional duel rather than boar
  contact damage or a continuously homing charge. Collision ends movement
  safely without deleting the recovery window.

## Elite: Bellback

- **Read:** a broad four-legged wreckwood construct carrying a verdigris ship
  bell inside an open rib frame; rope tendons and a visible swinging clapper.
  About 2.1 m tall. Neither humanoid sailor nor enlarged regular enemy.
- **Fight:** a 1.2 s raised-clapper windup can be interrupted by stagger.
  Its first 2.4 m pulse is followed by a separately announced outer-ring
  echo, with a safe inner pocket. A slow close-range foot slam discourages
  standing still. First-pass: 180 HP, 16 pulse damage, 12 echo damage.
- **Animation/rig:** body, bell cradle, bell, clapper, head and four segmented
  legs; heavy gait, clapper lift, ring recoil, stomp, stagger and collapse.
  Visible clapper timing must carry the tell even with audio muted.
- **Death/loot:** the bell tips into its frame and all queued echoes cancel.
  Proposed 12-coin bounty plus a one-time cosmetic bell keepsake, subject to
  collection admission. No permanent combat stat grant is assumed.
- **Difference:** asks the player to interrupt or relocate between two
  different danger bands; elite identity comes from behavior, not rarity.

## Boss: Tide-Root Colossus

- **Read:** a living mangrove stump with a sea-glass heart, broken crown and
  four articulated octopus-like roots. About 3.6 m high and 5 m across at
  rest. Own silhouette and rig; no captain mesh or humanoid sword animation.
- **Fight:** stays near its arena center. Phase one alternates an announced
  left/right root sweep and an aimed overhead slam. The slam exposes the
  heart for a punish window. Below 55% HP, a second root follows after its
  own tell; below 25%, sequences combine sweep then slam while retaining the
  same minimum tells. First-pass: 480 HP, 18 sweep and 22 slam damage.
- **Animation/rig:** root body, heart cage, crown and three joints per root;
  idle breathing, turn, left/right windup and sweep, overhead lift/slam,
  exposed-core recoil, stagger, phase change and death. No summoned adds,
  water simulation or flight is required for the initial complete fight.
- **Death/loot:** roots withdraw, crown settles, heart light extinguishes;
  all active volumes disappear immediately. Proposed 35 coins and one-time
  cosmetic sea-glass heart keepsake. It does not replace the Captain's
  existing finale, quest flags or hat reward.
- **Difference:** a multi-limb spatial boss with alternating safe sides and
  punish windows, not a larger captain or a faster bear. Arena size and
  limb bounds require an explicit fit check before admission.

## Actual authoring and admission path

Source audit, not a claim these paths have been extended:

1. **Bodies:** `generators/creatureBodies.ts` supplies bones, dimensions and
   skinned geometry. `generators/bake-driftwood-creatures.mjs` writes packed
   geometry plus `data/creatureBodies.generated.json`. `species/bodies.ts`
   preloads and copies fresh owned parts. An exported GLB alone is not a
   runtime creature. A new producer should remain separate until validated.
2. **Looks/animation:** `species/crab.ts` illustrates `SpeciesLook`, a rig
   contract and `numericCreaturePose`. `generators/crabClips.ts` bakes numeric
   channel programs consumed from generated clip JSON. New authored GLB
   clips must be translated into the admitted rig/pose path or use a proven
   supported clip host; neither is assumed automatic. Toon graphs are lent
   through `runtime/looks/creatureLooks.ts`.
3. **Species/strikes:** `generators/enemySpecies.ts`, `data/strikes.json` and
   `data/speciesActions.json` feed `generators/speciesPrograms.ts`, then the
   `actors/species-programs` product section in `generators/output.ts`.
   Existing strike geometry supports point, arc, lane and ring shapes.
   New attacks still need timings, action latches, damage and cover checks.
4. **New decisions:** `generators/captainDecision.ts` and
   `behaviour/captain.as` demonstrate admitted AssemblyScript decisions,
   fields, moves and strikes. Use shard-owned guests for these new behaviors;
   no shard branches in the engine and no cross-shard source imports.
5. **Discovery:** resolved species looks are installed through
   `species/install.ts`; specimen definitions live in
   `runtime/models/creatures.ts` and `roster.ts`. New enemies must be
   Developer-gated, including their Explorer and arena admission.
6. **Rewards:** `generators/economy.ts` defines coin bounties;
   `generators/loot.ts` builds match-by-kind reward tables and one-time
   trophies using `data/keepsakes.json` and `data/keepsakePickups.json`.
   New keepsakes also need item, model and collection rows. Arena execution
   must never call live reward or quest chains.
7. **Placement last:** `generators/sections.ts` currently restricts enemy
   placement kinds to crab/monkey/sailor. New placement requires intentional
   schema, generator, native/runtime and baked-map parity work after combat
   admission; merely appending spawn rows is insufficient.

## Asset and proof contract

- Prefer separate deterministic procedural author sources for the first
  experiment; preserve every original asset and look. Scripts are source,
  GLBs are actual exports, no committed `.blend`. A GLB under 1,000,000 bytes
  and portrait previews under 250,000 bytes are hard targets per enemy.
- Cloud inspection found Blender 4.3.2 installed; the repository target names
  5.2.1. Do not claim reproducibility against that pinned version without
  running it. No new packages, weights or assets were generated in this audit.
- Verify finite geometry, bounds, unique joints, normalized weights, sockets,
  every required motion and pose/strike timing before specimen admission.
- Verify telegraph, dodge, cover, stagger, active once, death cancellation,
  reward once, replay/reset and complete disposal before world placement.
- The arena's initial grounded-skirmisher adapter does not yet admit these
  decision guests. Keep unsupported entries disabled; never flatten their
  designs into crab behavior just to make a selector row appear enabled.
- Baseline crab parity must include its `damageMul` look rule, not only its
  generic species HP and strike rows. Full kit and mobile/performance proof
  remain separate from source checks or a rendered specimen.

Recommended first asset experiment after the arena foundation is verified:
Brine Puffer. Its silhouette-changing inflate/deflate cycle and radial strike
exercise a genuinely new rig and combat pattern without requiring another
world service. Then build Mantis, Conch, Bellback and Colossus in that order.
