import { fieldstone } from '../src/shards/nalati-grasslands/models/fieldstone';
// oxlint-disable-next-line import/no-nodejs-modules -- hash the original builder bytes
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- read the shipped static bake
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- decode the shipped static bake
import { inflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { Mesh, BufferGeometry, Vector3 } from 'three';
import { WorldRegistry } from '../src/engine/world/registry';
import { modelContext } from '../src/engine/models/model';
import { SkyRig } from '../src/engine/world/skyRig';
import { bakedPlaceAnchors, bakedPlaceSteps, placer, useNalatiPlaces } from '../src/shards/nalati-grasslands/world/placeBake';
import { cragLedge, leopardCave, kurganEntrance, kurganKerb } from '../src/shards/nalati-grasslands/models/campProps';
import { Flutter } from '../src/shards/nalati-grasslands/world/Flutter';
import { unshuffleBodyLanes } from '../src/shards/nalati-grasslands/species/bodies';
import oracle from './fixtures/nalati-static-landmarks.json';

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;
const hash = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
const json = (data: unknown): string => JSON.stringify(data, (_key, value: unknown) => value instanceof Float32Array ? Array.from(value) : value);
const placers = new Map([placer(cragLedge), placer(leopardCave), placer(kurganKerb), placer(kurganEntrance), placer(fieldstone)]);

// Recorded from the deleted live builders over the shipped terrain, before moving any painter.
// Dense world-space floor samples include both sides of the passage, steps, hood, porch and all six ledges.
describe('Nalati static landmark bake', () => {
  it('preserves original geometry, bounds, anchors, colliders and floors exactly', () => {
    useNalatiPlaces(unshuffleBodyLanes(new Uint8Array(inflateSync(readFileSync('public/assets/nalati/baked/places.bin')))));
    const sky: unknown = Object.create(SkyRig.prototype);
    if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
    Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new Vector3(0, 1, 0));
    vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
    const ctx = { sky, ground: () => { throw new Error('Baked landmarks must never sample terrain'); }, flutter: new Flutter(), smoke: { emitter: () => undefined } };
    const rows = oracle.rows.map(expected => {
      const steps = bakedPlaceSteps(expected.name, ctx, placers);
      let result = steps.next();
      while (result.done !== true) result = steps.next();
      const piece = result.value, mesh = piece.object;
      if (!(mesh instanceof Mesh)) throw new Error('Landmark must retain its single mesh');
      const geometry: unknown = mesh.geometry;
      if (!isGeometry(geometry)) throw new Error('Missing landmark geometry');
      const attributes = Object.keys(geometry.attributes).map(name => { const a = geometry.getAttribute(name); return [name, a.itemSize, a.count, hash(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength))]; });
      const registry = new WorldRegistry();
      if (piece.register === undefined) throw new Error('Landmark must retain model registration');
      piece.register({ registry, ctx: modelContext(sky) });
      const pieces = registry.pieceList().map(p => ({ id: p.id, colliders: p.colliders, solidFloor: p.solidFloor, surface: p.surface }));
      const anchors = bakedPlaceAnchors(expected.name), at = anchors.entrance ?? anchors.cave;
      if (at === undefined) throw new Error('Missing landmark anchor');
      const floors: (number | null)[] = [];
      for (let ix = -120; ix <= 120; ix++) for (let iz = -120; iz <= 120; iz++) floors.push(registry.floorAt(at.x + ix / 10, at.z + iz / 10) ?? null);
      for (const ledge of anchors.ledges ?? []) for (let ix = -40; ix <= 40; ix++) for (let iz = -40; iz <= 40; iz++) floors.push(registry.floorAt(ledge.x + ix / 10, ledge.z + iz / 10) ?? null);
      return { name: piece.name, mesh: mesh.name, tris: piece.tris, attributes, box: geometry.boundingBox, sphere: geometry.boundingSphere, anchors,
        colliders: hash(json(piece.colliders)), pieces: hash(json(pieces)), floors: hash(json(floors)) };
    });
    expect(JSON.parse(json(rows))).toEqual(oracle.rows);
  });
});
