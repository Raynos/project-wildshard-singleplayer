# Nalati unseen kurgan: avoid static construction until entry

Memory saver ON delays only the merged chamber, dromos and gravegoods mesh. The existing
220 ms entry fade reaches black before the entry callback materializes it; immediate developer
entry also builds it before visibility. OFF and `KurganDungeon.build()` retain the eager recipe.

Collision boxes, floor/sand collision, seal, lid/statues, FX, fight binding, reset and reward logic
remain installed at boot. The static recipe is seeded with `0xb0551`. Its verified post-static
RNG state `1996222552` is restored before boot movables, preserving their shipping draw suffix
without allocating the static mesh or running its geometry-building prefix.

The static position, normal and colour arrays total **12,022,128 bytes**, and are absent until
first entry under Memory saver ON. The static mesh is built once, retains shipping child order,
and is disposed by the existing delegated scene owner even when first created after admission.
Temporary construction allocation is not measured. The cold native cohort below credits **no
WebContent saving**.

The frozen source oracle is [source.json](../../../../test/fixtures/kurgan-oracle/source.json):
shipping blob `d9945f7463d260de06af4e82c63b86a1a2e88eaa`, SHA-256
`344fd949d8bfc3e0767c8ce30879e2f8b257fb76fc3af516f7fd71a5538d3039`.
Only class/import renames are applied; inverse rewrites reconstruct it byte-for-byte.

Focused checks compare all static/movable geometry bytes, colliders, floor samples, setup RNG,
checkpoint dressing, repeated entry and child order against that shipping oracle. They also drive
the actual entry fade, real BossBrain continuation restore and delegated scope disposal. A separate
OFF fixture respects the reload-scoped Memory saver setting.

## Real browser proof

`0690fca6aba45cbed6303d9cf1dc68c46fcc1a5e`, built by `scripts/serve-build.sh --rev <sha>`,
was captured in one wrapped muted agent-browser session, fresh pages for Memory saver OFF/ON,
using the existing parity init/settings fixtures and iPhone 16 Pro emulation (402 × 874, DPR 3;
phone-tier renderer remains DPR 2). [browser.json](browser.json) records both observations.
The [centre](centre.jpg) and [entry](entry.jpg) captures illustrate both identical paths.

- Centre pixels match exactly: SHA-256 `d66ca778d2408de0c217cbce163206fdf729113a4bb27a0603bb2da030ab7fa9`.
- Interior pixels match exactly: SHA-256 `15d749417a3cf459192a171fc94355a24ff56ec86ea00f1472af82cda1b5cb33`.
  Repeated captures within each page have the same hashes.
- Static CPU bytes at centre: OFF 12,022,128; ON 0. Both have 2,776 live colliders.
- At first entry ON builds while the real fade opacity is **1**, after its authored 220 ms transition.
  Observed synchronous construction: **203.7 ms** on this Mac browser; OFF 0 ms. The ten-frame
  entry window was 460.9 ms ON / 314.5 ms OFF. One observation per side is not a timing benchmark;
  construction extends the opaque loading interval. Both runs end with 98 shader programs.
- Re-entry retains the same mesh and takes 0.1 ms for visibility, with zero harness errors or fatal UI.

[Capture evaluator](capture.js) runs through `agent-browser eval --stdin` after parity `installInit`
(capture 30, native rAF) and `developerSettings` (memorySaver OFF/ON, midday, clear, volume 0).
It invokes the actual native entry method through its debug handle, then advances normal app frames;
this is **not a door-walk baseline**. A failed pose onto the entrance roof and unconfigured browser
relaunches were discarded before these paired captures; neither is a credited run.
All owned browser/preview resources were closed. The physical iPhone cap remains unmeasured.

## Failure-inclusive cold Simulator cohort

[six-cold.json](six-cold.json) records three valid cold Safari runs per side, interleaved
before/after, with Memory saver ON, Developer ON, phone tier, DPR 2 and muted audio. The isolated
source pair is parent `96c90a1373f5fa93d61cba12b067f6d97d218696` versus
`0690fca6aba45cbed6303d9cf1dc68c46fcc1a5e`. The frozen settled `native.mjs` helper is from
`bd18867dea2fdfe03a1fd384e9d9eb9bb46790de`; it includes the corrected sampler liveness,
fixed-PID and fresh-timestamp fences. No SF57 journal or heap collection runs in this cohort.

Every valid run completes home, Nalati entry, Nalati centre and neutral-road samples, using three
independent kernel timestamps per pose, followed by owned-resource cleanup. All six centre
censuses witness 69,215,552 → 57,193,424 live CPU backing bytes: exactly the three hidden kurgan
arrays (12,022,128 bytes) are absent in the lazy arm. Centre GL is identical in every run.
The native AudioContext was interrupted at currentTime 0 in both arms; the offline context was
suspended at 0. The receipt retains these observations rather than treating them as audible playback.

Centre readings below use decimal MB. Each run contributes its median of three settled samples;
the cohort reports the median and full range across those three run medians.

| Centre | Eager parent | Lazy cut | Change in median |
| --- | ---: | ---: | ---: |
| WebContent median | 822.284128 MB | 851.627752 MB | +29.343624 MB |
| WebContent range | 802.164528–823.332632 MB | 817.385192–855.756520 MB | overlapping |
| WebContent spread | 21.168104 MB | 38.371328 MB | |
| GL median | 277.163956 MB | 277.163956 MB | 0 |
| WebContent + GL median | 1099.448084 MB | 1128.791708 MB | +29.343624 MB |

**No native saving is credited.** The live-array reduction is exact; cold WebKit footprint does
not demonstrate a reduction. These Simulator readings do not establish physical iPhone caps.

Failure counts are **baseline 1 / lazy 0**, in addition to three valid runs each. The baseline's
first launch failed before game load because the frozen scratch helper could not resolve `ws`,
which the checkout inherits from `/Users/raynos/node_modules`. Its original log is retained.
Linking that same package explicitly repaired the scratch environment without changing helper
source or measurement rules. No measured run had a game, sampler, PID or freshness failure.

[Raw archive](six-cold-raw.tar.xz) preserves every attempt's original report, kernel sample
journal, sampler/driver logs and passive vmmap/footprint diagnostics, plus the exact helper
sources and runner. Its byte/hash manifest is in the JSON receipt. All owned Safari, Inspector,
proxy, sampler and preview resources were closed; Simulator and browser lanes were empty on release.
