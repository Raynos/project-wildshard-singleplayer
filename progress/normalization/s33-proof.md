# E357 S3.3 — sol-s33

Source checkpoints: `a3fe6afb`, `b7c64413`, `6ceab0ef`, `72fb9115`, `d78e9eeb`, `bf1ebe6b`, `965af2a1`, `c8b2ec4f`, `751b25c9`, `6a7eeea5`.

GoldenBow extends Bow; Naizagai extends Sabre. Mounted bow tuning belongs to Nalati's profile. Equipment replacement preserves slot/quiver/mounted state. Ride and stealth use scoped input contexts; mounted targeting excludes the player-owned horse without hiding it. Camp fitting/atlas skinning/motion use shared NPC helpers and authored rows.

Focused verification before the S3.4 file move: 33 cases across seven files green, including the 540 damage combinations, 50 input remount/disposal cycles, real Rapier mount filtering, canceled HUD pending placement, and NPC trajectories against the original 72fb9115 implementation (12 decimal places). The additional real saddle mount/dismount case passed separately. Owned lint passes after the import mappings.

Clean export 965af2a1 passed CSS, generation, app/API types, oxlint and ratchet. Later whole-tree checks belong to sol-v1/lead under the machine saturation rule. The clean committed 6a7eeea5 export rerun passed all 34 focused cases across seven files after generation (2026-10-01 08:05). WT checks are temporarily blocked by S3.4 moved-path public aliases and telemetry boss-outcome typing; holders notified. No final whole-tree green claim.

Remaining acceptance: V1 gates the final integrated SHA; lead records narrow all-four phone parity. No screenshot session, preview server or browser was opened by this builder.

Queued commands (replace HEAD with the final integrated SHA):

```sh
scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=HEAD --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses --out=/private/tmp/e357-sol-s33/phone
scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=HEAD --lane=m5 --shards=all --tiers=phone --only=walk+combat+leak --out=/private/tmp/e357-sol-s33/phone-motion
```
