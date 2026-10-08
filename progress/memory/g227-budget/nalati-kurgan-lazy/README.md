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
Temporary construction allocation and native WebContent savings are **not measured or credited**.

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
All owned browser/preview resources were closed. Native memory savings and the physical iPhone cap
remain unmeasured and uncredited.
