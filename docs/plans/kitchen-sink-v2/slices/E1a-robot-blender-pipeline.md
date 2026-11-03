# E1a: the robot Blender pipeline (rigid parts, baked clips, an exported skin the client admits)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **EB2** (`devmap_robot.py`:
parts, AO, joints, clips, LOD and phone export; "stencils" dropped by ruling 19ab) and the pipeline half of **EB1**
(reference-sheet and detail-list format). Every robot, elite and the Titan is a Blender script (19k; no TRELLIS.2 /
Hunyuan3D-2: hard blocks come back rounded).

## 1. The showcase piece

A **test robot** (a two-part crate on legs, the Mite's proportions) built by the new library, walking, telegraphing,
attacking, taking a hit and breaking into blocks in the Model Explorer and on a post in the calibration pen. It proves
the path every later robot uses.

## 2. Engine / game / host work, just in time

Research:

- **Blender is a pipeline already** (`scripts/blender/README.md`): `build.sh <target>`, `targets.json` (Blender 5.2.1
  pinned, the model lock for Cycles targets), shared `lib/` (`glb.py` minimal glTF writer, `export-scene.mjs`,
  `glb-digest.mjs` for `--check`). Targets today are terrain, trees, crags, the cave, weapons, first-person arms and
  the roc *repair* (`far-reach/roc`: a Hunyuan3D mesh cleaned in Blender). **No creature with joints and clips is built
  in Blender** (`scripts/blender/far-reach-roc/` is empty).
- **The client already plays exported skins** (SHARD-PLATFORM SF9c): `src/game/shardfile/skinPlayback.ts` admits a GLB
  (geometry, joint order, weights, inverse binds, sampled clips) against a rig row (`skins.json`), binds it with the
  engine's `bindRig` and plays named clips through one `AnimMachine` / `AnimationMixer`. Its producer today is the SDK
  bake export of a *procedural* creature (`@wildshard/sdk/bake/export`); users are the three templates
  (`src/shards/_template/generators/product.ts`, `pastel-plain`, `ink-cel-valley`), read by
  `src/game/shardfile/clientSkins.ts`.
- The showcase starts from `src/shards/_template/`, so its creatures already go through exported skins: a Blender-made
  GLB only has to match the same rig row.

Work:

| Piece | Shape | Layer |
|---|---|---|
| `scripts/blender/lib/robot.py` | parts from a spec (chamfered boxes, cylinders, rotor discs), each part 100 % on one bone (rigid), vertex colour + baked AO into `COLOR_0.a`, palette slots (body, trim, eyes emissive), keyframed clips `idle, move, telegraph, attack.*, hit, death` (death = parts break off and drop), LOD0 / phone / LOD1 by decimating per part | scripts (Python), shared by every robot |
| rig row writer | the script emits the `skins.json` row (joint order, clip names, bounds) beside the GLB, so the client admits it unchanged | scripts + the SDK's skin row schema (`format/skinData.ts`) |
| target rows | `showcase-template/robot-test` in `targets.json`; `--check` compares structure and counts | scripts |
| budget | per robot ≤ 3 MB download, all robots + palettes + elites + Titan ≤ 25 MB GPU (enemies plan §3); a check in the target's `post` | scripts |

No engine or game change is expected; if `bindRig` refuses a rigid (single-influence) skin, the fix is in the SDK skin
schema, documented here first. Guards: the storage policy (GLBs committed, `.blend` never, ≤ 1 MB per blob), the
`repo-size` check. Tests: `build.sh --check showcase-template/robot-test`; extend `test/` skin admission tests with a
rigid-skin fixture.

## 3. Other shards in this slice

None. The exported-skin host is unchanged; the three templates' baked skins are re-admitted by their existing tests
(`wildshard validate` on `_template`, `pastel-plain`, `ink-cel-valley`).

## 4. Done when, hours, blockers

**Done when:** `build.sh showcase-template/robot-test` builds headless under the model lock, `--check` passes, the
robot plays all six clips in the Model Explorer and the pen, its GLB is ≤ 1 MB, and the library is documented in
`scripts/blender/README.md`.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Opus: the library and its look) | 2 h | 2 h | **18 h** |

**Blockers:** W0a (the product). Independent of E0: it can start on day one.

## 5. Risks

- Rigid skinning with many bones per robot (the Titan: one bone per crate, ~40) must stay under the phone's bone
  uniform limit; the Titan may need two skinned meshes (E12f).

## 6. Questions for Jake

1. **The robot look.** (a) the polished toy look of the round-11 remaster (rounded chamfers, orange and grey, cyan
   eyes by day, amber at night, baked AO, no stencils); (b) flatter low-poly with no AO. **Recommended (a):** it is
   ruling 19ab's look; the test robot goes to you as a spin clip with a versus board against the E1 mockup first.
