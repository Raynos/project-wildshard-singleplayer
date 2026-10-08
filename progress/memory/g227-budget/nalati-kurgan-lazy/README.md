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
OFF fixture respects the reload-scoped Memory saver setting. Browser/native measurements remain
pending; the source does not claim the physical iPhone's cap.
