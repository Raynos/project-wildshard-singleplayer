# Signal Dunes: authored physics (G350-SD, was DS1.5 Node-canonical)

`generators/physics.ts` composes the physics product `data/physics.generated.json` from authoring inputs only (G320): the
camp placement, tower, ridge and scout recipes, the species scale ranges with the creature manager's seed stream, and
`data/physicsRows.json` for what no recipe computes (the practice arena, the dressing tree, each species simulation spec,
the prompt and crack spots). It runs under the authoring loader; no world, model, registry or runtime code runs. The
retired DS1.5 bake built the world in Node; its last output matched this product in every gameplay field, byte for byte.

Regenerate and compare:

```sh
node scripts/generate.mjs --job=signal-physics --compare
```

The official 12,503-tick gameplay journey retains the canonical hash `95a6050c27629ed4eb94e79af6a502495f3e5aa7b4c9fd56fb03c8cfdaef54ae`, both earned facts and 25 coins. The 1,793-tick mid-fight restore suffix and shipping-worker continuation agree exactly, with durable reload and duplicate-stable Ledger outcomes. No checkpoint payload or gameplay outcome changes. Fifteen focused native contracts, strict and touched root-config type-aware lint pass.

Fresh native page comparison confirms every gameplay field is exact. The actual map rebake preserves every image byte. Official `physics-baseline.mjs --no-build --mode=walk --shard=sunscar-dunes`: **7 legs, 0 stuck, no page errors**.


SF81 DIR5 Matriarch stages are authored for page and native hosts, with the same DirectorBossBrain as Sky. Deliberately updated canonical boot/final/replay hashes for the encounter version2 wrapper and complete stage cursor; the real native tape, fire and quest effects, body contacts, retries, victory and Ledger outcomes remain exact. Existing marked-body checkpoint spawn/retirement and storm presentation stay native. This lands the boss-stage slice; the brazier-signal director is separate.


SF81 DIR5 signal fire: the accepted real fire edge enters signalStages.json through the same local SignalDirector on the page and native host. Quiet loaded-light admission and full cursor restore never summon or file effects. Deliberately re-recorded canonical continuation hashes for the additional sunscar.signal-fire adapter; all checked prior native fields, complete command tape, real bowl/fire/quest/victory effects, contacts, retries and Ledger outcomes match the predecessor. Actual physics payload and official map pixels are unchanged; no snapshot payload is committed.
