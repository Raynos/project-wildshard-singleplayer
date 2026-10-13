# Generated outputs (G405)

Cheap means a complete retained producer cold-rebuilds below 30 seconds
(G318). A cache hit is not cold evidence. Cheap files are ignored and built
by `pnpm gen` before CI typechecks/tests and Vercel/deploy builds. Their
check runs a fresh isolated producer and requires every declared output;
there is no historical committed-byte baseline. The content cache still
verifies its own output hashes against its exact source/toolchain key.

| Cheap producer | Measured cold seconds |
|---|---:|
| driftwood-director | 0.633 |
| pine-clock-director | 0.561 |
| signal-skitterer-behaviour | 0.592 |
| pine-elite-behaviours | 0.659 |
| nalati-weapon-hooks | 0.548 |
| driftwood-ground | 0.155 |

The script index, generator inventory and shard vocabulary are also build
outputs. Pre-commit generates ephemeral inputs for source guards but does
not stage these cheap files, native physics/spots, or page maps. Pushes
restore verified ephemeral inputs and do not stage or regenerate outputs.
The following pipelines already run `pnpm gen` before their readers:
CI typecheck/lint and Vitest; CI checks/build; `pnpm build` on Vercel;
release native/web builds and the exact-SHA boot smoke.

Served GPU maps stay committed: their cold producer includes a complete
app build and capture, above 30 seconds. Navmesh, voxel AO, GPU/tool bakes
and recorded gameplay witness baselines retain their exact checks. Policy
ratchets and graph ceilings remain source policy, not disposable docs.
Unknown-cost outputs get no cheap designation. Existing admitted cache
products remain cache products; this migration does not re-add them.

Seeded jobs remain committed because their retained output is a real input:

- `driftwood-fixed-models`
- `pine-beaver-pool`
- `pine-cabins`
- `pine-crags`
- `pine-lookout`
- `pine-props`
- `pine-site-timbers`
- `pine-streams`
- `pine-undergrowth`
- `pine-wildlife`
- `nalati-bodies`
- `nalati-places`
- `sky-world`

Removing a seeded output requires splitting its real authoring input first.
Cheap output deletion instead requires the retained self-contained job,
an actual cold producer success below 30 seconds, complete regular output
files, and an unchanged parent/index. Expensive removals still require
the existing byte-exact complete-product clean-room proof.
