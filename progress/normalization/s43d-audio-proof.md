# E357 S4.3c audio ownership proof

Parent `c495de15624ebc420e444b4b733f5795e6f69180`; final island source `7e0c75605a872904557ad287cd2f2815cc791190`.

Commands (unwrapped, default proven fast clock):

```sh
node scripts/parity.mjs --export=c495de15624ebc420e444b4b733f5795e6f69180 --lane=m5 --shards=driftwood-isle --tiers=phone --only=walk+combat+leak --out=/private/tmp/e357-s43d/parity-parent
node scripts/parity.mjs --export=7e0c75605a872904557ad287cd2f2815cc791190 --lane=m5 --shards=driftwood-isle --tiers=phone --only=walk+combat+leak --out=/private/tmp/e357-s43d/parity-final
```

Both first captures and automatic retries agree on sound logs. Walk and combat event id/count maps and ambient id sets are exactly equal. Full combat and pause/resume results are exactly equal. All three walk traces and endpoints are exactly equal; only floating-point seconds differ by at most 4.45e-14. Boot requests remain 110: exactly 16 sample directory renames, no other URL change. The companion JSON preserves sound maps, trace hashes, and leak measurements.

All leak before/after counters and scope counts agree and are zero for level-owned resources. The final capture adds one disposal error: `Cannot read properties of null (reading 'dispose')`. This is a separate quest ownership regression: the new adventure `kit.dispose()` callback repeats disposal of BatchedMesh instances already disposed by SceneOwnership. A real Three BatchedMesh disposed twice produces that exact error; sol-s43a independently reproduced it with Scope+SceneOwnership. Current owner sol-s44 has the focused teardown patch. No extra browser run was taken.

Both comparisons exit 1 against stored baselines. The parent already differs in walk sound ids, system inventories, registry, boot audio requests, HUD, save reads and combat loot writes. The final adds only the disposal-error red field. These comparisons do not establish a green stored baseline.

Source verification: clean export gen, whole-tree tsc, ratchet, touched oxlint, and 32 focused cases pass. Sixteen relocated files (464975 bytes) and every moved manifest recipe entry match their original bytes; island gain .25, shrine gain .36, loop ordering and family variant ordering are retained. Cue routing makes no tap or random draw and delegates unchanged recipes. The system-order fixture preserves listener → shrine hum → ambience → generic frame interactions. Dusk precedes actual-parent hands/enemies; Boundary.update's movement across dusk is treated as code-inert (uniform/light updates only), reviewed by V2 and reported to the lead.

Nalati proof is queued for the lead's batch (B55):

```sh
node scripts/parity.mjs --export=c495de15624ebc420e444b4b733f5795e6f69180 --lane=m5 --shards=nalati-grasslands --tiers=phone --only=walk+combat+leak --out=/private/tmp/e357-s43d/nalati-parent
node scripts/parity.mjs --export=7e0c75605a872904557ad287cd2f2815cc791190 --lane=m5 --shards=nalati-grasslands --tiers=phone --only=walk+combat+leak --out=/private/tmp/e357-s43d/nalati-final
```

Require identical `walk.sounds` and `combat.sounds`; its general loading inventory intentionally loses the 16 island-only sample URLs. Removing `setState({shard:'steppe'})` keeps the existing pluck lead and title-only style decoding; Nalati already owns its authored score.
