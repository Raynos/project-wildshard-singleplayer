# E2: graph materials' false CSM shadow, diagnosis (sp-o213, 2026-10-14)

Diagnosis lane for SHARD-PLATFORM item E2 (owner sp-x8). It agrees with sp-x8's own finding, and sp-x8 landed the
fix as `78258e147` (fix(render): hoist cascade shadow lookups).

## Root cause

`src/engine/render/nodes/cascadeLightNode.ts`, `EngineDirectionalLightNode.setupDirect`, before 78258e147: the last
cascade's gate is `select(d < centre, shadowed, mix(base, shadowed, ratio))` (for `graphCascade.shadowed`, and the
same shape in `lightColor`). `shadowed` is the light's colour times the shadow node, and the shadow filter
(`tentShadowFilter.ts` / `planeBiasShadowFilter.ts`) builds its statements with `.toVar()` and `If`. TSL turns a `select`
with such branches into `if / else`. The builder caches each node after its first build, so the whole shadow lookup
is emitted inside the **first** branch. The `else` branch only refers to the cached result variable, which is never
assigned on that path. From the generated ground program:

    if ( nodeVar1203 ) {                 // d < centre
      ... 7x7 tent ... nodeVar1204 = nodeVar1219;
      nodeVar1457 = mix( 1.0, nodeVar1204, nodeUniform212 );
    } else {
      nodeVar1457 = mix( 1.0, nodeVar1204, nodeUniform212 );   // nodeVar1204 never assigned here
      nodeVar1198 = mix( base, base * nodeVar1457, ratio );
    }

ANGLE zero-initialises locals, so past the last cascade's centre the shadow reads 0: the surface is in full shade,
fading back to lit toward the far end of the shadow range. That is why the band shows with every caster off, why it
starts at a straight view-depth line, and why it goes away with `receiveShadow` off. The shadow maps, matrices, samplers
and ShadowNode textures were all correct. A per-frame probe showed every light node's captured shadow map equals the
light's live map.

## One cause for all four repros

A definite-assignment scan of every node program's fragment GLSL (scratch tool, `nodeVarN` read where not assigned on
every path) flags exactly this one read and nothing else:

- Driftwood (3 cascades), ground port: all 5 lit toon programs. Repro 1 (ocean) is the same program shape. It wasn't
  re-captured here: the parked ocean commit no longer applies to HEAD.
- Pine Hollow: one sun light, a single cascade, so cascade 0 is also the last. all 10 lit graph programs, the ones with a shadow sampler (crags,
  water, under-fern, …) have the read. Everything past the cascade's centre loses its sun. Repro 3 (upper cliff modules
  near the camera) and repro 4 (waterfall top and far pond) are that far half.

With the shadow colour hoisted to the outer lighting stack (`shadowed.toVar()` before the selects, the same as
78258e147), the scan finds 0 such reads in all 36 programs. The frames confirm the fix:

| repro | before → after (iPhone 16 Pro portrait, midday) |
|---|---|
| 2 Driftwood ground (-60,45,-60 → 20,5,20) | false diagonal shade gone: `progress/shard-platform/e2-graph-shadow-2026-10-14/driftwood-ground-before-after.jpg` |
| 3 Pine crags close (70,165) | upper cliff sunlit like the rest: `…/pine-crag-close-before-after.jpg` |
| 4 Pine falls / pond pose | same cause in the water program; this frame's difference is small (the falls' top is a touch whiter). The far-pond mirror wasn't re-captured: `…/pine-falls-before-after.jpg` |

## Notes for sp-x8

- Any node that reaches both arms of a `select` / `If` in a light or graph hook needs `.toVar()` in the outer stack
  first. GraphLightingModel's toon and lit sun hooks are where it would recur.
- In 78258e147, `this.ghostShadow` caches the `.toVar()` result on the light node, which every material shares. Each
  later build wraps that var in another `.toVar()`. It is harmless but nests one var deeper per build. Caching the bare
  `shadow(ghost)` node and calling `.toVar()` per build would be cleaner.
