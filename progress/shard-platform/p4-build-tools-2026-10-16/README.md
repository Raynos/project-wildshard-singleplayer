# P4: G456 H2 build tools and G454 AS visibility

H2 removes only `src/sdk/bake/**` and `src/sdk/project.ts` from G294
whole-module and per-export shard attribution. Runtime SDK modules, nearby
path names and transitive runtime dependencies remain counted. No code was
deleted and no host gained a shared-user credit.

The production ruler still uses its pre-P4 source input until real closed
runtime outputs exist. This narrow policy is also required by the output
ruler. The full output switch and G390 rebaseline are not claimed here.

Matched basis: `a46e09c182b2b49ec2c3d0b215b5ec6ff9abc2c9`. Measure twice on the same immutable tree,
with only the H2 path filter disabled in the before pass. Source, generated
inputs, frozen denominators and pending-user decisions are identical.

| Shard | Before custom lines | After | H2 delta | AS lines | 10% legacy AS budget |
|---|---:|---:|---:|---:|---:|
| _template | 725 | 725 | +0 | 94 | no frozen denominator |
| blender-template | 116 | 116 | +0 | 23 | no frozen denominator |
| driftwood-isle | 13263 | 13263 | +0 | 40 | 1716 |
| far-reach | 6075 | 6064 | -11 | 18 | 677 |
| ink-cel-valley | 1917 | 930 | -987 | 94 | no frozen denominator |
| nalati-grasslands | 30045 | 29645 | -400 | 162 | 2837 |
| nine-dragon-stack | 16258 | 16258 | +0 | 0 | 2111 |
| pastel-plain | 736 | 736 | +0 | 94 | no frozen denominator |
| pine-hollow | 18308 | 18225 | -83 | 270 | 2130 |
| sunscar-dunes | 1794 | 1794 | +0 | 67 | 412 |

Pine retains all 79 lines of `bodylessForager` after the coordinator's
G456 audit-credit reversal (`df7c847c2`). Neither that credit nor the two
removed redundant `bakedTerrainField` entries is restored. The JSON receipt
lists every removed tool span and the retained forager declarations.

G454 adds `assemblyScriptBudget` beside custom percentage in JSON and text.
Its ceiling is `floor(frozenLegacyLines / 10)`. Native shards without a
frozen denominator report no ceiling. Excess is visible but **report-only**:
AS does not enter the custom TS numerator and does not change `checkShares`.

Validation: 22 focused cases across build-tool attribution, namespace reach,
pending users and G453; full root TypeScript and typed script/fixture lint
green on an immutable parent containing the moved-import fixes. Fixtures
cover whole files, sole declarations in shared files, exact path scope,
runtime dependencies and a deliberately over-budget AS case that does not gate.
