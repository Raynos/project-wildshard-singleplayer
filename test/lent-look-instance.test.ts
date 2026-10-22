import { expect, test } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { lendLooks, lentLookInstance } from '../src/game/shardfile/lentLooks';

test('a lent graph look gives independent copies, and refuses an unlent look or a lend that makes none', () => {
  const scope = new Scope('copies'), made: Map<string, unknown>[] = [];
  const base = { materials: new Map([['tell', new MeshBasicMaterial()], ['plain', new MeshBasicMaterial()]]), setParam: () => undefined,
    setTexture: () => undefined, bindMeshMap: () => new MeshBasicMaterial() };
  lendLooks(scope, { ...base, instance: (id) => {
    if (id !== 'tell') throw new Error(`No graph catalogue material ${id} to copy`);
    const params = new Map<string, unknown>(); made.push(params);
    return { material: new MeshBasicMaterial(), setParam: (name, value) => { params.set(name, value); } };
  } });
  const a = lentLookInstance('tell'), b = lentLookInstance('tell');
  a.setParam('fill', 0.25);
  expect(a.material).not.toBe(b.material);
  expect(made.map(params => params.get('fill'))).toEqual([0.25, undefined]);
  expect(() => lentLookInstance('plain')).toThrow('No graph catalogue material plain');
  expect(() => lentLookInstance('missing')).toThrow('No lent look missing');
  const other = new Scope('plain');
  lendLooks(other, { ...base, materials: new Map([['old', new MeshBasicMaterial()]]) });
  expect(() => lentLookInstance('old')).toThrow('has no instances');
  scope.dispose(); other.dispose();
  expect(() => lentLookInstance('tell')).toThrow('No lent look tell');
});
