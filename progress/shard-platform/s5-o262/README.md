# S5: Sky Reach and Signal Dunes `world/`, the decision table (sp-o262, 2026-10-16)

Row S5 of the shardfile design (`progress/shard-platform/shardfile-design-2026-10-15/README.md` §6): Opus picks,
Codex moves. Lines are the ruler's counted lines (G445 source ruler, `codeLines`: nonblank, comments removed) on
`6d9ec412a`, measured in the build mirror: **Sky `world/` 307, Signal `world/` 177**.

Verdicts:
- **build** = the work moves to build time: a generator writes the data the runtime reads (honest, precedent
  `1c125707c`).
- **host** = the code moves onto a platform host that another shard already uses, or that Nalati / Nine has real
  matching code for (G441, registered in `lint/platform-pending-users.json` and the W3 table).
- **stays** = genuinely shard-specific runtime presentation or gameplay; S1 / S2 move it into `runtime/` (no number
  change on the output ruler, G450).

Rules held: no hand-written JSON (G448), no new imports from `runtime/` into other shard folders (G449), moving code to
another shard file isn't a cut.

## Sky Reach (`src/shards/far-reach/world/`, 307)

| File | Lines | Verdict | Host or section | Reason | Est. cut |
|---|---:|---|---|---|---:|
| `shack.ts` | 4 | **build** | `generators/shackKit.ts` writes `look: 'shack-<kind>'` on each baked kind row | the runtime only maps a kind name to a look id, which is known at bake time | -4 (file deleted) |
| `dressing.ts` | 8 | **build** | `generators/dressing.ts` writes `look` (from `data/dressingLook.ts`) on each kind row; `heroStoneDiscs` here is dead (the generator has its own) | same: a name → look lookup known at bake time | -8 (file deleted) |
| `baked.ts` | 27 | **build** (partial) | kind rows carry `look`; the material hook becomes one `look` lookup plus the islands' paint fallback | the SHACK list, `shackKind` and the dressing branch go | -6 |
| `materials.ts` | 7 | **build** | `PALETTE` + `flat` → `generators/palette.ts` (only generators read them once the route materials are declared) | rope rails, the hover glass and the Explorer kit become declared `standard` materials in the route scene (the vane scene already does this) | -7 (file deleted) |
| `shapes.ts` | 25 | **build** (partial), then **host** | route scene materials declared at build (`generators/routeScene.ts`); later `routeScenePorts` → a ModelLibrary scene-ports host (see below) | `bridgeKit` loses its two code-built materials; the `rails` port goes | -3 now, -8 more with the host |
| `build.ts` | 119 | **build** (partial), rest **stays** | rope / hover-glass materials leave (declared); the hover deck is read back with `routes.standardMaterial('glass')` | the remaining body is ordered orchestration over shared hosts (`createWorldScene`, `bindWorldSceneParts`, `bindClientChannels`, `createQuestPagePrompts`, `WORLD.placements`) | -3 now; -12 more with the scene-ports host (static-scene material loop, `bookStand`) |
| `crown.ts` | 16 | **host** (Codex) | ModelLibrary scene ports: painted-model rows `{id, model, look}` → geometry + material ports (`hdMaterial` or `mappedLook`) | crown, mill, `bookStand`, `routeScenePorts` and the static-scene loop all hand-resolve painted models into scene ports; one SDK helper on `createModelLibrary` replaces all five. Second user: Signal `places.ts` (geometry / model / bake ports over `DUNE_LIBRARY`) | -10 |
| `mill.ts` | 13 | **host** (Codex) | same scene-ports host | same | -6 |
| `meshes.ts` | 19 | **stays** | `createModelLibrary` (already shared) | two library configs over generated rows; nothing left to cut but the wrappers (`skyHd`, `hdMaterial`) that the scene-ports host absorbs | -3 with the host |
| `isle.ts` | 21 | **stays** | `GeometryPack` (already shared) | moving islets decode from the islands' pack; tile adoption is Sky's own | 0 |
| `meadow.ts` | 25 | **stays** | none | Sky-only chunked LOD blade field over its own byte layout; no second user (Pine / Nalati grass differ) | 0 |
| `storm.ts` | 23 | **stays** | none | live lightning schedule on the play clock with the `strike()` capture API; Nalati's `bossStorm` is a boss attack, not a sky effect | 0 |
| **Sky total** | **307** | | | | **-31 now (this lane); -39 more with the scene-ports host (Codex)** |

## Signal Dunes (`src/shards/sunscar-dunes/world/`, 177)

| File | Lines | Verdict | Host or section | Reason | Est. cut |
|---|---:|---|---|---|---:|
| `baked.ts` | 10 | **build** (partial) | the brazier collider rows are written by the bake as placement rows (Sky's `physicsPlacements.generated.json` pattern) | the `.map` that renames brazier colliders is a build-time fact | -2 |
| `build.ts` | 84 | **stays** (mostly) | quest pages, interaction rules, client channels (all shared already); the waymark / lantern lights already stand on the engine's `SiteLights` (shared with Pine's `buildingLife.ts`) | the rest is Signal's quest wiring (oil, crack, well, signal fire); a `SiteLights` row helper would save ~6 lines but Pine adds lamps one by one, so there is no matching second user today | 0 |
| `fireFx.ts` | 40 | **stays** | already on SDK `cardGroup` / `effectField` | the four-slot `FIRE_LIGHTS` uniform and fire-clock binding are Signal-only | 0 |
| `places.ts` | 29 | **host** (Codex) | the ModelLibrary scene-ports host (geometry / model / bake ports) | it is the host's second user; the effect-anchor loop stays | -4 |
| `meshes.ts` | 14 | **stays** | `createModelLibrary` + `applySurfaceLooks` (shared) | three thin configs | 0 |
| **Signal total** | **177** | | | | **-6 (Codex)** |

## Why not more

Both `world/` folders were already thinned by SF72 / SF49 / G395: what is left is (a) the glue that hands a shard's
own materials to shared scene hosts, which build time and one SDK helper can absorb, and (b) live presentation with
no second user (meadow blades, storm, fire light slots, Signal's quest wiring). (b) stays, and moves into `runtime/`
in S1 / S2. Sky's and Signal's last points toward 10 % come from the rewire (S1 / S2: data as sections) and the look
graphs (S4), not from `world/`.

## Landed (this lane)

- `3d40d964b` refactor(sky): declare route materials at build (+ the coordinator's `ef1b80191`, the missed
  `sky-route-scene` input root for `generators/palette.ts`). Rope rails, hover glass and the Explorer kit deck are
  declared `standard` materials in the route scenes; `world/materials.ts` → `generators/palette.ts`; the private-scene
  format gains `emissiveIntensity`; dead `heroStoneDiscs` deleted. **Sky `world/` 307 → 291 (-16)**, Signal unchanged
  (mirror, `e4a6c4a61` → `ef1b80191`; Sky's whole-shard 6,243 → 6,075 also carries other lanes' look-graph commits in
  that range). Focused tests (8 files, 36) and `tsc` green in the mirror after a cold `pnpm gen`.
- Proof (iPhone 16 Pro portrait, muted): `route-materials-aerial-spawn.jpg`, `route-materials-h2-windmill.jpg`. Same
  draws (155) and triangles (1,649,971) before and after; no visible change.

**Stopped by G452** (2026-10-16): every lane works W2 until it closes; the rest of S5 (below) becomes a W1-spike row.

## The Codex remainder (mechanical, in this order)

1. **Baked kind looks at bake time (Sky, -18).** `generators/shackKit.ts` sets `material.userData['look'] =
   'shack-<kind>'` (and keeps `ShackKind` as its own type); `generators/dressing.ts` `extra` writes
   `look: DRESSING_LOOKS[material.name]` beside `dressing`. Rerun `node scripts/generate.mjs --job=sky-world`
   (native; outputs `data/*.json` + `baked/*.glb`, check the GLB hashes do not move) **after sp-o259's S4 sky-world
   changes land**, then in `world/baked.ts` the material hook becomes `'look' in kind && typeof kind.look === 'string'
   ? SKY_LIBRARY.look(kind.look) : 'paint' in kind ? isleMaterial() : undefined`; delete `world/shack.ts`,
   `world/dressing.ts`, `SHACK` / `shackKind`. Before / after pair on h1-sunrest and h2-windmill (shacks, dressing).
2. **ModelLibrary scene ports (Sky -39, Signal -4).** One SDK helper beside `createModelLibrary`
   (`@wildshard/sdk/looks/modelLibrary`): `scenePorts(rows, { baked, painted?, looks? })` returning `WorldScenePorts`,
   where a painted row `{ id, model, look | null }` resolves geometry `id` → `painted(model).geometry` and material
   `id` → `look === null ? matte map material : mappedLook(look, map)`, plus `geometry` / `model` / `baked` from the
   library. Generators emit the rows (`crownScene.ts` already does; `millScene.ts`, `restScene.ts` books, the static
   scene's `look:name` ports, `routeScene.ts` `post-hd`). Users: Sky `crown.ts`, `mill.ts`, `build.ts` `bookStand`
   and the static-scene material loop, `shapes.ts` `routeScenePorts`; Signal `places.ts` (geometry / model / bake
   ports). Keep each scene's `missing` behaviour (undrawn until every model is ready). Pair: aerial-spawn,
   h4-crown, h2-windmill.
3. **Signal brazier colliders (-2).** The Signal world bake emits the brazier collider rows as placement rows; the
   `.map` in `world/baked.ts` goes.
4. **S1 / S2 moves** (no number change): the files marked **stays** move into `runtime/world/` with the rest of the
   play code.
