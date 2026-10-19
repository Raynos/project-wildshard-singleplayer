# Shared enemy arena

One page, engine bundle, Game, canvas, physics world and TrainingArena. Four exact
published WIP data products supply separately admitted opponents. Changing enemy
replaces the sole EncounterSession actor; it does not change sites, reload an
iframe, instantiate another game, or combine decision programs.

## Pinned opponents

- Splinter Mantis: motion7, V7-native22-motion7
- Conch Duelist: motion4, character-native15-motion3 source
- Tide-root Colossus: motion2, V4-skin1-native22-motion2
- Brine Puffer: V70 gait5 and the exact Puffer-only visual-continuity adapter
- Bellback: unavailable, no body/decision data or exemption included

All four remain unaccepted WIP. Admission into this bounded test arena is not
visual, collider, full-game, animation-quality or physical-phone acceptance.

## Preservation and admission

`pins.json` hashes the exact retained published product, receipt, geometry and
shared assets. `scripts/shared-arena/admission.mjs` reruns the existing individual source gates and
rejects edited pins, wrong species and duplicate content identities. No existing
host, production boot or native Site checkout is modified. Build inputs are read
from an explicitly supplied retained-host directory containing the four existing
`<enemy>-engine` folders.

The build runs the current unchanged SDK validator over all four products. Their
original bytes, AI WASM, actor clocks, strike data and receipts are retained.
Historic validator revisions are not relabelled: any stale receipt receives the
normal runtime validation fallback. Shared arms, material graphs, look data,
pickups, lighting and byte-colliding asset URLs must agree before registration.
Loot entries retain their per-kind predicates and authored counts in one shared
lookup. Puffer contact AO is applied only for that selection and restored for
other selections.

`runtime.ts` is a bounded composition derived from the existing PracticeDemo.
The actual Game, TrainingArena, PracticeCreature, EncounterSession, player,
sword, damage, physics, pose, inventory-free reward and equipment systems are
reused unchanged. No global fetch replacement or broad engine exemption exists.

## Lifecycle and persistence

Start is lazy and serialized. Back retires the encounter and pauses the retained
arena. Start after Back creates a fresh bout in the same game. Change replaces
the old actor before admitting the next; Retry uses its existing real bout reset.
Page teardown disposes the whole game; reload starts at the picker. A failed boot
replaces only the disposed canvas so Start can retry.

Save storage is null, persistence is false, no world session or service worker is
installed, and product loading receives no durable cache. Health and coins are
bout-local. Bellback is a disabled picker entry.

## Reproduction

From the repository root, with existing tool installations:

```sh
SHARED_ARENA_HOSTS=<retained-hosts> node --test scripts/shared-arena/admission.test.mjs
node node_modules/vitest/vitest.mjs run test/shared-arena-page.test.ts
node node_modules/typescript/bin/tsc -p practice/shared-arena/tsconfig.json
HOME="$PWD/tmp/home" WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes" python3 scripts/heavy-lane.py build -- node scripts/shared-arena/build.mjs <retained-hosts> <new-output>
CHROME_PATH="$PWD/tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell" PATH="$PWD/tmp/dot-audit/bin:$PATH" HOME="$PWD/tmp/home" TMPDIR="$PWD/tmp" bash scripts/browser-lane.sh --max 15 node scripts/shared-arena/qa.mjs <new-output> <new-qa-directory>
```

The QA uses a bounded static server and muted portrait cloud Chromium, not a
Vite dev server. It logs diagnostic player positioning; enemies, clocks, health,
AI and damage are not injected. A failed check is reported as failed. The root
coordinator owns publication and the final browser verdict.
