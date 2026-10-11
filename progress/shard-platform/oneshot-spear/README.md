# OS-F2: equipped commons starter spear

The author API is `@wildshard/commons/packs/spear`: `starterSpearPack(provenance)`
builds the versioned model/contact catalogue; `spearLoadout(builtCatalogue)` checks
its exact closure and returns admitted item rows. The executing author example is
`scripts/docs/authoring/spear.ts::spearExample(slug?)`, returning
`{source, built, model, contacts}` without a game import.

The retained TypeScript generator emits an untextured three-part static GLB.
No generated model is committed. Catalogue identity is `starter-spear@1.0.0`:

| Entry | SHA-256 | Wire bytes | CPU bytes | GPU bytes |
| --- | --- | ---: | ---: | ---: |
| contacts | `0a235f2c86dbc8e8d7b93687f97e189d168c588143382cae8c32751440907023` | 851 | 851 | 0 |
| model | `32352d16720e8aa7db1f620389e392fed6ff1847fdba774a077624880af27f9c` | 7,964 | 7,936 | 4,800 |

Costs come from the actual bytes: 8,815 wire bytes and 13,587 resident bytes for
the complete closure. The ordinary `kit.melee` owner equips the authored model,
uses its light/heavy contact rows and cooldowns, and preserves its fixed-step
continuation. This is a thrust spear, without javelin throwing or animated arms.

`test/commons-spear.test.ts` drives real Rapier contacts: light thrust deals 30,
an immediate repeat is blocked, and the heavy thrust deals 45. The SF26 fixture
admits two separate products through the normal content/product cache: each hash
downloads once, library claims and the parsed model are shared, and the last owner
releases both. Missing or changed catalogue bytes and unresolved models refuse.

Static asset equipment admission/leases landed in `a81941179`; `a94223463`
restores the unrelated ladder fences accidentally reverted by its stale schema
projection. Graphical spear review and the next one-shot's actual rendered brief
proof belong to OS-F9; these Node checks do not claim that browser verdict.
