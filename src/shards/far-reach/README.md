# Sky Reach (`far-reach`)

Floating islands over a sea of cloud at golden hour (Jake's pick **B · Sky Reach**, ask E364). Built in E357 Z3 round 2
from `docs/SHARDS.md`, the template and `docs/ENGINE.md` alone, with zero engine edits. `experimental`, deck 6.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 6 |
| `style`, `kitLook` | `skyReach` (its own word), `toon` |
| `ground` | `structures: true`: every island and bridge is a registry piece; the terrain is a flat datum at y −8, hidden under the cloud sea (y 0) |
| `bounds`, `world` | ±140 m, soft respawn below y 6 (the player); creatures die below y −40 (`world.killY`, cause `fall`) |
| `horizon`, `boundary` | `{ rings: [], cloudSea: false }`, `{ visible: false }`: the look draws its own sky and cloud sea |
| `uses` | `quests`, `hover`, `coins` |
| `loadout` | the war fan (held, custom) and the kit hoverboard |
| `species` | `driftRay` (its own row, look and brain; a flyer over the void) |
| `tiers` | `far.farIsles` (far scenery islands: phone 8, desktop 12); no god rays, no AO |
| saves | `far-reach.rewarded` (shard) and the quest flags (`Flags`) |
| assets | none: every mesh is code, the card is an inline SVG |

## The world (`layout.ts`, `world/`)

Five islands (Sunrest, the spawn; Windmill isle; Fernhold; the Ray roost; Tern rock), each a flat grass top on a jittered
polygon (a hull collider) over a faceted rock cone with stalactites, merged into one vertex-coloured mesh.

- **Rope bridge** (Sunrest → Fernhold): planks, posts, sagging rope rails; a deck and two rail colliders.
- **Hover bridges** (Sunrest → roost, Sunrest → Tern rock): glass decks with glowing rungs and crystal pylons. Jake's
  rule: they carry only a hoverboard rider. The deck piece's `active()` is `app.player?.mode === 'board'`; on foot it
  doesn't collide and you fall through. Each deck starts clear of the island rim and its lip (the first run's board), so
  on foot you drop straight down rather than sliding down a cliff, into the soft respawn.
- **The fallen bridge** (Sunrest → Windmill isle) hangs from Sunrest's north rim until the winch raises it; it collides
  only once it is up.

## Its custom code, and why

| File | What |
|---|---|
| `plugin.ts` | the three hooks; the fan's input context (SWING relabel on `r0`, GUST on `verb.1` and G); the hover glow; spawns the ray |
| `weapons/WarFan.ts`, `fanModel.ts` | the war fan (rung 3, `extends Weapon` from `blocks.viewmodel` + `blocks.melee`): SWING arc, held heavy cut, GUST cone that `impulse`s creatures and breaks a ray's dive |
| `species/driftRay.ts` | the drift ray: `flight: { above: 'world' }`, a `CreatureBrain` (circle → telegraphed hover → sphere dive with `track: 'lead'` → rise), skinned wings |
| `quest/install.ts` | *The fallen bridge*: raise it at the winch, cross to the windmill; 10 coins once |
| `world/build.ts`, `islands.ts`, `bridges.ts`, `facets.ts` | the islands, bridges, windmill and winch as registry pieces |
| `look/render.ts` | an `extend` look: a golden-hour gradient dome with a sun (`backdrop.clouds`), an fbm cloud sea that follows the camera, a warm linear haze through `patchShader` |
| `audio/cues.ts` | kit voices for every fan beat |

## Budgets

Phone 30 fps (9.6 ms CPU), desktop 60 (4.8 ms), the template's split (`budgets.ts`). About a dozen draws for the world.

## Look

Faceted low-poly, flat-shaded vertex colours; peach horizon to lavender zenith; the low sun ahead-left of the spawn view;
pink-white cloud sea; teal war fan. Matches `art/far-reach/round-2-build/board-8dbba343.jpg` (Jake: the look stands).

## Open asks

- E364: Jake's board `art/far-reach/round-3-rebuild/`; the API gaps are in `docs/tasks/asks/E364.md`.
- Its own SFX (MOSS + Stable Audio) and a wind ambience; a ground creature to GUST off an edge.
