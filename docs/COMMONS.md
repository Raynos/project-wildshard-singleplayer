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

This initial contract provides catalogue compilation only. Product build hooks,
shared behaviour compilation and the existing kit's asset migration follow as
separate steps. Existing shard boot paths are unchanged.
