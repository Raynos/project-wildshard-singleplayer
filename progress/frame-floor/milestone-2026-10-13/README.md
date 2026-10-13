# Milestone frame floor, 2026-10-13 (sp-o93)

**FAIL** on `fea49ae283191183b33be5371eda7d0c658632b4` (HEAD at 07:15Z, after
the physics-from-rows, navigation-row, Signal/Sky tile, Signal-ground,
near-tier, Pine wildlife/undergrowth GLB and Sky exact-dressing landings).
Measurement only; nothing was fixed in this lane.

Settings: `scripts/frame-floor.mjs`, the standard capture settings. Desktop
Chromium on Metal, 1440×900 at 2×, uncapped (Auto fps). The Simulator is
Safari on `frame-floor-iphone-17-pro`, phone tier, 2×, with the shipped
30 fps cap. Muted, Developer ON, build pacing ON. The near tier is at its
default (Neighbour detail A), so it is not part of these numbers. Grid
routes use `--grid-scenario=milestone --devserver`, exactly as the
[c66b5b324 milestone](../milestone-c66b5b324-2026-10-11/README.md) did.
Standalone shards use the default production build.

Gates: desktop p95 ≤ 17.5 ms and max ≤ 100 ms; Simulator p95 ≤ 35 ms and
max ≤ 200 ms.

**Load caveat.** This run had no quiet window or CPU hold: the G345
sprint lanes kept running. The 1-minute load average was 5–13 on desktop
and 9–23 on the Simulator (that includes the Simulator itself and each
run's own export build). The pre-sprint receipt was taken under a global
CPU hold. Each grid scenario therefore ran **twice at HEAD**, and the old
pin `c66b5b324` ran **again today** under the same load, so a regression
is named only when it repeats and the old pin stays clean.

## Standalone shards (HEAD): all PASS

| Shard | Desktop p95 / max ms | Desktop work p95 ms | Sim p95 / max ms | Verdict |
| --- | ---: | ---: | ---: | --- |
| _template | 16.8 / 16.8 | 1.9–2.2 | 34 / 34 | PASS |
| driftwood-isle | 16.8 / 16.8 | 6.2–6.6 | 34 / 35 | PASS |
| pine-hollow | 16.8 / 16.8 | 9.4–12.1 | 34 / 35 | PASS |
| nalati-grasslands | 16.8 / 16.8 | 5.3–5.7 | 34 / 39 | PASS |
| sunscar-dunes | 16.8 / 16.8 | 2.1–2.5 | 34 / 34 | PASS |
| far-reach | 16.8 / 16.8 | 3.3–4.1 | 34 / 41 | PASS |
| nine-dragon-stack | 16.8 / 16.8 | 3.6–3.9 | 34 / 35 | PASS |

The worst row per shard is shown (three standing poses each, 120 frames).

## Grid road routes, desktop

The cells show travel p95 / whole-drive max in ms. Runs: pre = the
2026-10-11 receipt; old = `c66b5b324` re-run today; H1 and H2 = HEAD.

| Route | pre | old today | HEAD H1 | HEAD H2 | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| template-interior | 16.7 / 66.7 | 16.8 / 66.7 | 16.7 / **133.4** | 16.7 / 66.7 | PASS (H1 spike did not repeat) |
| template-return | 16.7 / 50 | 16.7 / 100.1 | 16.7 / 100 | 16.8 / 100 | PASS (borderline, both pins) |
| nine-dragon-stack | 16.8 / 83.3 | 16.8 / 83.4 | 16.8 / **266.7** | 16.8 / 100 | PASS (H1 spike did not repeat) |
| far-reach | 16.8 / 66.7 | 16.8 / 66.6 | 16.8 / **150** | 16.7 / 50 | PASS (H1 spike did not repeat) |
| nalati-grasslands | 16.7 / 50.1 | 16.8 / 50 | 16.8 / **250** | 16.7 / 66.6 | PASS (H1 spike did not repeat) |
| pine-hollow | **33.3** / 50 | **33.3** / 50.1 | **33.3** / 83.4 | **33.3** / 100 | **FAIL**, unchanged since pre |
| sunscar-dunes | 16.8 / 49.9 | 16.8 / 50 | **33.3** / **133.3** | 16.8 / 50 | PASS (H1 did not repeat) |
| driftwood-isle | 16.8 / 66.7 | 16.8 / 50.1 | 16.8 / 83.4 | 16.8 / 83.4 | PASS |

In H2, Pine also failed its drive and interior rows: p95 33.4 / 33.3 ms,
with game work p95 17.9 / 17.0 ms. In H1 the same rows read 13.2 / 10.4 ms,
and the old pin today read 11.5 / 10.9 ms. Pine's per-frame work sits at
10–18 ms against a 16.7 ms frame, so it has no desktop headroom left.

A four-route subset run of each pin (Nine, Nalati, Far, Sunscar) was clean
at both: every drive max was ≤ 83.4 ms. The H1 long frames (Nine
`afterPlay` 267 ms, Nalati `between hooks` 250 ms, Far `play` 150 ms) came
when the load average was 10–11. They are not attributed to code.

## Grid road routes, Simulator

The cells show travel p95 / whole-drive max in ms. Runs: pre = the
2026-10-11 receipt (taken under a CPU hold); old = `c66b5b324` re-run today;
H1 and H2 = HEAD.

| Route | pre | old today | HEAD H1 | HEAD H2 | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| template-interior | 34 / 174 | 34 / 122 | 34 / **237** | 34 / 88 | PASS (H1 spike did not repeat) |
| template-return | 34 / 142 | 34 / 133 | 34 / 158 | 34 / 151 | PASS |
| nine-dragon-stack | 34 / 184 | 34 / 169 | 34 / **453** | 35 / **241** | **FAIL: regression** (both HEAD runs over 200 ms, old pin clean) |
| far-reach | **37** / 82 | **42** / 90 | **43** / **221** | **47** / 136 | **FAIL** (travel fails at both pins today; HEAD worse by 1–5 ms) |
| nalati-grasslands | **36** / 103 | 35 / 197 | **37** / **279** | **40** / 96 | **FAIL** (travel 37–40 at HEAD vs 35 old today) |
| pine-hollow | **58** / 113 | **57** / 100 | **62** / 144 | **55** / 109 | **FAIL**, unchanged since pre |
| sunscar-dunes | **52** / 117 | timed out | 34 / 85 | 34 / 89 | PASS (fixed since pre; interior 46 → 34) |
| driftwood-isle | **59** / 133 | not reached | **44** / 100 | **39** / 93 | **FAIL**, improved since pre (59 → 39–44) |

On the old pin, today's Simulator run hit the 600 s budget: its Sunscar route
timed out at waypoint 0, so Driftwood never ran. That run counts only for the
routes it finished.

Standing samples (spawn, deck-east, crossroads) passed at 34 ms in every
run, on both surfaces. Every run was complete with zero errors and stayed
inside the ten-minute budget.

## Verdict

| Surface | Standalone (7 shards) | Grid routes | Failing rows (repeatable) |
| --- | --- | --- | --- |
| Desktop | PASS | FAIL | Pine travel p95 33.3 (since pre). Pine drive and interior hit 33.3 in H2 |
| Simulator | PASS | FAIL | Nine drive max 241–453 · Far travel 43–47 · Nalati travel 37–40 · Pine travel 55–62 · Driftwood travel 39–44 |

## Regressions against the pre-sprint floor

1. **Nine Dragon road entry, Simulator long frame (new FAIL).** The drive
   max was 453 ms in H1 and 241 ms in H2. The old pin read 169 ms today and
   184 ms pre-sprint. The hooks were `nine-dragon-stack:activate` (453) and
   `afterPlay` (269) in H1, and `world` (241) in H2, so this is Nine's own
   entry work. On desktop, H1 showed the same `afterPlay` spike (267 ms),
   and H2 / the subset ran clean. Window: `c66b5b324..fea49ae28` touching
   Nine. Suspects are the G350 physics-from-rows port (`b54b181de`,
   `0319f8004`) and the shared tile / navigation-row admission landings.
   It has not been bisected yet; the next cheap step is one Simulator Nine
   subset run at `b54b181de^` and one at `b54b181de`.
2. **Nalati road entry, Simulator travel p95 (36 → 37–40 ms).** The old
   pin read 35 ms today. H1 also had a 279 ms `activate` frame that did not
   repeat (96 ms in H2). Window: the Nalati physics-rows (`35e6c10ba`) and
   navigation-through-`bake()` (`37824c3da`) landings, plus the sp-x6
   terrain-form work. Unattributed: the effect is 2–5 ms under load.
3. **Far Reach road entry, Simulator travel p95 (37 → 43–47 ms).** Most
   of this is load, because the old pin also read 42 ms today. HEAD is
   1–5 ms worse, and H1's drive max of 221 ms (`afterPlay`) fell to
   136 ms (`world`) in H2. Window: the Sky props tiles (`fd1b0a9a4`),
   exact dressing instances (`b7dd70203`, `07aea2324`) and physics rows
   (`3ed995b80`).

Not regressions: the desktop H1 long frames (template / Nine / Far / Nalati
/ Sunscar). Neither H2 nor the subset reproduced them, and they lined up
with load averages of 10–11. Pine on both surfaces is unchanged since
pre-sprint and is still the first owned fix. Improvements: Sunscar's
Simulator rows now pass (travel 52 → 34 ms, interior 46 → 34 ms), and
Driftwood's Simulator travel fell from 59 to 39–44 ms. The near tier
defaults to A, so these readings say nothing about Neighbour detail B / C.

## Files

- [summary.json](summary.json) holds every row of every run listed here:
  p95, max, work p95, verdict and long-frame hooks.
- The raw per-run results stay in scratch, which was cleaned afterwards.
  This is Mac-backed Simulator Safari. It makes no physical-iPhone or
  memory-cap claim.
