# SF26 / SF54 — build-time commons foundation

Source commits:

| Slice | SHA | Proof |
|---|---|---|
| Workspace/catalogue/boundary | `e2b8cfdb8` | SDK-only pack contract; deterministic catalogue/hash/header costs; hard transitive runtime closure refusal. 44 focused checks and 110 isolated architecture fixtures passed. |
| Pinned manifest requirements | `232ddac08` | Re-derive wire/cost metadata from owned pinned bytes, deduplicate aliases, refuse changed bytes and unknown entries. Five pack tests passed. |
| SDK build hook | `0aadc97ab` | Named build-only `commons` export; two identical builds, one selected hash file, unused entries omitted, missing/changed pins refuse before any output. 23 focused tests passed. |
| Shared AS setup/policy | `2a8d1f8d6` | Explicit virtual modules, pinned compiler, no host-file import fallback. 39 compiler/boundary/shared-policy checks passed. |
| Both shard author wrappers | `9323f19a9` | Driftwood and Sky Reach compile the same shared bridge. 19 mover/boot/shared-policy/real-physics tests passed; zero effect/field differences over 10,000 ticks per shard. |

The shared bridge pin is
`1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd`,
**1,297 wire bytes**, compiled with AssemblyScript 0.28.20, Binaryen 132.0.0 and
`maximumPages: 1`. Original admitted bytes remain the parity oracle. Geometry,
collider primitives, pose constants and legacy raw-hash transport are unchanged.
The author wrappers import virtual AS modules only; no commons TypeScript enters
a runtime closure.

`test/commons-two-shards.test.ts` runs catalogue → manifest → product admission →
the real immutable `ContentCache` → the one residency allocator for two distinct
shards. It proves **one download, one 3-byte cache entry, one 3-byte commons
residency claim with two leases**, then one lease after the first scope leaves and
no claim after the second leaves. Together with the hook and library regression
fixtures, four checks passed. This is the commons sharing seam; actual kit asset
and model migration remains SF54 work.

Reproduction:

```sh
pnpm exec vitest run test/commons-build-hook.test.ts test/sdk-commons-pack.test.ts test/shard-build.test.ts test/commons-cost-admission.test.ts
pnpm exec vitest run test/script/admission.test.ts test/commons-script.test.ts test/commons-boundary.test.ts
pnpm exec vitest run test/commons-script.test.ts test/movers.test.ts test/shards/far-reach/contract.test.ts test/shards/driftwood-isle/bridge-legacy.test.ts
pnpm exec vitest run test/commons-two-shards.test.ts test/shardfile-library-residency.test.ts test/commons-build-hook.test.ts
pnpm exec tsc --noEmit --incremental false
pnpm exec tsc -b tsconfig.layers.json
```

Root strict types, layer declarations and scoped typed lint passed. The
coordinator owns the serialized clean gate/push and the next pinned browser
parity/frame-floor window. Those are still required before plan closure; these
focused proofs do not substitute for them. No owned browser, preview, Simulator,
gate or push remains.

Council-3 SF58 follow-ups landed alongside this foundation:
`b46c74540` exact commons cost leaf, format/export `9aa8527d9` (sp-x5),
`66661398d` existing nonempty fixture migration, `f303e1a64` declared-cost refusal
before immutable reads plus exact actual-header equality, and `76bda4045`
raw graph limits (64,000 UTF-8 bytes, depth 64, all 160 nested nodes including
unreachable and loop bodies). The trusted platform preset's separate budget
cannot widen untrusted material admission. Graph parser/compiler fixtures cover
256 deterministic mutations. Declared-cost admission has eight checks including
zero requests/cache reads on refusal, eleven distinct commons downloads with one
local alias deduplicated, and bounded forged streams; broader format/admission
regressions passed 90/90. Format documentation is `aa49543c2` (sp-x5).
