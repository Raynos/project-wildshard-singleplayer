# Shared-tree cleanup, 15 October 2026

The initial inventory contained 609 paths. Most were generated assets made
visible by a stale working-copy ignore list that omitted roughly 400 committed
rules. Reconciliation preserved current source; it did not commit those assets.

- Six current catalogue outputs gained exact ignores in `06acc7b9c`.
- Forty-nine obsolete generated hash artifacts gained exact ignores in
  `3c95e88e9`. No binary bytes or storage pins were added.
- The fixed-model producer also emits `data/duneLogsBake.json`; its exact
  ignore accompanies this report.
- The stale catalogue omitted 48 current jobs and added the retired
  `pine-undergrowth` job, whose entry no longer exists. The current committed
  catalogue was retained. No live job was removed.
- Stale manual, diet and owner-table copies were reconciled to current source.
  Old ratchet and input-only checkpoint edits were 42–56 hours old; all Codex
  owners denied ownership before their stale index entries were reconciled.
- Eight obsolete guard/exact-bake source copies were removed from the checkout.
  The historical scene byte-oracle draft is preserved at
  `refs/parked/sp-x7-drafts` (`725918942`). The live H GLSL helper stays with
  its shader owner.

Live manifest, wildlife, shader, waterfall and planner disk-work edits were
left intact. Two unclaimed map-stamp edits (Nine and Pine) change only their
input keys; neither was committed without a fresh official bake. This cleanup
supplies no visual or map-freshness credit.

The following old generated blobs exceed the 1 MB unpinned-blob ceiling.
They were excluded, not forced into Git. These are preflight size findings,
not a claim that the checker was bypassed or that new pins were approved.

| Bytes | Local generated path |
| ---: | --- |
| 4,036,220 | `public/assets/pine-hollow/baked/e9ca424824e8b66289cd3593b2fa66b7e9c7a546d03fe289ec404af59d7d90b2.glb` |
| 1,457,476 | `src/shards/nine-dragon-stack/assets/0005afe3b1043a080e66952d62e438df931f335eacd43ba661d4477b023bc85b` |
| 2,360,288 | `src/shards/nine-dragon-stack/assets/1f9bf54e9e34cf297ee7a83615b681eb81463be871c593d69c63df5db208557c` |
| 1,451,900 | `src/shards/nine-dragon-stack/assets/3084de4822a13b7ede6be42b7e5a95061de4070da4947e338571d902b3548fe9` |
| 1,454,344 | `src/shards/nine-dragon-stack/assets/3384de9fb75d6814cd64c206ef0586fdbf4b11cca784a5b2eb25f88f10997498` |
| 1,429,728 | `src/shards/nine-dragon-stack/assets/3ade513464214af4d8c8811a6492b202e36f71c3fd5ed681700d35fe99c5bc72` |
| 1,458,724 | `src/shards/nine-dragon-stack/assets/3d247995aebcdd6b188d178bdffbd5bdd62f4117d6b2fdf9683115fdab3d9c14` |
| 1,462,396 | `src/shards/nine-dragon-stack/assets/6984a18566c4768948c9221a3013016a979d1f1c2bbe7724759346ed632921b4` |
| 24,188,008 | `src/shards/nine-dragon-stack/assets/8988a86a57f92ce5f528f29ab1890c1f26867914ba89306c01ad4410e37368df` |
| 1,433,976 | `src/shards/nine-dragon-stack/assets/8d668ff719023a96eb52bb7fa6d58e11014503475efacd867aeb8c6be36ff132` |
| 1,454,056 | `src/shards/nine-dragon-stack/assets/8e6f196bd1577498081761927f4e67c2071f4b04eac070563ee4fb4545f1ac4b` |
| 1,429,644 | `src/shards/nine-dragon-stack/assets/a4c12e106fc0840246d93e0c1bd3fdbfb0dd60f6915526406123621257d2cf75` |
| 1,451,356 | `src/shards/nine-dragon-stack/assets/b4bc80e97f6c687ac3227f8624993d840d8747614d8c01ccf8def9a87ce22101` |
| 1,459,768 | `src/shards/nine-dragon-stack/assets/c02f646f27f3d7759c841b7c6373106eda1d3cec7dde227d28e93d0bee722aad` |
| 20,201,192 | `src/shards/nine-dragon-stack/assets/c6402890c2c569daae42360852066f78b17d709145b3d2935c653f6329fecb94` |
| 1,431,652 | `src/shards/nine-dragon-stack/assets/d3c155caa880b3549116ba6fe61f65046e0570a7c196a8c244503a38043bf6d6` |
| 23,488,612 | `src/shards/nine-dragon-stack/assets/f1f3a5051a3da65e8c1dc45ed76d3c5812f86077cb7d7eb9d823bfeee3fb9340` |
