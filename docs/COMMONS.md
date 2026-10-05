# Build-time commons

`@wildshard/commons/catalogue` is an author-tool workspace. It imports the defining
pack contract from `@wildshard/sdk/commons`; it cannot import engine, game, kit or
trusted runtime modules. Importing it installs no services.

`createCatalogue(packs)` compiles pinned pack versions into a version-zero
`wildshard.commons` catalogue. Every entry records its stable namespaced id,
SHA-256 hash, kind, actual wire and parsed residency costs, credit and licence.
Pack and entry order do not affect output bytes. Identical assets share one
hash-named owned byte array. Duplicate identities and conflicting asset kinds
are refused. `catalogueRef(catalogue, id)` returns a copied entry and its
`commons:<hash>` reference.

Shard generators, data, quests and `shard.config.ts` may consume these tools at
build time. A shard's `runtime/` cannot reach commons through local helpers,
workspace imports, re-exports or literal dynamic imports. The layer guard follows
that transitive closure, including cycles. The game consumes emitted data and
assets; it never runs commons code.

In `shard.config.ts`, export the compiled `BuiltCommons` as the named build-only
`commons` export. Use `commonsRequirements(commons, entryIds)` from
`@wildshard/sdk/commons` to populate `requires.commons`, `commonsWire` and
`commonsCosts` from selected pinned bytes. It verifies the hash and derives costs
again, so mutable catalogue metadata cannot understate the manifest.

`wildshard build` consumes the named export, verifies every selected pin and
admits its exact header costs. It emits only the default shardfile data and one
hash-named file per selected asset; aliases share a file and unused pack entries
are omitted. Missing or changed pins refuse before output is written. Projects
without the named hook can still supply their existing `commons/<hash>` files.
The package and the build-only named export are never shipped as runtime code.

`@wildshard/commons/scripts` supplies version `0.0.0` source modules for ABI-v0
setup and the shared bridge policy. `bridgeScriptSources()` returns the explicit
virtual source map for the pinned AssemblyScript compiler; imports cannot read
arbitrary host files. The setup owns the fixed input/parameter/effect buffers and
the bridge policy handles static decks, the two-lock winch, raise and saved-state
commands. Both existing shard bridge modules are checked against the shared
policy for exact fields and effects over 10,000 fixed ticks each.

The existing kit's asset migration follows as separate steps. Existing shard
boot paths are unchanged.
