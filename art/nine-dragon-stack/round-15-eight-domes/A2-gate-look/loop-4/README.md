# A2 · gate-look — dome B's loop 4 (E169, 2026-09-26): the triangle freeze

`eye-check.jpg`: loop 3 · loop 4 · target for views 9, 5, 2; the spawn loop 3 · loop 4 · style-A.

## 1. The crowd: culled per figure, a far LOD (`world/crowd.ts` `Crowd`, wired in `world/build.ts`)

The crowd was one InstancedMesh per variant over the whole fragment (~700 figures × ~1.4 k tris ≈ 1.0 M tris static,
~550 k in a rendered frame), never culled. `Crowd` keeps one InstancedMesh per variant and level and rewrites its
instances when the camera moves: only the figures inside the view frustum, full detail inside 35 m, a vertex-clustered
copy (≤ 320 tris, every attribute kept, so the same program draws it) to 130 m, none past (the silk fog has them).
Its meshes start empty, so the port lead's InstanceCuller leaves them alone. Crowd in a frame: **~550 k → 24–69 k tris**,
4–7 draws (a level with no figure in view is hidden and costs no call). By eye the frames are unchanged (loop 3 → 4).

## 2. A capture bug for every dome (fixed in dome B's scripts, relayed)

Since the per-instance cullers landed, a POSED capture culls with the PARKED PLAYER's camera: the engine re-syncs the
camera to the player in the update phase, the cullers run there, the late hook poses it afterwards. Lanterns, facade
dressing and the crowd went missing wherever the parked player wasn't looking (measured: the crowd picked figures
behind the posed camera). Fix: aim the parked player the way the pose looks (`player.position` = eye − 1.62,
`yaw = atan2(−dx, −dz)`, `pitch = asin(dy / L)`): `scratchpad/domeb/cap8b.mjs`, `capeng.mjs`, `lane.mjs`.
Also: the spawn's "rifle" was dome B's capeng.mjs showing every camera child (a hidden AR-15); it now restores exactly
what it hid — the Neon Jian shows.

## 3. Dome B's lane: triangles and draws in a rendered frame (`scratchpad/domeb/lane.mjs`, per named group, all passes)

| Group | spawn | A2-3 (aerial SE) | A2-5 (north) | A2-6 (banyan) | A2-9 (aerial N) |
|---|---|---|---|---|---|
| crowd | 69 k / 6 | 69 k / 6 | 34 k / 4 | 24 k / 7 | 37 k / 6 |
| canopy (cards + core) | 67 k / 2 | 67 k / 2 | 67 k / 2 | 67 k / 2 | 67 k / 2 |
| kit:paifang | 59 k / 1 | 59 k / 1 | 59 k / 1 | 59 k / 1 | 59 k / 1 |
| props3d (lions, pots, lantern trios) | 53 k / 2 | 53 k / 2 | 40 k / 1 | 53 k / 2 | 53 k / 2 |
| kit:banyan | 32 k / 1 | 32 k / 1 | 32 k / 1 | 32 k / 1 | 32 k / 1 |
| kit:props (balustrade, tables, lamps) | 18 k / 1 | 18 k / 1 | 18 k / 1 | 18 k / 1 | 18 k / 1 |
| kit:stall + strings + masts + plaza | 9 k / 4 | 9 k / 4 | 2 k / 3 | 9 k / 4 | 9 k / 4 |
| **dome B total** | **307 k / 17** | **307 k / 17** | **252 k / 13** | **262 k / 18** | **275 k / 17** |
| whole frame | 1.36 M / 160 | 1.39 M / 171 | 1.07 M / 147 | 1.10 M / 158 | 1.27 M / 172 |

(The shared paper-lantern batch, 5–25 k, is the look lane's; dome B hangs part of its lanterns.)
Next lever if needed: the TRELLIS lions are 8 k tris each × 9 (72 k static): a clustered far copy would save ~40 k.
