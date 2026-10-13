# GPU parity re-baseline, 2026-10-13 (sp-o85, SHARD-PLATFORM, E435)

Review `docs/reviews/shardfile-48h-review-2026-10-12.md` §5 item 10: a parity baseline moves only once every
red field is named to the commit that changed it. This lane measured every red field of the seven primary shards
on the **m5** lane, attributed what it could by bisecting `scripts/parity.mjs` captures, and re-recorded **only
`_template`**. Every one of its red fields traces to a landed decision. No source changed.

**Fixed HEAD:** `6c9c810e7d990719eb66a8e5a995577d78a73e66`. Every capture is a `scripts/serve-build.sh --rev` build of an
exact SHA (`/version.json` checked before each run). Captures were muted Chromium/ANGLE Metal, phone tier (390×844 @3)
and desktop tier (1600×900), one browser, through `scripts/browser-lane.sh`.

## Method

1. A compare capture on HEAD, all 7 shards × 2 tiers: **195 red fields**.
2. The same on `230a36644`, the gh-macos15 record SHA of `431c648cc` / `74ee614cf`. This splits each field into
   "moved before 230a" and "moved in 230a..HEAD".
3. Captures on both sides of each suspected decision, `--only=fingerprint+poses` or `walk+combat+leak`:
   - `d3704c31e` / `195597049` (G271, Memory saver off)
   - `28f5bd545` / `f9fe9e81e` (receiver-plane PCF shadow bias, default on)
   - `490e9eea4` / `2beae6f27` (G325, AudioContext on the first gesture)
4. `git rev-list --bisect` where neither side of a decision held the change.

## `_template`: re-recorded on m5 (both tiers)

The m5 baseline was recorded on `77772d696`. Captures on `230a36644` and on HEAD are equal on every structural field.

| Tier | Field | Old → new | First commit (measured) | Decision |
|---|---|---|---|---|
| phone | `boot.render.memory.textures` | 30 → 31 | `195597049` (`d3704c31e` = old) | G271: Memory saver off by default (Jake) |
| phone | `boot.gpuBytes.textures`, `.total` | +17,360,704 | `195597049` | G271: bloom 7,899,840 + composer depth 5,266,560 + 1024² shadow colour 4,194,304 |
| desktop | `boot.render.memory.textures` | 42 → 43 | `195597049` | G271 |
| desktop | `boot.gpuBytes.textures`, `.total` | +64,731,648 | `195597049` | G271 (desktop-size targets) |
| both | `boot.render.programKeys` | hash | `f9fe9e81e` (`28f5bd545` = old) | Receiver-plane PCF shadow bias; Jake picked NEW (`c71039878`) |
| phone | `walk.sounds.event` | −`music.padVoice`, −2 `music.bell`, −`music.bass`, −`music.drum` | **`50815594a`** (bisected; `5cfcc2cae` = old) | SF67 (E461): the template's **silent** score no longer builds the AudioContext in its play task; per the commit, "what is heard is unchanged" |

**Correction to look48 (`progress/shard-platform/look48/README.md`).** It put the template's missing music events
on G325. Measured, G325 (`2beae6f27`) changes no template, Nine or Nalati sound field: the events are already gone on
its parent `490e9eea4`. The template's change is `50815594a`. Nine's and Nalati's sound changes come after `2beae6f27`
(see below).

**Recording:** official CLI, `node scripts/parity.mjs --url=<HEAD build> --record --runs=3 --lane=m5
--shards=_template --tiers=phone,desktop --jobs=1 --retry=0` with `SHA=6c9c810e7…`. The three runs pass the
self-consistency gate.

## Not re-recorded: open fields per shard

"Window" is where the field moved, measured. A window is not a verdict. Nothing below is accepted.

| Shard | Fields attributed (measured) | Open fields and their measured window |
|---|---|---|
| Driftwood | textures +7,899,840 and renderbuffers +5,266,560 (phone), desktop textures +1: G271 `195597049`. Buffers −3,600: before `d3704c31e` (G261 ramps, per look48) | **Buffers +486 B**: `f9fe9e81e..230a36644`. **Desktop** programs 109→108, textures 115→116, textures −23,039,980 B, renderbuffers −5,760,000, a second programKeys change: `f9fe9e81e..230a36644`. Registry, pier walk end, `systems.update`, pose tris: look48 (G261, `99ecc7bcd`), not re-measured. Walk/combat sounds and ambient: not G325 (see Nine) |
| Pine | phone and desktop textures +3 / +20,156,960 / +75,916,456: G271. programKeys: `f9fe9e81e` | **Desktop** programs −1, textures +1, −23,050,732 B, renderbuffers −5,760,000, buffers −5,071,700, pose calls/tris, second programKeys: `f9fe9e81e..230a36644`. Walk/combat sounds, `forest.thrall` ambient gone: not bisected |
| Nalati | textures +1,048,576 / +50,331,648, mesh +1 and `scene.named` (eager kurgan interior): G271 | **programKeys, second change** on both tiers: `f9fe9e81e..230a36644`. **Sounds**: steppe beds leave the walk, all ambient gone (`steppe.eagle/herd/marmot`): `2beae6f27..230a36644` |
| Nine | textures +1 / +9,460,864 / +56,091,648: G271 | **Sounds**: walk `footstep:rock` 2 → 98 beside `nd.step.stone` 98, combat `+footstep:metal`, `nd.hum.lantern` and both beds gone from ambient: `2beae6f27..230a36644` (bisect in the follow-up below). **Desktop** programs −1, textures +1, renderbuffers −5,760,000, pose calls/tris −2: `f9fe9e81e..230a36644` |
| Sky Reach | phone textures +1 / +17,360,704 from baseline → 230a (G271, the same bytes as the template) | Moved before 230a: mesh 326→321, instanced 68→99, instances, programs 107→104, geometries 233→230, buffers +24,024, `scene.named`. Moved in `230a..HEAD` (the live Sky port): mesh →309, instanced →88, programs →99, textures −1 / −5,592,404 B, **walk legs `windmill` end (6.6 cm) and `grove` end/maxY**, `systems.update`, pose calls/tris |
| Signal Dunes | textures +1 / +17,360,704 (phone) | Moved before 230a: mesh 213→260, geometries 97→138, buffers −2,764,104, programKeys. Moved in `230a..HEAD` (the live Signal port): mesh →226, instanced 25→34, instances 247→280, geometries →114. **All 8 pose SSIMs 0.88–0.98, pose positions** |

The repeating desktop-only change (programs −1, renderbuffers −5,760,000 = 1600×900×4, one more texture) is in
Driftwood, Pine and Nine. It looks like one commit in `f9fe9e81e..230a36644`. It was not bisected here (time cap).

## CI baselines (gh-macos15)

`--record` writes only the lane it records (`test/parity/baselines/m5/`). `--rebaseline` and `--accept` also **delete**
that shard's gh-macos15 files (`scripts/parity.mjs`, by design: the runner then bootstraps its own). Template's
gh-macos15 baseline was re-recorded on `230a36644` by `431c648cc`. HEAD equals `230a36644` on every template field on
m5, so it is kept, not deleted. `m5/meta.json` (the lane stamp the record rewrites) is left at its committed value,
as earlier per-shard re-records left it.
