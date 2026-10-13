import { DUNE_CREATURE_LOOKS } from '../../../src/shards/sunscar-dunes/world/meshes';

function look(kind: string) {
  const found = DUNE_CREATURE_LOOKS.find(row => row.kind === kind);
  if (found === undefined) throw new Error(`Missing shipping look ${kind}`);
  return found;
}
export const DUNE_RAY_LOOK = look('duneRay');
export const SAND_SKITTERER_LOOK = look('sandSkitterer');
export const DUNE_STRIDER_LOOK = look('duneStrider');
export const DUNE_MATRIARCH_LOOK = look('duneMatriarch');
