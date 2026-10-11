# DS1.6 — qualified shared species rest rigs

The qualifying users are the primary Driftwood and Pine shards. Templates and frozen
legacy copies are excluded. This slice qualifies the rest-joint fragment, not a shared
rendered mesh and not native runtime adoption.

`speciesRestPack` is a retained TypeScript generator using the SDK's real GLB readers.
The generator reads a source hull at build time and emits its exact ordered joint names,
parents and model-space rest positions. Both species have twenty joints. The actual
Pine boar, black-bear and brown-bear phone hulls have exactly the same rest fragments as
both native procedural styles. Their meshes are different; those hulls and Driftwood's
procedural toon mesh stay with their owners. Geometry, texture, inverse-bind, animation
and gameplay data are not copied into the rest pack.

`test/commons-species-rest.test.ts` checks all sixty native hull joints against both
procedural styles (120 exact joint comparisons), deterministic regeneration and refusal
of malformed source inputs. Its SF26 fixture admits the two unique rest fragments for
both shards, reads them through the native immutable asset reader, fetches each hash
once, charges each once with two independent leases, then disposes both leases to zero.
This is a product/cache qualification, not a claim that the native body factories now
read these emitted files. No native factory, collider, animation or view changes here.

The native model adoption remains blocked on the original WebP texture contract:
current material admission permits KTX2 only. The lossless Meshopt compiler and the
exact native figure pixel O-check landed in `ac9fd85f7`; no WebP re-encoding, binary-cost
bypass or presentation-image bypass has been used.

Boar rest hash: `0381d4a9d2f89586ddf67f4410531fa6d909e4a188c12e51a5a619470c489ff7`
(1,224 bytes). Both bear hulls produce
`a7e423e14fe58ea32bbb24b980c73d9233c0a7b1962f85412d1bec8c6874b2e4`
(1,222 bytes). The two text-data fragments cost 2,446 resident bytes, zero GPU bytes,
zero triangles and zero draws; no model memory saving is claimed.

Checks on candidate base `fb2fbdafd`: species/SF26 + practice 7/7; touched root typed
lint; four native witness recorder payload/outcome comparisons byte-identical. Root
strict reported only unrelated committed Pine DIR-4 tests importing the deleted
`quest/nightBrain` module (32 diagnostics in `test/ai/night-brain.test.ts` and
`test/shards/pine-hollow/night-continuation.test.ts`); no own source/test diagnostics. No full suite or
additional browser proof is needed for this data-only qualification slice; the existing
labelled figure stills are in `../ds1.6-rig-normalization/`.
