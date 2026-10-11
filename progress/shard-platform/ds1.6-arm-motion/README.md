# DS1.6: exact shared arm animation data

The retained Driftwood and Nine GLBs contain sixteen identical animation clips after
Meshopt decoding. The `vm_root` and fourteen base arm local transforms also match.
`starterArmMotionPack` is the readable build-time TypeScript generator: source GLB
→ standard Three clips → immutable canonical data. No generated payload is committed.

The two actual users are Driftwood and Nine; template and frozen copies are excluded.
The source generator at `src/shards/driftwood-isle/blender/fp-arms/bake.mjs` deliberately
copies Nine's sixteen curves, adds fingers/swim, and changes the weapon offset. The
pack preserves the curves and base transform fragment only. Distinct meshes, skins,
weapon bind, fingers and swim remain shard-owned; this is not a whole-rig equivalence.

Focused proof compares every decoded Float32 time/value, target and interpolation,
then rebuilds Three clips without optimization or resampling. SF26 admits all seventeen
hash-addressed assets through two real consumer identities: one download and one data
claim per hash, independent leases 2 → 1 → 0. Binary costs describe retained pack bytes;
no playback allocation or production network saving is claimed. Native runtime adoption,
actual shared meshes and other species model packs remain open.

Validation: fourteen focused tests in four files, root strict and touched typed lint.
Both real author projects also compile the seventeen shared assets, identical requirements
and a validation receipt through the SDK CLI/project path. Four renderer-free native
witness recordings preserve every payload and outcome. The whole-tree ratchet currently
reports unrelated committed Pine/Driftwood/frozen-legacy debt; this slice adds no debt.
Downward imports: commons → SDK +3. No renderer, browser, Simulator or shipped look change.
