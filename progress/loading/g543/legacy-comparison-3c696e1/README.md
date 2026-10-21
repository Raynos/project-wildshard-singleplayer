# Current-build frozen legacy comparison

All entries use the same committed served SHA: `3c696e1134cea78a1d0142bb6969b02c149acd5b`.

Legacy internals are frozen (G498/G531). Its original Debug entry is used
only as an O6 comparison; legacy byte/cadence failures are retained below
and do not reopen the shardfile/grid Phase 1 gate. The muted phone capture
is iPhone 16 Pro Chromium with CPU 4x; native is the iPhone Simulator via
sim-lane. Warm entries retain the corresponding origin and real caches.

| Surface | Path / visit | Wall / stages s | Actual wire MB | Cache MB | Byte error | Detail gap ms |
|---|---|---|---|---|---|---|
| phone | legacy / cold | 10.8 / 10.842 | 21.798 | 10.80 | 0.07% | 1108.2 |
| phone | shardfile / cold | 22.3 / 22.299 | 175.504 | 99.14 | 0.14% | 446.5 |
| phone | grid / cold | 21.9 / 21.894 | 170.878 | 101.42 | 0.37% | 496.2 |
| phone | legacy / warm | 10.4 / 10.440 | 0.001 | 34.89 | 1.22% | 1138.3 |
| phone | shardfile / warm | 21.2 / 21.299 | 0.057 | 193.03 | 0.03% | 374.0 |
| phone | grid / warm | 22.1 / 22.142 | 0.027 | 190.57 | 97.52% | 591.1 |
| simulator | legacy / cold | 3.7 / 3.748 | 22.476 | 2.43 | 1.11% | 257.0 |
| simulator | shardfile / cold | 14.2 / 14.267 | 182.216 | 89.44 | 2.81% | 269.0 |
| simulator | grid / cold | 15.6 / 15.598 | 172.733 | 88.28 | 0.00% | 1002.0 |
| simulator | legacy / warm | 10 / 9.973 | 0.067 | 25.24 | 64.22% | 567.0 |
| simulator | shardfile / warm | 13.9 / 13.909 | 0.044 | 181.74 | 46.14% | 408.0 |
| simulator | grid / warm | 8.5 / 8.546 | 0.044 | 179.41 | 46.14% | 653.0 |

Every actual network response stays in the independent wire denominator.
These are sequential measurements under shared-machine load, not an
isolated A/B speedup experiment. Current scene content and product admission
differ between the legacy and shardfile paths; exact stage rows accompany
each compact receipt so those costs remain visible.

The labelled portrait captures retain the real cold-entry views:
[phone](phone-legacy-cold.jpg) and [Simulator](simulator-legacy-cold.jpg).

| Surface / visit | Path | Stage | Seconds |
|---|---|---|---|
| phone / cold | legacy | ▸ 1 · Application modules | 1.289 |
| phone / cold | legacy | ▸ 5 · Sky · lighting | 0.561 |
| phone / cold | legacy | ▸ 13 · Props | 4.617 |
| phone / cold | legacy | ▸ 18 · Shaders | 1.699 |
| phone / cold | legacy | ▸ 19 · First frame | 0.486 |
| phone / cold | legacy | ▸ 20 · Audio · music + sound effects | 0.297 |
| phone / cold | legacy | ▸ 22 · Equipment and HUD | 0.321 |
| phone / cold | legacy | ▸ 23 · Gameplay and saved state | 0.493 |
| phone / cold | shardfile | ▸ 1 · Application modules | 1.310 |
| phone / cold | shardfile | ▸ 2 · Product admission | 0.971 |
| phone / cold | shardfile | ▸ 5 · Sky · lighting | 1.159 |
| phone / cold | shardfile | ▸ 13 · Props | 6.971 |
| phone / cold | shardfile | ▸ 18 · Shaders | 9.189 |
| phone / cold | shardfile | ▸ 19 · First frame | 0.368 |
| phone / cold | shardfile | ▸ 22 · Equipment and HUD | 0.577 |
| phone / cold | shardfile | ▸ 23 · Gameplay and saved state | 0.631 |
| phone / cold | grid | ▸ 1 · Application modules | 0.852 |
| phone / cold | grid | ▸ 2 · Product admission | 0.804 |
| phone / cold | grid | ▸ 6 · World assembly | 4.987 |
| phone / cold | grid | ▸ 8 · Shaders | 5.055 |
| phone / cold | grid | ▸ 9 · First frame | 0.394 |
| phone / cold | grid | ▸ 11 · Region world | 0.329 |
| phone / cold | grid | ▸ 15 · Home region | 8.823 |
| phone / warm | legacy | ▸ 1 · Application modules | 1.227 |
| phone / warm | legacy | ▸ 5 · Sky · lighting | 0.422 |
| phone / warm | legacy | ▸ 6 · Terrain · heightfield | 0.260 |
| phone / warm | legacy | ▸ 13 · Props | 4.627 |
| phone / warm | legacy | ▸ 18 · Shaders | 1.418 |
| phone / warm | legacy | ▸ 19 · First frame | 0.499 |
| phone / warm | legacy | ▸ 20 · Audio · music + sound effects | 0.315 |
| phone / warm | legacy | ▸ 22 · Equipment and HUD | 0.325 |
| phone / warm | legacy | ▸ 23 · Gameplay and saved state | 0.491 |
| phone / warm | shardfile | ▸ 1 · Application modules | 1.212 |
| phone / warm | shardfile | ▸ 2 · Product admission | 0.832 |
| phone / warm | shardfile | ▸ 5 · Sky · lighting | 1.190 |
| phone / warm | shardfile | ▸ 13 · Props | 4.766 |
| phone / warm | shardfile | ▸ 18 · Shaders | 10.222 |
| phone / warm | shardfile | ▸ 19 · First frame | 0.413 |
| phone / warm | shardfile | ▸ 20 · Audio · music + sound effects | 0.262 |
| phone / warm | shardfile | ▸ 22 · Equipment and HUD | 0.801 |
| phone / warm | shardfile | ▸ 23 · Gameplay and saved state | 0.710 |
| phone / warm | grid | ▸ 1 · Application modules | 0.995 |
| phone / warm | grid | ▸ 2 · Product admission | 0.920 |
| phone / warm | grid | ▸ 6 · World assembly | 5.794 |
| phone / warm | grid | ▸ 8 · Shaders | 5.806 |
| phone / warm | grid | ▸ 9 · First frame | 0.484 |
| phone / warm | grid | ▸ 11 · Region world | 0.580 |
| phone / warm | grid | ▸ 14 · Final activation | 0.266 |
| phone / warm | grid | ▸ 15 · Home region | 6.818 |
| simulator / cold | legacy | ▸ 1 · Application modules | 0.486 |
| simulator / cold | legacy | ▸ 13 · Props | 1.183 |
| simulator / cold | legacy | ▸ 18 · Shaders | 0.435 |
| simulator / cold | legacy | ▸ 20 · Audio · music + sound effects | 0.914 |
| simulator / cold | shardfile | ▸ 1 · Application modules | 0.741 |
| simulator / cold | shardfile | ▸ 2 · Product admission | 0.704 |
| simulator / cold | shardfile | ▸ 5 · Sky · lighting | 0.717 |
| simulator / cold | shardfile | ▸ 13 · Props | 5.101 |
| simulator / cold | shardfile | ▸ 18 · Shaders | 4.378 |
| simulator / cold | shardfile | ▸ 20 · Audio · music + sound effects | 1.025 |
| simulator / cold | shardfile | ▸ 22 · Equipment and HUD | 0.709 |
| simulator / cold | shardfile | ▸ 23 · Gameplay and saved state | 0.302 |
| simulator / cold | grid | ▸ 1 · Application modules | 0.613 |
| simulator / cold | grid | ▸ 2 · Product admission | 0.589 |
| simulator / cold | grid | ▸ 6 · World assembly | 2.572 |
| simulator / cold | grid | ▸ 7 · Title art · explore | 1.006 |
| simulator / cold | grid | ▸ 8 · Shaders | 2.268 |
| simulator / cold | grid | ▸ 11 · Region world | 0.287 |
| simulator / cold | grid | ▸ 15 · Home region | 7.924 |
| simulator / warm | legacy | ▸ 1 · Application modules | 0.577 |
| simulator / warm | legacy | ▸ 13 · Props | 1.166 |
| simulator / warm | legacy | ▸ 18 · Shaders | 0.585 |
| simulator / warm | legacy | ▸ 20 · Audio · music + sound effects | 6.607 |
| simulator / warm | shardfile | ▸ 1 · Application modules | 0.616 |
| simulator / warm | shardfile | ▸ 2 · Product admission | 0.744 |
| simulator / warm | shardfile | ▸ 5 · Sky · lighting | 0.780 |
| simulator / warm | shardfile | ▸ 13 · Props | 3.702 |
| simulator / warm | shardfile | ▸ 18 · Shaders | 4.585 |
| simulator / warm | shardfile | ▸ 20 · Audio · music + sound effects | 1.738 |
| simulator / warm | shardfile | ▸ 22 · Equipment and HUD | 0.890 |
| simulator / warm | shardfile | ▸ 23 · Gameplay and saved state | 0.308 |
| simulator / warm | grid | ▸ 1 · Application modules | 0.399 |
| simulator / warm | grid | ▸ 2 · Product admission | 0.549 |
| simulator / warm | grid | ▸ 6 · World assembly | 2.166 |
| simulator / warm | grid | ▸ 8 · Shaders | 1.993 |
| simulator / warm | grid | ▸ 15 · Home region | 2.942 |

Comparison accuracy failures retained (legacy is outside the gate):

- phone legacy cold: Detailed update gap exceeds 1 s
- phone legacy warm: Detailed update gap exceeds 1 s
- phone grid warm: Network bytes are unavailable or differ by more than 5%
- phone grid warm: Visible MB count differs by more than 5%
- simulator grid cold: Detailed update gap exceeds 1 s
- simulator legacy warm: Network bytes are unavailable or differ by more than 5%
- simulator legacy warm: Visible MB count differs by more than 5%
- simulator shardfile warm: Network bytes are unavailable or differ by more than 5%
- simulator shardfile warm: Visible MB count differs by more than 5%
- simulator grid warm: Network bytes are unavailable or differ by more than 5%
- simulator grid warm: Visible MB count differs by more than 5%
