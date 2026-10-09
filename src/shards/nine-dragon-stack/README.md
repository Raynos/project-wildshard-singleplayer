# Nine Dragon Stack (`nine-dragon-stack`)

Lantern Square, halfway up a city stacked 500 m high: wet granite, a cinnabar gate, neon calligraphy and the Yamen
Well dropping away into silk fog. A prototype fragment: the square, the Well's rim and the stair-street. Chongqing
meets Kowloon Walled City (E169). Fourth card on the title deck.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 4 |
| `style`, `kitLook` | `jiehua`, `pbr` (kit pieces render PBR) |
| `uses` | `hover`, `explore`, `practice` |
| `ground` | `structures: true` plus a placement-only terrain: the world is built floors on colliders; nothing draws or collides with the terrain |
| `bounds` | a box round the square, the Well and the stair-street; below `floor` the player is put back on the last floor |
| `loadout` | the jian and the hoverboard; Fei Zhua (the grapple) is a tool |
| `species`, `encounters` | none: no creatures yet. The gate's combat check kills a practice-arena dummy |
| `fight` | buffer 120 ms, coyote 100 ms; unlimited attackers |
| `bag` | MAP · GEAR; no pack |
| `tiers` | phone: no AO, no slices, FXAA, no warm turns, plain image textures; desktop: AO |
| `audio` | its own ambience and score (S1.5); the forest bed's shrine and island sounds omitted |
| `assetGlobs`, `ktx2` | `public/assets/nine-dragon/**` and its KTX2, music, SFX and title folders; `ktx2.generated.ts` |

## Its custom code, and why

| Folder / file | What | Why custom |
|---|---|---|
| `world/` | the built city at run time: the baked layout's restore, the model parts the layout shares (stalls, gate, square / stair / Well parts, movers), the stair and Well plans, banyan and canopy, the crowd, its colliders, culling and LODs | a structure-first world no other shard has |
| `generators/` | the layout, build-time only (G285): the square, the towers and facades, the facade grammar, the stair-street, the Well; `layout.ts` runs them into `public/assets/nine-dragon/baked/layout.bin` (`scripts/bake-nine-layout.mjs`), which `world/layoutBake.ts` restores — the page has no live builders | public: never shipped |
| `grapple/` | `FeiZhua extends Tool` (rung 3): the grapple's line, hook, FX and course | Nine Dragon's own verb; not a mechanism (R1-02) |
| `vm/`, `weapons/` | the jian on the kit `Sword` with its own row, arms, cloth and trail | its own blade and viewmodel |
| `look/` | the Jiehua Neon look: neon signs and glyphs, lanterns, emitters and streaks, the facade material, the light rig, its colour chain (ink silhouette, bleed, window glow, drizzle, the learned LUT, grain) | the jiehua style is Nine Dragon's |
| `playground/` | the grapple course | it needs the grapple |
| `audio/` | its ambience, cues and files | its own sound |

Layout debt (grandfathered): `grapple/`, `vm/`, `mockupCameras.ts`, `places.ts`, `runtime.ts`, `terrain.ts`, `tier.ts`,
`util.ts`. Fragile-boot flags were moved into `boot` (§8 of ENGINE.md).

**Facade multi-draw is banned** (E271 / E272, AGENTS.md): the facades stay instanced. `pnpm test:gpu-boot` runs
`scripts/test-facade-instancing.mjs`, and the gate runs it on this shard's job.

## Budgets

Phone 30 fps (9.6 ms CPU), desktop 60 fps (4.8 ms). No cold-load cap yet (its F2 baseline, rounded up, is shown at M1
for Jake to confirm). F2 ceilings for the poses `spawn-rail`, `well-edge`, `stair-street` in `budgetCeilings.ts`.
Memory: 1.8 GB loading and 1.0 GB in Explore are hard limits on the iPhone.

## Look

Jiehua Neon: the engine's passes stay (the scene pass with the viewmodels in their depth slices, SMAA), and the shard
adds a bleed pyramid before the colour chain and its own composite in place of the engine chain. `look/render.ts`
exposes its live pieces as `window.__wildshard.shard['nd.render']` for captures.

## Open asks

- E169: the shard-4 plan (NINE-DRAGON-STACK), re-planned after GAME-NORMALIZATION.
- E264: the 1.8 GB loading and 1.0 GB Explorer memory caps.
- E281: the mockup-matching look pass (paused on Jake's pick).
- E286: the grappling hook needs a dedicated control (live, needs Jake).
- E197: the teaser card's art loads at the loading bar (needs a pick).
- E217 … E257: the iPhone load and crash asks (in flight).

The ask files in `docs/tasks/asks/` are the truth; this list is a pointer.
