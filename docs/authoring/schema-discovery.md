# Discover declarations before authoring (OS-F3)

Use the installed `wildshard` CLI. No repository source or Valibot implementation knowledge is needed:

```sh
wildshard schema list
wildshard schema shardfile /properties
wildshard schema shardfile /ui
wildshard schema ui.Ui
wildshard schema shardfile /properties/spawn/wrapped/properties
wildshard schema shardfile /properties/creatures/wrapped/properties/spawns/item
wildshard schema groupBrains.GroupBrain /anyOf/1/properties/hearing
wildshard schema shardSections.Spawn /properties/x
```

`schema list` names every published format root and the complete `shardfile`
declaration. A slash path is an RFC 6901 JSON pointer into that document; `~1`
means slash and `~0` means tilde. Missing roots, fields and malformed pointers
refuse, so a typo cannot silently produce an empty schema.

For a whole root section, `schema shardfile /ui` is a convenience spelling for
`/properties/ui`. It returns the defining optional/default wrapper too. Deeper
paths use the explicit declaration structure, for example
`/properties/spawn/wrapped/properties`. `schema ui.Ui` returns the independently
published JSON Schema for the UI value. Unknown sections refuse.

The `shardfile` document describes the actual defining parser, including every
section, strict objects, optional/default wrappers, tuples, alternatives and
admission rules. `properties` contains named fields, `item` an array element,
`items` tuple elements, `alternatives` union branches, and `wrapped` the contained
optional/nullable declaration. `rules` lists bounds, regex sources and semantic
checks. It is discovery data, **not a JSON Schema or an admission substitute**.
Native transformations and checks still run through `parseShardfile` and
`wildshard validate`. Function-valued predicates are labelled by their rule kind
and message; executable code is never serialized.

Other roots are draft 2020-12 JSON Schemas generated from their defining format
contracts. Their `x-wildshard-checks` list mandatory native checks that structural
JSON validation alone cannot prove. The CLI never broadens admission or skips
those checks.

Identifiers have field-specific grammars. Creature IDs currently use
`^[a-z][a-z0-9.:-]*$` (128 UTF-16 code units maximum): `beacon-lit` is valid;
`beaconLit` is not. Combat tags are namespaced, for example `animal.hawk`.
A group brain's hearing tuple has **four** entries, in ascending order.
The player's root `spawn` is `{ x, y, z, yaw }`; a creature's `at` is a three-number
`[x, y, z]` tuple. Inspect the specific field rather than treating one grammar or
coordinate spelling as universal.

In TypeScript, use `schemaDeclaration(ShardfileSchema)` and `schemaAt(document,
pointer)` from `@wildshard/sdk/formatJsonSchema`, as in the retained, executed
[`formatExample`](../../scripts/docs/authoring/format.ts). Import the declaration
you need through its defining public export. Editor **Go to definition** follows
the installed package's `exports.types` location. The SDK tarball places its
own declarations in `dist/types/sdk/` and referenced format declarations in
`dist/types/format/`; it does not promise a top-level `format/creatures.d.ts`.
Do not hard-code a guessed filesystem declaration path. The generated
[SDK guide](../api/SDK.md) and [format reference](../api/FORMAT.md) list exact
module and binding names.

## Find the installed declaration (OS-G4)

Use the public binding name, then follow the installed package's `exports.types`.
The SDK's retained publication map uses these paths relative to its package:

| Binding | Public module | SDK declaration path |
|---|---|---|
| `staticGlb` | `@wildshard/sdk/bake/glb` | `dist/types/sdk/bake/glb.d.ts` |
| `skinnedGlb`, `sampleSkinClip` | `@wildshard/sdk/bake/export` | `dist/types/sdk/bake/export.d.ts` |
| `readRigRest`, `readRigMotion` | `@wildshard/sdk/bake/rig` | `dist/types/sdk/bake/rig.d.ts` |
| Skin contracts | `@wildshard/format/skins` | Follow the format package export; the SDK's referenced copy is `dist/types/format/skins.d.ts` |
| `starterSpearPack`, `spearLoadout` | `@wildshard/commons/packs/spear` | Follow the commons package export; the workspace currently names `packs/spear/pack.ts` |

There is no SDK function named `exportGlb`. Choose `staticGlb` for static primitives
or `skinnedGlb` for a skinned mesh and sampled clips. The executed rig, reader and
spear examples in `scripts/docs/authoring/` use those real exports.

To locate a public module without executing it:

```sh
node --input-type=module -e 'console.log(import.meta.resolve("@wildshard/commons/packs/spear"))'
```

This prints the runtime entry, not a guessed declaration filename. Use the
installed types export or editor Go to definition for types. The source workspace
exports typed source for format and commons; a packaged SDK uses its published
declaration map. Do not assume all three packages share a `dist/types/sdk/` tree,
or replace `.js` with `.d.ts` without checking the map.
