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
