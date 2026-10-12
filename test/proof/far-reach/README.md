# Sky Reach: DS1.5 Node-canonical physics

`src/shards/far-reach/generators/bake-sky-physics.mjs` executes the real authored world and native practice-room constructor in Node. The existing engine spawn factory loads the admitted GLB rigs, then creates the same eight flyers and five deferred goats in native order. It refuses missing rig assets; it never reads the old physics output to construct a body. No decisions, renderer or gameplay changes are introduced.

Regenerate and compare with:

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/far-reach/generators/bake-sky-physics.mjs
node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/far-reach/generators/bake-sky-physics.mjs --check
node scripts/generate.mjs --job=sky-physics --compare
```

All 13 actor specs, seeds and scales are exact. Of the 43 collider pieces, 858 numeric fields differ from the page by at most **1.4210854715202004e-14 m** in position and **1.1102230246251565e-16** in quaternion components. Structure, identities, mode/active gates and other fields are exact. Node is canonical, with unchanged arithmetic and no quantization. Independent Node processes and the cold portable generation cache compare exact bytes; Linux CI runs the same Node gate.

The official 21,134-tick gameplay journey, gale-wall restore/worker suffix and durable ledger pass with the original canonical hashes, both earned facts and 35 coins. All cached checkpoint payload hashes stay byte-identical; their input-only refresh remains the pusher's. `compatibility.json` is from that real run. Twenty focused native contracts, strict and touched typed lint pass.

Fresh native page comparison confirms these exact last-bit differences. The actual map rebake preserves every image byte. Official `physics-baseline.mjs --no-build --mode=walk --shard=far-reach`: **10 legs, 0 stuck, no page errors**.


SF81 DIR5 Roc stages are authored for page and native hosts, with the shared DirectorBossBrain over the original held body/fight ports. Deliberately re-recorded step, gale and storm hash manifests: decoded command tape and every canonical native field are identical except the encounter wrapper version1->2 and its complete authored stage cursor. The full native spawn-to-Roc tape, gameplay/contacts, retries, quest/encounter facts and Ledger outcomes remain exact; physical payloads and map pixels are unchanged. No gzip payload committed.

G345 flock keeper: `runtime/flock.ts` runs on the shared `installHomeKeeper` (options `late`, `think.bands`, `killY`, `place`, `adopt`, the policy's `stream`). Deliberately re-recorded step, gale and storm checkpoints: every tick's player, bodies, effects and every other adapter are identical on a clean export of HEAD vs HEAD + the port; only the `far.flock` continuation wrapper changes (the keeper's `tokens: []`, `wait: 0`, `boss: null` for Sky's derived `goats` flag). Signal's keeper witness is byte-exact.
