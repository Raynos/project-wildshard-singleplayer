# Round 10 · dome B, round 9 (E169, 2026-09-26): the first round in the ENGINE

The clean room moved into the real engine (`src/chunks/nine-dragon-stack/`, P0-5c). Dome B's files are now
`world/{square,gate,banyan,canopy,stalls,props,props3d,crowd}.ts` and the GATE / BANYAN / STALL / HAWKER / PLAZA
constants in `layout.ts`. This round re-establishes the 9 dome-B views and the spawn in the engine and works THE ASK: the
spawn frame (the real HUD) against `round-6-baseline-hud/style-A-jiehua-neon.jpg`.

- Capture: `scratchpad/domeb/capeng.mjs` on a private snapshot of the working tree (vite `:5263`, the shared `:5173`
  reloads under other agents' edits): `/?chunk=nine-dragon-stack&skipintro=1&tier=phone&touch=1&nolock=1&mute=1`, iPhone
  16 Pro UA, 402×874 @2 (landscape aerials 1600×900 @1). The spawn is the def's spawn pose (`w.player.spawn(…, y)`,
  pitch −4°), weapon and HUD on; the 9 views are posed from a late hook (the look loop's recipe), the camera's children
  (the viewmodel) hidden, with the clean room's shot numbers converted (eye 1.62 m, portrait hfov → vertical fov).
  Animation is not frozen in the engine (rain, drones, the train move between shots).
- `engine-before-*.jpg`: the engine as dome B found it (the ported round-8/9 state). `capture-*.jpg`: this round.
- `eye-check.jpg`: engine before · this round · style-A for the spawn; before · this · dome-B target for views 1, 2, 4, 9.

## Spawn vs style-A: the content gaps (crop by crop) and what changed

| Style-A has | The engine had | Fix (file) | Now |
|---|---|---|---|
| the right third: a noodle stall seen from the FRONT, lit interior, a cook, menu strips, the 麵 banner at its near corner, steam rising past its roof | the round-9 hawker stall faced west: from the spawn only its awning and banner showed, the interior off-frame right | `hawkerStall` rebuilt facing SOUTH (toward the spawn), 11 m ahead at the right, `HAWKER` = (6.3…9.7, −3.6…−1.4); a warm-lit back wall with menus, a white-clad cook, pots + wok, a steam column rising past the roof's edge; the banner at the west front corner (`stalls.ts`, `layout.ts`) | the lit counter + cook + menus + 麵 read at the frame's right edge, like style-A |
| mahjong players close at mid-right, in front of the stall | (round 9) a table at (4.7, 0.4) | kept; the stall now stands behind it, as in style-A | ✓ |
| the crowd sparse, mid-distance, along the path to the gate | a band of ~25 umbrella walkers crossing in front of the gate | the spawn's open cone 16 → 20 m, the square's middle zone 12 → 8 walkers (`square.ts`) | thinner band, the gate's feet show |
| the banyan right of the gate: a gnarled trunk, a curtain of dark roots | a smooth pale column, sparse thin roots | 30 strangler strands braided up the core; a curtain of 110 long dark roots on the side the spawn sees (south-west), most reaching the soil — each on its own random stream so the limbs and canopy stay put (`banyan.ts`) | the trunk reads braided; view 2 reads like target-2's root curtain |
| lanterns under the gate, lion-topped balustrade, carved panels | ✓ (round 9: 5 lanterns in the centre bay; TRELLIS lions; bolder panel relief) | — | ✓ |

## The two open items

- **The crown too bright from above (view 9)**: dome B's leaf ramp a step darker (`DOME_B_LEAVES`), the lit band
  0.22 → 0.18, the sky rim light 0.35 → 0.15 (`canopy.ts`). Darker, but the engine's pass still lifts it to a grey-green
  from above: the remaining part is the engine's fog / grade on the canopy (look/, the render agent's) — flagged.
- **Roof-tile colour**: dome B's base colours are already dark blue-teal (`TILE #0d181d`, rolls `#1b2c33`); in the
  engine the roofs read dark teal with bright eave boards, close to the targets. No change this round.

## For the coordinator / the port lead

- **Camera (proposal)**: in the engine the paifang fills 0.45 of the spawn frame's width against style-A's 0.35 (and
  the clean room's 0.35 at hfov 58°): the engine's portrait FOV is ~1.29× narrower (≈ 46° horizontal). Matching style-A
  needs the spawn's portrait hfov ≈ 58° (or the spawn ~9 m further back, z 7.5 → 16, which leaves the square behind
  it). The yaw (−12° in the engine) is right.
- **Colliders**: the hawker stall moved; `colliders.ts` already builds its box from `HAWKER`, so it follows. Its stools
  and the mahjong table at (4.7, 0.4) are walk-through (like every table).
- The spawn's viewmodel is a rifle, not the jian (the weapon wiring, not dome B's).

## Rulers (engine, phone tier)

- Draw calls 94–120, triangles 1.62–1.94 M per frame (budget ≤ 200 / ≤ 2.5 M). Dome B's delta this round: +~25 k tris
  (the strangler strands and the root curtain), +0 calls (everything merges into the banyan / stall kits).
- Gates: `tsc --noEmit` clean; oxlint clean on dome B's files.

## Round 9b: the hawker stall's interior (`eye-check-stall.jpg`: this round · 9b · style-A · a close view)

From the spawn the stall is seen 35° off its front, and its open west end showed the whole lit back wall as a flat cream
panel (the eyesore of the right third). Style-A's stall side is dark wood, its light seen over the counter:
- the west end closed in dark timber to the roof; the back wall darker and dimmer (`#6e4c30`, emit 0.16);
- the kitchen's clutter on the wall: a rail of 9 ladles and strainers, a second shelf of jars, a clock;
- the 麵 banner a little brighter (gain 1.35 → 1.6), like style-A's lit paper sign.
By eye: better (the cream slab is gone; wood, lantern and banner carry the corner). Nothing reverted.
