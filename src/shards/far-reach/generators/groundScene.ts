import type { PrivateScene, WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { ISLES, KNOLLS } from '../data/layout';
import { ISLE_DRAWS } from '../data/isleLook';
import { ISLE_KEEL_CUT } from '../data/skyIsles';
import { STRINGS } from '../data/strings';
import KNOLL_BAKE from '../data/knolls.json' with { type: 'json' };
import { RISING_ISLETS } from './risingIslets';

/** Ground identities, borrowed island geometry and walkable knoll hulls are authored together. */
export function skyGroundSource(): Uint8Array {
  const names: Readonly<Record<string, string>> = { sunrest: STRINGS.sunrest, windmill: STRINGS.windmill,
    roost: STRINGS.roost, grove: STRINGS.grove, keeper: STRINGS.keeper, ruin: STRINGS.ruin,
    step: STRINGS.step, crown: STRINGS.crown };
  const isles = [...ISLES.map(isle => ({ id: isle.id, node: `isle_${isle.id.replace('.', '-')}`, at: [isle.x, isle.y, isle.z] as const, look: ISLE_KEEL_CUT[isle.id] === undefined ? 'isle-paint-cut' : 'isle-paint-cut-mill' })),
    ...RISING_ISLETS.map(entry => ({ id: entry.gate.id, node: `isle_${entry.gate.id.replace('.', '-')}`, at: [entry.gate.x, entry.gate.y, entry.gate.z] as const, look: 'isle-paint' }))];
  const nodes: PrivateScene['nodes'] = [{ kind: 'group', id: 'ground', children: [] }];
  const imports: WorldSceneRecipe['imports'] = [];
  const registry: { id: string; name: string; category: 'ground'; file: string; surface: 'grass' }[] = [];
  const bindings: { piece: string; part: string }[] = [];
  const file = 'src/shards/far-reach/world/build.ts';
  const looks = [...new Set(isles.map(row => row.look))];
  for (const { id, at, look } of isles) {
    const part = `isle.${id}`, piece = `far.${part}`;
    nodes.push({ kind: 'mesh', id: part, geometry: id, material: look, position: [...at], missing: 'empty', children: [] });
    registry.push({ id: piece, name: names[id] ?? STRINGS.gateIsle, category: 'ground', file, surface: 'grass' });
    bindings.push({ piece, part });
  }
  const colliders = [];
  for (const knoll of KNOLLS) {
    const isle = ISLES.find(row => row.id === knoll.isle), hull = KNOLL_BAKE.hulls.find(row => row.id === knoll.id);
    if (isle === undefined || hull === undefined) throw new Error('Walkable knoll requires its island and hull');
    const part = `knoll.${knoll.id}`, source = `${part}.source`, piece = `far.${knoll.id}.knoll`;
    nodes.push({ kind: 'object', id: part, name: `far.knoll.${knoll.id}`, source, missing: 'refuse', children: [] });
    imports.push({ id: source, kind: 'baked', piece: 'knolls', only: { name: knoll.id } });
    registry.push({ id: piece, name: names[isle.id] ?? isle.id, category: 'ground', file, surface: 'grass' });
    bindings.push({ piece, part });
    colliders.push({ id: piece, colliders: [{ kind: 'hull', x: hull.x, y: hull.y, z: hull.z, points: hull.points, surface: 'grass' }] });
  }
  const root = nodes[0];
  if (root === undefined) throw new Error('Ground scene requires its root');
  root.children = bindings.map(row => row.part);
  const recipe: WorldSceneRecipe = { scene: { version: 1, root: 'ground', nodes, materials: looks.map(id => ({ kind: 'port', id, source: id })), textures: [] }, imports };
  const data = { recipe, isles, looks, registry, bindings, cosmeticDraws: ISLES.length * ISLE_DRAWS };
  return new TextEncoder().encode(`/** Authored ground hierarchy and registry rows; regenerated during the build. */\nexport const SKY_GROUND = ${JSON.stringify(data)} as const;\n/** Walkable hull points remain ordinary numeric rows, not tuple types. */\nexport const SKY_GROUND_COLLIDERS: readonly { readonly id: string; readonly colliders: readonly { readonly kind: 'hull'; readonly x: number; readonly y: number; readonly z: number; readonly points: readonly number[]; readonly surface: 'grass' }[] }[] = ${JSON.stringify(colliders)};\n`);
}
