# Named fog in classic post graphs

[Engine API](ENGINE.md) · client-only presentation on the G599 post-graph platform.

A classic scaled post graph may declare `postFog: { name, graph }`. The
named dependency is a `kind: 'fog'` graph with `stages.fog.colour` (vec3)
and explicit `stages.fog.transmission` (float).

A post-only `fogSample` node names that dependency and takes these inputs
in order:

| Input | Type |
| --- | --- |
| Colour | vec3 |
| Engine-fogged colour | vec3 |
| World position | vec3 |
| Camera position | vec3 |
| Fog scale | float |

Its vec4 result contains the fog colour in xyz and the admitted
transmission in w. Both outputs share one function invocation; the
transmission is read directly rather than reconstructed by subtraction.

Each graph retains the existing node/JSON ceilings. Every call spends
its dependency's full instruction cost, including constant-loop trips.
Samplers and numeric array slots share the caller's original ceilings.
The dependency's parameter/array names must be distinct from the
caller's. Scaled post links and typed setters feed both scopes; clone
uniforms and borrowed textures keep their existing ownership.

A private colour/transmission DAG stays inside its select branch, while
an outside reader keeps the call outside. This extends the existing
post-graph platform as classic client-only presentation. The legacy node
compiler refuses this feature explicitly before creating its nodes.

## Preserve intermediate target precision

A post-only `float16` node takes one numeric scalar or vector and keeps
its width. Native half packing/unpacking quantizes each component to
half-float precision. This does not promise the same rounding as storing
to an RGBA16F render target: Metal calibration observed toward-zero
target stores and nearest native packing for the same values. It is available in the
classic and legacy node compilers and spends four estimated arithmetic
units per component under the existing graph budget.

A scaled post target or draw may declare `storage: 'float16'` or
`storage: 'unorm8'`. Omitted storage runs on both. The executor selects
from its actual composer target type and colour-buffer capabilities;
this is data admission, not a user setting. Both format paths must have
valid target dependencies. An active draw cannot read or size from an
inactive target. Inactive targets allocate nothing, and only programs
used by active draws receive frame feeds in opted-in rows. All programs
still precompile during loading.

A composer format change rebuilds opted-in target ownership at the same
size. Ordinary rows retain their existing draw/feed order. These ports
allow an independently qualified fused half-float path while
retaining the original two-pass byte-target fallback; they do not by
themselves activate fusion or establish a pixel/performance result.
