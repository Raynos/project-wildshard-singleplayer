import { expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { installPivotNpc, pivotNpc, type PivotNpcLevel } from '@wildshard/game/plugin/geometry';
import { installQuestNpc } from '@wildshard/game/plugin/ui';
import { parseNpcRow, parseQuestNpcBinding } from '@wildshard/format/npcs';
import { QUEST_NPC as KEEPER } from '../src/shards/far-reach/data/questNpc';
import { QUEST_NPC as SCOUT } from '../src/shards/sunscar-dunes/data/questNpc';

function level() {
  const pieces: Parameters<PivotNpcLevel['piece']>[0][] = [], systems: Parameters<PivotNpcLevel['system']>[0][] = [], events: string[] = [];
  const ctx: PivotNpcLevel = { root: new Group(), piece: piece => { pieces.push(piece); events.push(`piece:${piece.id}`); },
    system: system => { systems.push(system); events.push(`system:${system.id}`); } };
  return { ctx, pieces, systems, events };
}

function isGeometry(input: unknown): input is BufferGeometry { return input instanceof BufferGeometry; }

function scene(group: Group): unknown[] {
  const output: unknown[] = [];
  group.traverse(node => {
    const entry: { position: number[]; rotation: ReturnType<Group['rotation']['toArray']>; scale: number[]; vertices?: number[] } = {
      position: node.position.toArray(), rotation: node.rotation.toArray(), scale: node.scale.toArray(),
    };
    if (node instanceof Mesh) {
      const geometry: unknown = node.geometry;
      if (!isGeometry(geometry)) throw new Error('Expected original NPC geometry');
      const positions = geometry.getAttribute('position');
      entry.vertices = Array.from({ length: positions.count * 3 }, (_, index) => positions.getComponent(Math.floor(index / 3), index % 3));
    }
    output.push(entry);
  });
  return output;
}

it('reproduces both released installations, missing-model policies and ordered frame poses', () => {
  for (const [data, kind] of [[KEEPER, 'keeper'], [SCOUT, 'scout']] as const) for (const loaded of [false, true]) {
    const expected = level(), actual = level(), player = new Vector3(0, 0, 0), source = loaded ? new BoxGeometry(1, 2, 1, 2, 2, 2) : null;
    const material = new MeshStandardMaterial({ roughness: 0.29 });
    let met = false;
    const flags = { has: () => met }, row = parseNpcRow(data.npc);
    const dress = (events: string[]) => (): void => { events.push('dress'); };
    const original = kind === 'keeper' ? pivotNpc(row, source?.clone() ?? null, () => data.ground.height, material) :
      source === null ? null : installPivotNpc(expected.ctx, row, { source: source.clone(),
        material, groundAt: () => data.ground.height, player, met: () => flags.has(), file: data.sourceFile, dress: dress(expected.events) });
    if (kind === 'keeper' && original !== null) {
      expected.ctx.root.add(original.group); dress(expected.events)();
      expected.ctx.system({ id: data.system, phase: 'update', run: (dt, time) => { original.update(dt, time, player, false); } });
    }
    const bound = installQuestNpc(actual.ctx, data, { player, flags,
      model: () => source === null ? null : { geometry: source.clone(), material }, dress: dress(actual.events) });
    expect(bound === null).toBe(original === null);
    expect(actual.events).toEqual(expected.events);
    expect(actual.pieces.map(piece => ({ ...piece, object: undefined }))).toEqual(expected.pieces.map(piece => ({ ...piece, object: undefined })));
    actual.ctx.root.traverse(node => { if (node instanceof Mesh) expect(node.material).toBe(material); });
    if (bound !== null && original !== null) {
      for (const [dt, time, talking, hasMet] of [[0.016, 0, false, false], [0.5, 1, true, false], [0.02, 2, false, true], [0.03, 3, true, true]] as const) {
        met = hasMet; original.speaker.talking = talking; bound.figure.speaker.talking = talking;
        for (const system of expected.systems) system.run(dt, time);
        for (const system of actual.systems) system.run(dt, time);
        expect(scene(actual.ctx.root)).toEqual(scene(expected.ctx.root));
        expect(bound.figure.head.toArray()).toEqual(original.head.toArray());
      }
    }
    source?.dispose(); material.dispose();
  }
});

it('keeps the exact authored query refusal and validates policy before borrowing resources', () => {
  let reads = 0;
  const ports = { player: new Vector3(), flags: { has: () => false }, model: () => { reads++; return { geometry: new BoxGeometry() }; } };
  expect(() => installQuestNpc(level().ctx, { ...SCOUT, update: 'background' }, ports)).toThrow();
  expect(reads).toBe(0);
  expect(() => installQuestNpc(level().ctx, { ...SCOUT, ground: { ...SCOUT.ground, at: { x: 123, z: 456 } } }, ports)).toThrow(SCOUT.ground.error);
  for (const data of [KEEPER, SCOUT]) expect(JSON.stringify(parseQuestNpcBinding(data))).toBe(JSON.stringify(data));
});

it('lends prepared local-frame pivots without fitting or partitioning them again', () => {
  const expected = level(), actual = level(), player = new Vector3(), material = new MeshStandardMaterial();
  const empty = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([], 3));
  const parts = { body: new BoxGeometry(1, 2, 1), head: empty, arm: new BoxGeometry(0.2, 0.7, 0.2), fore: new BoxGeometry(0.2, 0.4, 0.2) };
  const copy = () => ({ body: parts.body.clone(), head: parts.head.clone(), arm: parts.arm.clone(), fore: parts.fore.clone() });
  const original = pivotNpc(parseNpcRow(KEEPER.npc), copy(), () => KEEPER.ground.height, material);
  expected.ctx.root.add(original.group);
  expected.ctx.system({ id: KEEPER.system, phase: 'update', run: (dt, time) => { original.update(dt, time, player, false); } });
  const bound = installQuestNpc(actual.ctx, KEEPER, { player, flags: { has: () => false }, model: () => ({ geometry: copy(), material }) });
  if (bound === null) throw new Error('Prepared keeper must retain its talk anchor');
  expect(actual.events).toEqual(expected.events);
  for (const [dt, time, talking] of [[0.016, 0, false], [0.2, 1, true], [0.03, 2, false]] as const) {
    original.speaker.talking = talking; bound.figure.speaker.talking = talking;
    for (const system of expected.systems) system.run(dt, time);
    for (const system of actual.systems) system.run(dt, time);
    expect(scene(actual.ctx.root)).toEqual(scene(expected.ctx.root));
    expect(bound.figure.head.toArray()).toEqual(original.head.toArray());
  }
  for (const geometry of Object.values(parts)) geometry.dispose();
  material.dispose();
});
