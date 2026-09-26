# A2 · gate-look — dome B's loops 1–3 in the engine (E169, 2026-09-26)

The nine A2 cameras (`../cameras.json`, anchor (6.05, +125, −20), 4.5 m before the paifang's centre bay), shot in the
engine with `scratchpad/eight/cap8.mjs` (`cams2views.py A2-gate-look`) on dome B's private snapshot (vite `:5263`), plus
the spawn with the HUD (`scratchpad/domeb/capeng.mjs`). Targets: `../target-1…9.jpg` (imagined from mockup A).

| Folder | What |
|---|---|
| `../loop-1/` | the engine as dome B found it: `capture-1…9.jpg`, `pairs-{a,b,c}.jpg` (capture \| target per view) |
| `../loop-2/` | after fixes 1–4 below; `eye-check.jpg` (loop 1 · loop 2 · target for 4, 6, 5, 3, 7; the spawn prev · now · style-A) |
| `loop-3/` (here) | after fixes 5–6; `eye-check.jpg` (loop 2 · loop 3 · target for 6, 7, aerial 2; spawn · style-A) |

## Gaps (loop 1)

- 4 (left) and 6 (right) were blocked by the gate's lion pair: a pedestal and a faceted TRELLIS lion 2.5 m from the
  anchor fill both frames. Neither style-A nor any A2 target has lions before the gate.
- 6, 7, 8: walkers and umbrellas right at the camera (a TRELLIS umbrella 1 m away fills a third of 7).
- 6: target 6 is the banyan with the lit shrine, mahjong players and the steaming stall at 6–10 m; the engine showed
  walkers and the lion.
- 5: target 5 has lanterns in the passage at head-and-a-half height; the engine's hung only at 8–9 m.
- 2, 3, 9 (aerials): the gate's roofs near-black from above (the engine's light sinks the round-1 tile washes); the
  square sparse against the targets' busy crowd.
- **Not reachable by content**: the targets imagine the gate smaller and further (in 5 the whole gate fits the frame;
  from 4.5 m the engine's 13 m posts can't), and in 1 (pitch 64°) a front view of the gate. Treated as content /
  density references, not geometry.

## Fixes

| # | Fix | File | By eye |
|---|---|---|---|
| 1 | The gate's lion pair and pedestals off (`lions: false`; the post-top lions on the balustrade stay) | `square.ts`, `props3d.ts`, `layout.ts` | 4 and 6 open up: the balustrade, the banyan and the stall show |
| 2 | Crowd: a 2.8 m clear ring round the A2 anchor; the gate, east-strip and south zones 9 / 9 / 10 → 14 each (outside the spawn's open cone) | `square.ts` | 7's umbrella gone; the aerials busier |
| 3 | Glazed tiles brighter teal (`TILE #163234`, rolls `#2c5250`) | `gate.ts` | 2, 3, 9: the roofs read teal from above |
| 4 | Lanterns: a third row on long cords in the centre bay (6.6 m, both faces), one more in each side bay | `gate.ts` | 5: three lanterns in the passage |
| 5 | A mahjong table moved to (11.6, −19.4): ~6 m east of the anchor, before the shrine and the stall, under the banyan's edge | `square.ts` | 6 reads like target 6's structure; in the spawn frame it sits under the banyan at mid-right, as in style-A |
| 6 | Crowd: A2's east (x 8–10.5, z −22.5…−17.5) and south (x 3.5–8.5, z −17.5…−13) foregrounds open | `square.ts` | 6 and 7 keep an empty wet foreground, like their targets |

No reverts.

## For the port lead (colliders.ts)

The two **lion-pedestal boxes** before the gate's centre bay (the `// the lions' pedestals` loop) now have nothing drawn
on them: please drop them (invisible 1.2 × 1.5 m walls otherwise). `walkable()` in layout.ts no longer blocks them.

## Rulers — over budget, not from dome B

| | calls | triangles |
|---|---|---|
| loop 1 | 121–150 | 2.30–2.80 M |
| loop 3 | 128–172 | 2.69–3.20 M (the spawn 3.20 M) |

Dome B's share between loop 1 and 3 is ~+20 k (15 more walkers, 5 lanterns; −16 k the gate lions). The rest came into
the working tree from other lanes during these loops. **The frame is now over the 2.5 M budget in every A2 view.**
