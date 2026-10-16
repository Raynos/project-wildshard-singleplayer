# G453 sim-in-runtime baseline

`runtime/` is client-only. Existing server code is migration debt; new server
logic belongs in platform sections and hosts or Wasm, not in this directory.

The baseline was measured from immutable candidate `d8c79c43d` using
`node scripts/sim-in-runtime.mjs --json`. It follows transitive **value-module**
dependencies from `runtime/headless.ts` and exported `prepareHeadlessRuntime`
factories. The latter keeps a renamed/moved native entry visible. Walking may
cross other folders within the shard; only reached `runtime/` source files count.
Type-only edges erase and do not count. Literal lazy imports, `require`, and
relative globs count. Computed imports and unresolved value imports refuse.
Registered frozen snapshots remain historical and are excluded.

| Shard | Reached runtime files |
|---|---:|
| Driftwood | 12 |
| Pine | 28 |
| Sky | 1 |
| Signal | 1 |
| Nalati | 25 |
| Nine | 9 |
| Template, Blender Template, Pastel Plain, Ink Cel Valley | 0 each |

This is a conservative module-level proxy, not a statement-level classifier:
every reached module counts even if some of its exports are client-only. It
does not claim that a new statement inside an existing debt module increases
the file count. G453 still prohibits adding such server logic.

`lint/ratchet.json` records both per-shard count ceilings and exact file
identities. A new identity refuses even when another file was removed, so it
cannot spend freed room. Removing reach requires lowering its count and deleting
the retired allowance in the same commit. No automatic upward rebaseline exists.

`check-graph` enforces this before every CLI mode, including `--source-only`,
already used by pre-commit, the push gate and CI. Focused tests exercise value vs
type-only reach, cycles, lazy imports, renamed entries, unknown paths, growth,
replacement identities, and mandatory shrinking. Three cases, typed lint and
the real source graph check pass in the immutable check3 mirror. No gameplay or
source runtime is changed by this tooling slice.
