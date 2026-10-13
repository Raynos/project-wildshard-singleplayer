# Sky prepared hero geometry — W1 C1

The retained author-only generator emits all 21 normalized, statically fitted
hero geometries as a standard GLB. Original painted textures, samplers and KTX2
selection stay unchanged. Native per-vertex normalization, normal generation
and tree/isle/crown/lectern/post fitting are deleted.

The independent former-native oracle verifies every position, normal, UV and
UInt32 index exactly, plus all fitted spheres; repeated GLB bytes are identical.
GLTFLoader uses box-diagonal spheres by default. The bake therefore carries
the exact native spheres in node extras, preserving frustum admission.

Fresh parent `87a3d830a` and candidate `dc53beae5` pass all 18 phone/desktop
poses: **0 differing pixels**, with identical draws, triangles, GPU bytes,
programs, shader sources and colliders. Official map pixels remain
`11d9b03cd3eea5c36a234e711c42063b8f9718276e4c8008faf4386a9fd57bf6`.

CALL: store exact native culling spheres alongside plain standard GLB
accessors; bind that generated GLB into the map key. No native geometry
processing fallback remains. The GLB is a cheap build-time output, uncommitted.

C1 remains open: Signal well shell/basic materials and remaining static
world ownership are separate slices. This is no timing or physical-phone claim.

The generic SDK emitter owns confined byte I/O; the shard recipe imports no
Node modules. Thirteen real isolated-loader checks retain every old refusal
and cover exact byte emission, escaped reads and wrong output types.
