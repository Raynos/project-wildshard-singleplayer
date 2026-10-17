/**
 * Pine Hollow's small wildlife (PINE-HOLLOW-REMASTER PH-M5) as an SF59 material graph (SHARD-PLATFORM W2 C2): the raven,
 * the great grey owl, the pileated woodpecker and the snowshoe hare packed in one geometry and drawn as one instanced mesh
 * (runtime/looks/posedInstances.ts, ../models/wildlife.ts WildlifeMesh). The vertex stage turns each part (aInfo.x: the
 * ids in ./wildlifeKinds.ts `P`) about its pivot from the instance's two vec4s — birds (flap, fold, head yaw, head pitch) +
 * (kind, leg tuck, body pitch, pose); the hare (hind legs, fore legs, head pitch, ears back) + (kind, head yaw, –, –) —
 * and collapses another kind's (or the other pose's) vertices to the instance's origin. The surface samples the birds'
 * atlas (lent once they land; a 1×1 stand-in before), takes the per-vertex roughness and lights the owl's eye-shine at
 * night (`glow`). Lit by the standard model, fogged, double-sided.
 */

/** the look.materials id the wildlife wears */
export const WILDLIFE_LOOK = 'pine-wildlife';
