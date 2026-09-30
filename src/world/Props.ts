// Pine Hollow's forest props moved to src/chunks/pine-hollow/world/props.ts (E315 M2: the boulders, stumps and logs are
// models in src/chunks/pine-hollow/models/). This re-export keeps scripts/bake-navmesh.mjs byte-identical (its bytes are
// part of every shard's navmesh hash); M6 removes it with the other old paths.
export { Props } from '../chunks/pine-hollow/world/props';
