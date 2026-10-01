# Signal Dunes (`sunscar-dunes`)

Shard 5 (E363, E357 Z3): a small dune sea just after sunset. Dark orange sand, a deep orange and indigo sky with the
first stars, cool blue in the hollows. A braided bullwhip, a dune ray that glides over the crests and swoops at you,
and one quest step: light the signal fire on the wooden tower on the far crest. Jake's pick: round 2, C
(`art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg`). No glass, crystals, mirrors or glowing magic.

Built from `_template`, [docs/SHARDS.md](../../../docs/SHARDS.md) and [docs/ENGINE.md](../../../docs/ENGINE.md) alone,
with zero engine edits. The API gaps it hit are in `docs/tasks/asks/E363.md`.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 5 |
| `style`, `kitLook` | `pbr`, `pbr` |
| `uses` | `quests`, `hover`, `explore`, `coins` |
| `ground` | a 500 m heightfield of transverse dunes (`world/dunes.ts`), the far crest mound, one crest path; play inside ±125 m |
| `loadout` | the custom bullwhip (held), the kit hoverboard |
| `species` | `duneRay` (its own row, look and brain) |
| `bag` | MAP · GEAR |
| `hud` | the baseline HUD; one pin over the signal tower |
| `tiers` | no god rays, no AO; FXAA on the phone |
| `assets` | none: every mesh, the sky and the ground are procedural; no downloads beyond the engine's runtime |
| saves | one shard key, `sunscar-dunes.signal` (the fire stays lit, the reward is paid once) |

## Its custom code, and why

| File | What |
|---|---|
| `world/dunes.ts` | the landscape: transverse ridges (a long windward rise, a short slip face under ~35°) warped by noise on a slow swell, the crest mound; the sand albedo |
| `look/render.ts`, `look/sky.ts` | the `extend` look: a dusk dome on the camera (gradient, the glow band, cloud streaks, stars), a frozen dusk clock, the key light low off the glow, an indigo hemisphere fill, mauve fog tinted orange toward the glow; the ground painter with procedural wind ripples in the normal |
| `weapons/SignalWhip.ts`, `weapons/whipModel.ts` | rung 3, custom: no kit family throws a flexible line. `blocks.viewmodel` + `blocks.melee`; the crack lands 0.13 s after the press on a 6.5 m × 0.55 m line; heavy is a double crack that staggers. Input (E365): LMB / F or the ATTACK tap = light, RMB or lifting a held ATTACK = heavy; `charge` fills the disc's ring. The viewmodel is one tube rebuilt per frame with a braided vertex-colour spiral, drawn in the viewmodel pass (a depth clear at 999, the whip at 1000) |
| `species/duneRay.ts` | the ray: a skinned planform (body, two-bone wings, tail), and `DuneRayBrain` (glide → swoop → climb). It flies by `yOffset` and `setMotion`; the swoop is a `lane` `StrikeSpec` whose windup is the tell (it hangs and rears) and whose dive lands only within 2.6 m of the player. A whip hit breaks the swoop |
| `world/tower.ts`, `world/build.ts` | the signal tower (7 m deck, a mast, merged timber, an iron basket, the stair as `treads`), its colliders, the fire (flame cones + one point light) and the interactable on the deck |
| `world/cameras.ts` | capture poses (`dev.poses`): C (Jake's pick's frame), a hollow, the deck |
| `quest/install.ts` | one step, "Light the signal fire", 5 coins once |
| `audio/cues.ts` | the whip's cues on kit voices (placeholder) |

## Budgets

Phone 30 fps (9.6 ms CPU), desktop 60 (4.8 ms), no `ceilings`. Draws: ground 1, sky 1, tower 2 (+4 flames when lit),
ray 1, whip 5 (with its depth clear). The ground is 169² vertices over 420 m.

## Look

Realistic dusk. The sun is set: the key light is the glow's last skylight, ~16° up from the west, so the west faces of
the ridges catch warm light and the east faces fall into the hemisphere's indigo; the sky is a narrow orange band under
indigo with the first stars. No LUT yet. `__wildshard.shard.sunscarLight` ({ DUSK, LIGHT, BAND }) tunes it live.

## Captures

- `art/sunscar-dunes/round-3-build/board-c2fdc72d.jpg`: the spawn view, the ray rearing to swoop, the lit tower, the
  quest toast after a swoop hit (phone frame, 390 × 844).

## Tests

- `test/shards/sunscar-dunes/contract.test.ts`: boots headless through every stage and tears down; lights the fire and
  pays once (and the fire stays lit on reload); the crack's line; the swoop lands only when the ray is low; every
  slope under 38°; light / heavy / touch-hold input; the strike clock frees the ray for its next swoop.

## Open asks

- E363: the build, its API gaps and the handoff.
- Leftovers (E363): the whip crack, wind ambience and a dusk score generated locally (MOSS + Stable Audio, MiniMax);
  a portrait title card; portrait boards of the ray and the whip for Jake.
