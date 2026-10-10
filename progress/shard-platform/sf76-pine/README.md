# Pine move-back (G303, G306, G307)

Raw shader rows moved from `data/` to `runtime/looks/`, with the same
GLSL and values. Runtime type imports use the game defining modules.

Capture pin: `6d0ddab468024667271c7088443f07ee66e07724`.
- Clean build and standalone boot passed.
- Two independent physics captures matched; every gameplay field equals
  the previous bake (164 actors, 918 trees, 2,078 solid colliders).
- Map image is byte-identical, SHA-256 `e7cc19e10f905c377c9b0a61e64aec5d95dff3eff504198b877b3f058b3dea09`.
- Focused shader, shelter, physics, King-table and map checks: 24 passed.
- Root strict TypeScript and touched type-aware lint passed.

The weapon/viewmodel group remains uncommitted: moving its unchanged
source exposes 92 sealed runtime-performance sites. An exact-source
relocation policy is awaiting approval; no lint rule was weakened.
