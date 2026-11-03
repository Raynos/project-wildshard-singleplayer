# QA 11-03: Nine Dragon fixed and done, then SHARD-PLATFORM closes

**State:** `open` 2026-11-03 ~09:25 Cancun. Written by wildshard-v for wildshard-new, which hands the rows to lanes and
marks them. Jake, ~09:20: *"Fixing 9 dragon is higher priority than the open plots. I need like a little mini document
for all my QA … I just want 9 dragon to be done and fixed. Want to close shard platform."* (G997). **Every row here
comes before any open-plot work** (OPEN-PLOTS waits behind it), every row blocks the SHARD-PLATFORM archive, and none
goes to the damage list. Visual fixes are Opus-only (G848); the builder decides on the recommended fix and logs it
(G872).

His QA: iPhone 17 Pro portrait Safari home-screen PWA, Developer on, ~07:45–07:55 on live `8057f4f-mw0nkjbk`
(deployed 07:17), Nine Dragon shardfile. Shots in [art/qa-2026-11-03/](../../../art/qa-2026-11-03/).

## Rows

| Row | What Jake saw | Fix / done when | Lane | Size |
|---|---|---|---|---|
| QD1 | **Walls and floors missing** ([shaft](../../../art/qa-2026-11-03/qd1-shaft-floating.jpg), [shaft 2](../../../art/qa-2026-11-03/qd1-shaft-void.jpg), [street](../../../art/qa-2026-11-03/qd1-street-walls.jpg), [street floor](../../../art/qa-2026-11-03/qd1-street-floor.jpg), [ceilings](../../../art/qa-2026-11-03/qd1-shaft-ceilings.jpg)). *"It's really fucking obviously broken … There's just fucking walls and floors missing … a lot of walls and textures and ceilings and floors are just fucking missing … It looks like just fucking half done."* Balconies, awnings, planters, signs and people draw on a flat pale void; the street floor and the walls behind the shopfronts are gone. | (1) Name the culprit: wildshard-v's subagent is bisecting the 11-02 evening Nine / render commits (suspects `43471277fa` sky background off, `97cdd1f933` facade packets, `890dfaf69c` coarse cover, `25130c518a`, `ab77c51ba3`, `e31e8f5672`, `af99979cd0`), Chromium first, then Simulator Safari. (2) Pin live to the last good SHA (`.github/deploy-pin.json`) until the fix lands. (3) Fix forward, no revert (G674). **Done when** QD4's 24 views show no missing wall or floor on WebKit and Jake's next look agrees. | Opus | 2–4 h |
| QD2 | **The overhead train drops the frame rate** ([gate](../../../art/qa-2026-11-03/qd2-train-gate.jpg), 24 fps, max 64 ms). *"Every single time that train moves above us, the FPS tanks down … from 30 FPS to like 15 or 12."* | G996: profile the pass (draws, shadow re-renders, per-frame uploads, mover physics, culling), smallest pixel-identical fix. **Done when** walking under a passing train holds 30 fps, max frame ≤ 45 ms, on the phone tier (Chromium, then one Simulator reading). | Codex (G958) | 2–4 h |
| QD3 | **The wet-ground neon streaks are fake** ([stairs](../../../art/qa-2026-11-03/qd3-stairs-neon.jpg); legacy has them too). *"It's supposed to be the true reflection of real neon above me, but it's just random placeholder."* | G995: the current streaks go. B: streaks anchored to real signs (colour, width, directly below, fading with distance); C: plain wet sheen. One labelled A / B / C board at the stairs and two street spots; the builder rules (G941). Starts after QD1. **Done when** the pick ships. | Opus | 3 h |
| QD4 | **Nine has no golden set.** *"Don't we have golden images of nine dragon? … legacy versus shardfile … like 24 golden images?"* The 11-02 cuts passed Chromium pixel diffs at P1–P5 only. | 12 fixed views (P1–P5, Jake's walkway, the street, the stairs, the gate, more) × LEGACY / SHARDFILE = 24 images, shot in **WebKit** (Simulator Safari), as a committed `cameras.json` + one re-shoot command + a labelled board (first set from the QD1 subagent: `art/nine-dragon/golden-2026-11-03/`). **Done when** every Nine render change re-shoots it before landing (the gate), and the board shows shardfile = legacy. | Codex harness, Opus reads the board | 3 h |
| QD5 | **Frame rate on the high walkway** ([shaft](../../../art/qa-2026-11-03/qd1-shaft-floating.jpg): 21 fps, max 60 ms; elsewhere 24–30). | Re-read after QD1 (missing geometry may change the cost). **Done when** the walkway and Jake's old 13-fps spot hold 30 fps on the phone tier, or the gap is named with a fix in this list. | Codex reading, Opus fix | 2 h |
| QD6 | **Jake re-QAs Nine** on the fixed live build. | QD1–QD5 done and live. Jake's word (G873, G908). | Jake | — |
| QD7 | **Then SHARD-PLATFORM closes**: NF18 (TSL deletion), LD5 / LD6 / LD9 / LD10 (Nine legacy deletion), CO7 / CO8 (close-out, archive). | Runs the moment Jake says Nine is good. **Done when** SHARD-PLATFORM is archived. | Builder | ½ day |

Order: QD1 now (one Opus lane, with the live pin as soon as the last good SHA is known); QD2 and QD4 in parallel on
Codex lanes; QD3 and QD5 after QD1; then QD6 and QD7. Open plots (G990) wait until QD1–QD5 are done.
