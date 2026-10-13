# Signal C1: static well and glass

The well shell fit/cut, shaft disc, caravan lantern glass and keeper
lantern glass now come from the retained author-only `signal-world`
recipe. The original dry-well GLB is retained in `assets/models/` byte for
byte; the public runtime no longer loads or fits it. Bucket/rope/crank,
fire/halos and native gameplay remain their existing owners.

Ordinary meshes stay ordinary. Their float32 channels, original index
storage, double world transforms and linear HDR material values survive
the piece bake. Instanced kind bytes stay on the original path.
Unsupported ordinary material/mesh state refuses at bake time.

Matched captures: parent `4dbf79594085bcb6b89b53bb92f0d185b4c8deca`
and candidate `66fae0135ccc0252ea20105e1cb9ad7ddf15bfcb`, both built
with the devserver profile. `scripts/w1-c1-parity.mjs compare` passed
all 18 phone/desktop C1 poses: **0 differing pixels**, identical draws,
triangles, GPU bytes, program counts, shader sources and collider hashes.
[Scalar pose comparisons](parity.json) retain the raw draw/triangle counts.
This is a parity proof; no timing credit is claimed.

The official cold `signal-physics --compare` produced the unchanged
`365a787a6e28be24848d656d92b5849527f25855134cccf28fde8006c84071b8`
payload. The official map keeps pixel hash
`ca4baec510649a6d07df3b0621e800e6d331790b1d9640b5211797fb6e9d2e77`;
only its source key changes. Focused tests retain the released fit/cut,
all source attribute arrays, the original frame/stone colliders and
instanced geometry coverage, plus ordinary material/state refusals.

The shared resource owner now uses `ctx.scope.ownPrimitives(root)` on Signal
and `{instances: true}` on Sky. Both shard-local helpers are deleted. A
released-helper oracle proves identical native class tests, geometry/material
and instance ownership, repeated-registration census, disposal order and root
removal. Textures, delegated scene capture and asset acquisition stay with their
existing owners. The explicit presentation adapter leaves pure native scopes
renderer-free; the retained Node world host installs it before rendered builds.
Both native headless/replay/ledger witnesses and both page lifecycle contracts
pass. C1's remaining component inventory stays open; this receipt closes these
static construction and primitive-ownership calls.
