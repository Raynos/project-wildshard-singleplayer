# W2a Pine client reads, sp-o280 (2026-10-16)

Follow-on to sp-o270's 13 sections. Each step is one commit; the proof ran in the build mirror per batch (cold
`pnpm gen`, root `tsc --noEmit`, `tsc -b tsconfig.layers.json`, sim-in-runtime, the 17 shard-headless checks,
`pine-product-reads`, `pine-output`, `pine-hands-baked`, `pine-runtime-mirrors`, `runtime-mirrors`).

| Step | What | Escapes (runtime-standalone + no-build-time-import) |
|---|---|---|
| Schemas | skinPickups `walkIn` `{ radius, height } \| null`, trophyMounts `own` `'u16' \| 'u32' \| null`, held output `path` string only; o270's runtime bridges dropped | none moved |
| Mirrors | `src/sdk/project.ts` reads `mirrors` from the CLI-only `generators/output.ts` sidecar; Pine declares `RUNTIME_MIRRORS` there | proved only by a `--copy-runtime` build, which Pine cannot do yet (its runtime/ still leaves runtime/) |
| custom/handsPool | baked hands + Longbow rows, hands GLB a named blob | handsGeometry 2 -> 0, crossbowGeometry -1 |
| custom/eliteBrains | retired: no reader (sim input, G453) | section 14 -> 13 |
| custom/kingKit | King kit pool (existing named blob) + lantern spots | models/antlerKing.ts 9 -> 7 |

The boot preload (`data/bootFiles.ts`) dropped the public URLs of every pool whose reader now fetches the product blob
(crossbow, lever details, hands, King kit): they were a second download.

Boot proof: `boot.mjs` (standalone Pine, muted "iPhone 16 Pro" portrait, phone tier) on the elite + King tip
(`9e02ad089`, with the hands pool under it): booted in 11 s, 0 page errors, 0 console errors, crossbow in hand, wildlife
draw up, a 7 m walk. No look change is possible (the section values equal the data rows byte for byte, `pine-output`),
so there is no before / after board.

Left: the bird draw (`runtime/birds.ts`): its atlas `life/birds.glb` embeds its texture, which named-blob admission
refuses ("GLB textures must be separate declared KTX2 assets"), and its rest geometry has a `.phone.glb` tier variant a
hash-named blob would lose, so it needs the atlas as a KTX2 asset and a per-tier blob pair first (tried in a proof
tree, never landed); `boot/files.ts` (a static discovery binding, `(tier) => string[]`, called before any product exists: it needs a
product-aware boot binding in game/engine first); the timber and lookout models (they import `world/timberBake`, which
sp-o278 is moving); the King's collision bake (158 KB of JSON, with `combat/kingRig` sim imports).
