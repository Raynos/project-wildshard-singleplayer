import { expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { installDeclaredQuestNpc, installQuestNpc } from '@wildshard/game/plugin/ui';
import type { PivotNpcLevel } from '@wildshard/game/plugin/geometry';
import sky from '../src/shards/far-reach/shard.config';
import signal from '../src/shards/sunscar-dunes/runtime/source';
import { QUEST_NPC as KEEPER } from '../src/shards/far-reach/data/questNpc';
import { QUEST_NPC as SCOUT } from '../src/shards/sunscar-dunes/data/questNpc';

function level() {
  const pieces: Parameters<PivotNpcLevel['piece']>[0][] = [], systems: Parameters<PivotNpcLevel['system']>[0][] = [], events: string[] = [];
  const ctx: PivotNpcLevel = { root: new Group(), piece: piece => { pieces.push(piece); events.push(`piece:${piece.id}`); },
    system: system => { systems.push(system); events.push(`system:${system.id}`); } };
  return { ctx, pieces, systems, events };
}

function pose(root: Group) {
  const rows: { position: number[]; rotation: ReturnType<Group['rotation']['toArray']>; scale: number[] }[] = [];
  root.traverse(node => { rows.push({ position: node.position.toArray(), rotation: node.rotation.toArray(), scale: node.scale.toArray() }); });
  return rows;
}

it('publishes the released keeper and scout rows through the admitted products', () => {
  for (const [source, row] of [[sky, KEEPER], [signal, SCOUT]] as const) {
    expect(source.runtime?.binds).toContain('quests');
    expect(JSON.stringify(source.questNpcs)).toBe(JSON.stringify([row]));
    expect(source.questNpcs?.map(binding => binding.npc.id)).toEqual([row.npc.id]);
  }
});

it('keeps ordered installations, missing resources and live motion exact through the root lookup', () => {
  for (const [source, row] of [[sky, KEEPER], [signal, SCOUT]] as const) for (const loaded of [false, true]) {
    const released = level(), declared = level(), material = new MeshStandardMaterial(), player = new Vector3();
    let met = false;
    const ports = (events: string[]) => ({ player, flags: { has: () => met },
      model: () => loaded ? { geometry: new BoxGeometry(1, 2, 1), material } : null,
      dress: () => { events.push('dress'); } });
    const before = installQuestNpc(released.ctx, row, ports(released.events));
    const after = installDeclaredQuestNpc(declared.ctx, source, row.npc.id, ports(declared.events));
    expect(after === null).toBe(before === null);
    expect(declared.events).toEqual(released.events);
    expect(declared.pieces.map(piece => ({ ...piece, object: undefined }))).toEqual(released.pieces.map(piece => ({ ...piece, object: undefined })));
    declared.ctx.root.traverse(node => { if (node instanceof Mesh) expect(node.material).toBe(material); });
    if (before !== null && after !== null) for (const [dt, time, talking, hasMet] of [[0.016, 0, false, false], [0.5, 1, true, false], [0.02, 2, false, true]] as const) {
      met = hasMet; before.figure.speaker.talking = talking; after.figure.speaker.talking = talking;
      for (const system of released.systems) system.run(dt, time);
      for (const system of declared.systems) system.run(dt, time);
      expect(after.figure.head.toArray()).toEqual(before.figure.head.toArray());
      expect(pose(declared.ctx.root)).toEqual(pose(released.ctx.root));
    }
    for (const state of [released, declared]) state.ctx.root.traverse(node => {
      if (node instanceof Mesh) {
        const geometry: unknown = node.geometry;
        if (!(geometry instanceof BufferGeometry)) throw new Error('Expected released NPC geometry');
        geometry.dispose();
      }
    });
    material.dispose();
  }
});
