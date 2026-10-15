// SHARD-PLATFORM W2 C2 (look-family rows): the island's creatures (crabs, monkeys, boars, bears, the drowned sailors) as
// graph toon looks (`look.materials`, compiled by the runtime with its other looks, runtime/hybrid.ts; worn through their
// species looks' `material`, runtime/looks/creatureLooks.ts). The Drowned Captain keeps its painted classic body.
import type { GraphIr } from '@wildshard/format/materialGraph';

/** the look.materials ids: a creature's body, and the body whose eye faces glow (`aGlow`, the drowned sailor's) */
export const CREATURE_LOOKS = { body: 'driftwood-creature', glowing: 'driftwood-creature-glowing' } as const;

/**
 * A faceted body (the factory's flat facets and per-facet jitter, one group): the vertex paint × the material's own
 * colour (the factory's per-animal tint), matte (roughness 0.85, as the classic body), its emissive the material's own
 * (the hit flash). `glowing`: the eye faces (`aGlow` 1) add `glow` (linear colour × intensity, the species' eye glow,
 * set by the runtime).
 */
function creatureGraph(glowing: boolean): GraphIr {
  return {
    version: 1, kind: 'material', model: 'toon', flatShading: true,
    ...(glowing ? { params: { glow: { type: 'vec3', value: [0, 0, 0], min: 0 } } } : {}),
    nodes: {
      paint: { op: 'vertexColour' }, tint: { op: 'materialColour' }, coat: { op: 'mul', in: ['paint', 'tint'] }, flash: { op: 'materialEmissive' },
      ...(glowing ? { eyes: { op: 'attribute', name: 'aGlow', type: 'float' }, glowP: { op: 'param', param: 'glow' }, eyeGlow: { op: 'mul', in: ['glowP', 'eyes'] }, lit: { op: 'add', in: ['flash', 'eyeGlow'] } } : {}),
    },
    stages: { surface: { colour: 'coat', emissive: glowing ? 'lit' : 'flash', roughness: 0.85, metalness: 0 } },
  };
}

/** The creatures' graphs by look.materials id. */
export const CREATURE_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [CREATURE_LOOKS.body]: creatureGraph(false), [CREATURE_LOOKS.glowing]: creatureGraph(true),
};
