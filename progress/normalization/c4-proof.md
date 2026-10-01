# E357 C4 — Melee family and B1/B2

Source: `fcb7f2c7`, `1cb362cc`, `152c5409`. All 158 focused checks pass; C1's move, damage and trajectory snapshots are unchanged. The full clean exported-tree gate passed on `1cb362cc` and `152c5409`: CSS, generator, app/API typecheck, whole lint, ratchet, whole Vitest and build.

## Named bug evidence for the M1 weapons board

The registered Rapier wall tests compare the blocked strike and the same strike with cover removed. No damage, stagger, rehit timer or hit/impact feedback is consumed on a veto. These tests specifically cover B1/B2; the standard browser combat scenario does not place cover between spear/lightning contacts.

| Contact | Before, through wall | After, through wall | After, open |
|---|---:|---:|---:|
| Spear thrust | 30 | 0 | 30 |
| Spear brace at closing6 m/s | 108 | 0 | 108 |
| Spear lance at8 m/s | 88 | 0 | 88 |
| Naizagai crescent, clear weather | 40 | 0 | 40 |
| Naizagai clear/storm arc beyond cover | 40 / 50 | 0 | 40 / 50 |

Clear Naizagai retains one arc; storm retains two arcs and ×1.25 damage. The call-down retains its deliberate through-wall area damage. Native actors enter `combat.hit` once, with variant/species rules applied once.

## Narrow phone run

Running on the committed export `152c540966efb739265b53cd17ce0f60b14637d1`:

```sh
scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=152c540966efb739265b53cd17ce0f60b14637d1 --lane=m5 --shards=all --tiers=phone --only=walk+combat+leak --out=/private/tmp/e357-c4/1
```

Log: `/private/tmp/e357-c4/parity-1.log`. The lead takes over the running command after the brief's four-minute handoff limit; its harness closes the browser/preview on exit. Full parity, baseline reconciliation and deployment remain with the lead.

Driftwood's captured `combat` object is byte-identical to the C3 before-extraction result `/private/tmp/e357-c3/2/driftwood-isle.phone.json`: sword→crab,3 hits, first hit0.5693333333333044s, kill1.6759999999999167s;3 whooshes,3 shell impacts,3 hit markers,1 crab vocal and1 kill. Loot writes also match C3's post-F10 saves. The current old-baseline comparison is red for pre-existing save keys/health system census/physics/boot buffers plus walking bed/gull sounds; it is not a green overall parity claim. Both C3 and C4 capture436 boot geometries,83 textures. Nalati and the other shard results are pending in that same output directory at handoff.

## Implementation decisions

`Melee` is the abstract shared contact/profile/hook family; `Sword` owns the existing swept-blade clock, while `Spear` retains its distinct thrust/brace/throw clock. This avoids constructing sword meshes for a spear. `Naizagai extends Sabre`; its preloaded `NaizagaiPower` presentation stays on the Titan clock and receives the protected swing hook. The replacement preserves the owned/held sabre slot, pass-chain/cooldown clock, heavy perk and one scoped listener set. The kit's mount setter follows the live replacement. The outgoing Sword world-star root leaves with its owner, its private effect resources are disposed, and a replacement test verifies the scene-root count stays constant. Legacy per-instance framing overrides still apply after profile defaults. Jian has explicit damage12, inherited move/lock-on settings, portraitFov78 and tested skinned/static fallback.

The case-insensitive filesystem cannot hold `Sword.ts` and `sword.ts` beside each other: the implementation is `SweptMelee.ts`, rows `profiles.ts`. Engine consumers take neutral ports/public exports; engine code does not import the kit. The legacy C1 measurement callback is `onMoveHitEvent`, leaving the spec's `onMoveHit` name available as the protected subclass hook.
