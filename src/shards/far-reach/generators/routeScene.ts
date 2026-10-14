import { parsePrivateScene, type PrivateScene } from '@wildshard/format/clientChannels';
import BRIDGES from '../data/bridgeRest.generated.json' with { type: 'json' };
import REST from '../data/restScenes.generated.json' with { type: 'json' };
import { FALLEN_BRIDGE, NOTES, SPANS, UPDRAFT, WINCH } from '../data/layout';
import { FALLEN_ANGLE } from '../data/moverBindings';
import { STRINGS } from '../data/strings';
import { RISING_ISLETS } from './risingIslets';

/** Place the static spans and board-only updraft in their original world frames. */
export function skyRouteSource(): Uint8Array {
  const root = { kind: 'group' as const, id: 'routes', children: [] as string[] };
  const nodes: PrivateScene['nodes'] = [root];
  const registry = [], bindings = [];
  for (const span of [...SPANS, ...RISING_ISLETS.map(entry => entry.bridge), UPDRAFT]) {
    const hover = span.kind === 'hover', row = hover ? REST.hover.find(entry => entry.id === span.id) : BRIDGES.spans.find(entry => entry.id === span.id);
    if (row === undefined) throw new Error(`Missing route scene ${span.id}`);
    const scene = parsePrivateScene(row.scene), prefix = `${span.id}.`;
    root.children.push(prefix + scene.root);
    for (const node of scene.nodes) {
      nodes.push({ ...node, id: prefix + node.id, children: node.children.map(id => prefix + id),
        ...(node.id === scene.root ? { position: [span.x0, span.y, span.z0],
          rotation: [Math.atan2(span.y1 - span.y, Math.hypot(span.x1 - span.x0, span.z1 - span.z0)), Math.atan2(-(span.x1 - span.x0), -(span.z1 - span.z0)), 0],
          order: 'YXZ' } : {}) });
    }
    registry.push({ id: span.id, name: span.id === UPDRAFT.id ? STRINGS.updraft : hover ? STRINGS.hover : STRINGS.rope,
      category: 'buildings', file: 'src/shards/far-reach/world/build.ts', surface: 'wood', ...(hover ? { mode: 'board' } : {}) });
    bindings.push({ piece: span.id, part: prefix + scene.root });
  }
  const scene: PrivateScene = { version: 1, root: root.id, nodes, textures: [], materials: ['deck', 'posts', 'rails', 'glass', 'frame'].map(id => ({ kind: 'port', id, source: id })) };
  parsePrivateScene(scene);
  const fallen: PrivateScene = { version: 1, root: 'fallen', materials: [], textures: [], nodes: [
    { kind: 'group', id: 'fallen', position: [FALLEN_BRIDGE.x0, FALLEN_BRIDGE.y, FALLEN_BRIDGE.z0],
      rotation: [FALLEN_ANGLE, Math.atan2(-(FALLEN_BRIDGE.x1 - FALLEN_BRIDGE.x0), -(FALLEN_BRIDGE.z1 - FALLEN_BRIDGE.z0)), 0], order: 'YXZ', children: ['deck'] },
    { kind: 'object', id: 'deck', source: 'fallen-deck', missing: 'refuse', children: [] },
  ] };
  const frames = { recipe: { scene: fallen, imports: [] }, bindings: { fallen: { kind: 'group', part: 'fallen' },
    winchAt: { kind: 'vector', value: [WINCH.x, WINCH.y + 1.2, WINCH.z] }, notesAt: { kind: 'vector', value: [NOTES.x, NOTES.y + 1.3, NOTES.z] } } };
  return new TextEncoder().encode(`import type { PrivateScene } from '@wildshard/format/clientChannels';\n/** Static rope spans and hover decks, generated from their authored frames. */\nexport const SKY_ROUTE_SCENE: PrivateScene = ${JSON.stringify(scene)};\n/** Registry identities and board-only policy accompany the scene. */\nexport const SKY_ROUTES = ${JSON.stringify({ registry, bindings })} as const;\n/** Native moving pivot and copied interaction anchors. */\nexport const SKY_ROUTE_FRAMES = ${JSON.stringify(frames)} as const;\n`);
}
