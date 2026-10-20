import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, MeshBasicMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { modelContext } from '../src/engine/models/model';
import { ClientChannels } from '../src/sdk/clientChannels';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { bindWorldSceneModelSources, defineWorldSceneCatalogue } from '../src/game/models/worldSceneCatalogue';

test('projected copies keep time-zero placement, names and their independent clocks', () => {
  const program = (id: string, offset: number) => {
    const row = new ClientChannels(id);
    row.output('x', row.binary('add', row.clock('time'), row.constant(offset)));
    row.output('y', row.constant(2)); row.output('z', row.constant(3)); row.output('yaw', row.constant(.25));
    return row.build();
  };
  const rows = parseWorldSceneModels({ product: 'harbour', models: [{ key: 'cart', id: 'harbour/cart', name: 'Cart', category: 'props', pipeline: 'code', file: 'models/cart.ts', defaults: {}, assembly: 'parts',
    choices: [{ id: 'base', params: {}, size: [1, 1, 1], colliders: [], draws: [{ id: 'body', library: 'bakes', model: 'cart', material: 'paint' }] }] }],
    projections: [{ id: 'carts', key: 'cart', name: 'moving-carts', programs: [program('first', 4), program('second', 8)] }],
  });
  const owner = new Scope('projected-copies'), ctx = modelContext(null), parent = new Group();
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const material = new MeshBasicMaterial();
  try {
    bindWorldSceneModelSources(ctx, 'harbour', { catalogue: rows, geometries: new Map([[JSON.stringify(['bakes', 'cart']), geometry]]), materials: new Map([['paint', material]]) }, owner);
    const catalogue = defineWorldSceneCatalogue(rows), copies = withOwner(owner, () => catalogue.project('carts', ctx, parent));
    expect(copies.map(copy => copy.body.position.toArray())).toEqual([[4, 2, 3], [8, 2, 3]]);
    expect(copies.every(copy => copy.body.name === 'moving-carts')).toBe(true);
    for (const copy of copies) copy.advance(5);
    expect(copies.map(copy => copy.body.position.toArray())).toEqual([[9, 2, 3], [13, 2, 3]]);
    expect(copies.map(copy => copy.body.rotation.y)).toEqual([.25, .25]);
    expect(() => catalogue.project('absent', ctx, parent)).toThrow('Missing admitted model projection');
    expect(() => parseWorldSceneModels({ ...rows, projections: [{ ...rows.projections?.[0], key: 'missing' }] })).toThrow('admitted models');
  } finally { owner.dispose(); geometry.dispose(); material.dispose(); }
});
