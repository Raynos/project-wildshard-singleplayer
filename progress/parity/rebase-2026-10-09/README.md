# Parity rebase 2026-10-09: every red on HEAD explained, only the explained re-recorded (SHARD-PLATFORM, E435)
## Completion (2026-10-09, sp-x2)

The two leaks are fixed and all four remaining M5 records are landed: Nalati `513b95f14`, Signal `ca8e97149`, Pine `ac9d055a1`, Nine `a12e1a3db`. Three captures per tier are green; every old-to-new red is classified. [Completed record receipt](recorded-f983de200/README.md) covers the commits after the original pin and the latest Signal species extraction. [Leak proof](leak-fixes/README.md) has five zero-leak unloads each, boot smoke and the full clean suite. The original triage below is retained as dated evidence; its render-target and RNG hypotheses are corrected by those receipts.


Lane `parity-rebase`. Parity run on `77772d696` (then HEAD; M5, phone + desktop, all seven shards,
`node scripts/parity.mjs --export=77772d696… --lane=m5 --shards=all --tiers=phone,desktop --jobs=1 --retry=0`),
every red field diffed against its baseline, and each one bisected to a commit by running the harness on cached builds
of earlier commits (`--url=` a preview of the parity build cache's tree for that commit; same harness, fixtures and
Developer fixture). Baselines compared: `_template`, Sky Reach, Nalati, Nine at `ca969df25`; Pine at `7d731563a`;
Driftwood at `16728f1c6` (= `780f71006` + an SF50 grid-only change); Signal Dunes at `bfb9dc325`.

## Verdict per shard

| Shard | Reds on `77772d696` | Verdict |
|---|---|---|
| `driftwood-isle` | none (both tiers green) | nothing to record |
| `_template` | mesh +1, programs +1, `programKeys`; phone `current` SSIM .947 | all explained + intended → **re-recorded** |
| `far-reach` (Sky Reach) | colliders +40, registry, instanced / instances, `scene.named`, `programKeys`, buffers +4.5 KB, pose calls +1 / tris +480 | all explained + intended → **re-recorded** |
| `nalati-grasslands` | `boot.saves.read` / `boot.saves.written` / `combat.loot.written` | all explained + intended → **re-recorded `513b95f14`** |
| `sunscar-dunes` (Signal) | mesh, instanced, geometries, programs, textures, buffers, pose calls / tris, `systems.update` | all explained + intended → **re-recorded `ca8e97149`** |
| `nine-dragon-stack` | phone pose SSIM ×3 (minimap only); phone `leak.programs` 1 (intermittent) | leak fixed and proved → **re-recorded `a12e1a3db`** |
| `pine-hollow` | colliders −4, registry, buffers −64 B, desktop instances −1, gate tris; walk `lookout-climb` end ±1 cm; phone `combat.sounds.ambient`; phone `leak.textures` / `leak.weather.textures` | leak fixed; side effects explained → **re-recorded `ac9d055a1`** |

## Explained and intended

| Field(s) | Shard / tier | Commit | Evidence |
|---|---|---|---|
| `scene.totals.mesh` 180 → 181, `programs` 35 → 36, `programKeys` | template, both | `80299e0bf` (playtest round 3) | adds the lit lantern's band: one `Mesh` with its own `MeshBasicMaterial`, hidden until lit (`src/kit/items/declared.ts`) |
| `poses.current.ssim` .947 | template phone | `80299e0bf` | the same commit pulls a held item into 70 % of the portrait half-frame (`keepInFrame`); the diff is the held items only |
| colliders 1216 → 1256, registry `far.islet.rails` (40 cuboids), +1 instanced / +40 instances, +1 draw / +480 tris at spawn / hover | Sky Reach, both | `2a432fe48` (grid-interact, playtest round 3 #8) | the Rising Islet's timber rail, static colliders, drawn at rest |
| `scene.named` (`far.step.winch-house` 14 named meshes → 13 kinds), +13 instanced / +14 instances, `programKeys` | Sky Reach, both | `8942c04ec` (SF72 winch-house bake) | "14 meshes as 13 instanced kinds"; together with the rail: instanced 54 → 68, instances 11219 → 11273 exactly |
| `boot.saves.read` + profile, `boot.saves.written` + `nalati-grasslands`, `combat.loot.written` + profile | Nalati, both | `28fe9f479` + `a4ffb1c2d` (SF48-p) | declared runtime state migrates the shard slot once at boot; feats go to the platform ledger (profile scope). The same three keys as Pine's accepted `627c5edaf` refresh (`8504456fe`) and Driftwood's `3e995e5a2` |
| `gpuBytes.textures` −17,360,704 B phone / −64,731,648 B desktop, `memory.textures` −1 | Signal, both | `1f84c55dc` (E451 Memory saver on in Developer) | byte-identical to the template's saver delta in `eb19cbc58`; present already at `23bc7cff1` |
| `systems.update` + `sunscar.ray` | Signal, both | `e9c0c5945` / `0f30825c9` (SF50-p runtime binds) | as the 2026-10-08 triage; present at `23bc7cff1` |
| mesh 391 → 390, instanced −1, geometries −1, buffers −960 B | Signal | `c075fbb21` (rock bake) | measured at `c075fbb21` |
| mesh → 384, instanced −6, programs −1, geometries −6, buffers −59 KB | Signal | `ee786f9ed` (dressing bake) | measured at `ee786f9ed` |
| mesh → 265, instanced 10 → 18, instances 123 → 250, programs +1, geometries → 111, buffers −91 KB; draws spawn 192 → 73, ray 195 → 76, quest 157 → 58 (phone), 254 → 135 / 255 → 136 / 203 → 94 (desktop) | Signal | `7757f1119` (tower bake: 127 meshes → 8 instanced kinds) | measured at `7757f1119`; `dddb490ed` (its parent) still has the baseline's poses |
| phone `whip` draws 68 → 70, tris +1,332; `quest` tris +240 phone / +120 desktop | Signal | `7757f1119` | measured: absent at `dddb490ed`, present at `7757f1119`. An instanced kind is culled as one bounding volume, so a kind partly in view draws all of its instances; pixels unchanged (the commit's own pose check) |
| mesh → 218, instanced → 25, instances → 247, programs → 56, geometries → 97, buffers −10.6 KB; desktop whip 151 → 137, ray 136 → 138 (+48 tris) | Signal | `a9af86395` (places bake) | measured at `c858738f7` (parent) vs `a9af86395`; GPU totals equal HEAD's to the byte, as the commit states |
| mesh 218 → 213 | Signal | `208d6e262` | the tower brazier's code stand-in (facet brazier, post, bowl, kindling) removed; draws unchanged |
| quest chip "Light the signal fire" → "Light signal fire" (pose pixels, HUD) | Signal | `40aa26ece` (SF50) | the chip fits the format's 18-character cap |
| phone poses `spawn-rail` .984, `well-edge` .984, `stair-street` .982 | Nine phone | `f9a2e7493` (G252 Nine's baked map B, stylized) / `fce37c222` (map rebake) | the diff images are black but the minimap disc |
| colliders 2421 → 2417, registry, buffers −64 B, desktop instances −1, gate tris −1,270 / −23,054 | Pine, both | `77772d696` (SF72 entry canyons) | the four lane-blocking solids leave; at `8c4271064` (its parent) none of these fields is red |

## Originally observed bugs (fixed / explained in the completion receipts)

| Field | Shard / tier | Commit | Evidence |
|---|---|---|---|
| `leak.textures` 1, `leak.weather.textures` 1 | Pine phone | `4b2089fc8` (SF57 leak5) | 0/1 at `3ec15683b` (its parent); 1/1 at `4b2089fc8`, `8c4271064`; 2/2 at `77772d696`. One GL texture outlives the unload (`renderer.info.memory.textures` − retained = 1; the leak census' `gpu.total.textures` 25 vs retained 24). The baseline's one non-retained level-owned 1024×640 render-target entry is gone from the resource list while the GL count keeps one: consistent with leak5's "a render target releases its attachments" dropping the attachment from the census without `deleteTexture` reaching GL |
| `leak.programs` 1 (intermittent) | Nine phone | `4b2089fc8` (SF57 leak5) | 0/3 at `3ec15683b`; after it 1/2 at `4b2089fc8`, 1/1 `bb6d93f69`, 0/2 `3d68396a2`, 1/2 `9fbd06be4`, 2/3 `77772d696`. GC-timed: leak5 makes unowned uploads weakly held, released only at finalization, so the unload census sometimes still counts one program |
| `walk.legs.lookout-climb.end` / `maxY` ±1 cm (34.916 ↔ 34.926, 211.286 ↔ 211.28, 57.478 ↔ 57.48) | Pine, both | `77772d696` | at `8c4271064` both tiers match the baseline (unchanged since `cea89b855`); on `77772d696` desktop lands on the phone's old end (2/2) and phone flips between the two (1 of 2). Removing four colliders ~200 m away re-orders Rapier's collider set, and the climb's contact resolution has two end states. Unclaimed by the commit; the walk itself is fine (0 stuck) |
| `combat.sounds.ambient` loses `pineLife.drum` | Pine phone | `77772d696` | green at `8c4271064`; the ambient schedulers' seeded timings shift with the physics change, so no drum lands in the combat window. Unclaimed side effect |

The two `77772d696` side effects were subsequently source-checked and measured in the completion receipt. Pine is now re-recorded with its actual three-run spread; no artificial contact or audio tolerance was added.

## Original handoff (completed, 2026-10-09)

- Re-record Nalati and Signal Dunes on M5 from `77772d696` (every red explained above):
  `node scripts/parity.mjs --record --runs=3 --lane=m5 --shards=<slug> --tiers=phone,desktop --export=77772d6969a3f9ec52ba63f476b7d9aec3803b2a --jobs=1 --retry=0 --timeout=400`
  (`--url=` a self-started preview of the cached tree if `vite preview` misses its 30 s deadline). Check that old → new
  moves only the fields in the table. The working tree's `test/parity/baselines/m5/meta.json` holds another lane's
  uncommitted edit; leave it out of these commits.
- Fix the two `4b2089fc8` leaks, then decide whether to accept Pine's two `77772d696` side effects and re-record Pine.
- Nine needs no re-record for its baseline fields beyond the minimap SSIMs; re-record it once its leak is fixed.

## Not covered here

- The gh-macos15 (CI runner) phone baselines: recorded only by a `gpu-gate` record dispatch on a pushed SHA
  (`gh workflow run gpu-gate -f record=true -f sha=<sha>`), left to the coordinator.
- The completed receipt now covers the commits after `77772d696` on the `f983de200` record pin; Signal's later `741b37a06` species extraction also passes a fresh both-tier comparison on `306f6e958`.
