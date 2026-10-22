// oxlint-disable-next-line import/no-nodejs-modules -- The no-shard-nouns check reads the host's own sources.
import { readdirSync, readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test, vi } from 'vitest';
import { Bone, BufferGeometry, Material, Mesh, MeshStandardMaterial, Skeleton } from 'three';
import { zlibSync } from 'fflate';
import { MountedSpecimenSeatSchema } from '../src/format/mountedSpecimenRows';
import { Scope } from '../src/engine/app/scope';
import { SeatedFigure, seatedFigureView } from '../src/game/riding/seatedFigure';

// G603 L10 host bar, tests 2-6, for the riding host's rider seated on a mount, on a made-up lamplighter riding a donkey:
// its own inline shapes, a scene-declared standard coat (no lent look), another joint, speed clock and two cue kinds.
const base64 = (data: Uint8Array): string => btoa(String.fromCodePoint(...data));
function block(x: number): Uint8Array {
  const position = new Float32Array([x, 0, 0, 1, 0, 0, 0, 1, 0]), deltas = new Int32Array([0, 1, 1]);
  const out = new Uint8Array(position.byteLength + deltas.byteLength);
  out.set(new Uint8Array(position.buffer), 0); out.set(new Uint8Array(deltas.buffer), position.byteLength);
  return out;
}
const shape = (key: string, x: number) => ({ key, data: base64(zlibSync(block(x))),
  geometry: { attrs: [['position', 'f32', 3, false]], count: 3, index: 'u16', indexCount: 3, box: true, expand: false } });
const lamplighter = () => ({ mount: 'saddle',
  figure: { version: 1, root: 'rider', materials: [{ kind: 'standard', id: 'coat', properties: { color: 0x334455, roughness: 0.8 } }],
    nodes: [{ kind: 'group', id: 'rider', position: [0, 0.5, 0], children: ['torso', 'lamp'] },
      { kind: 'mesh', id: 'torso', geometry: 'torso', material: 'coat', missing: 'empty' },
      { kind: 'mesh', id: 'lamp', geometry: 'lamp', material: 'coat', missing: 'empty', position: [0.2, 0.4, 0] }] },
  shapes: [shape('torso', 2), shape('lamp', 3)],
  clips: [{ bone: 'rider', channel: 'rotation.x', cases: [{ when: { mem: { key: 'pace', above: 2 } }, sum: [0.1] }, { sum: [0] }] },
    { bone: 'lamp', channel: 'rotation.z', cases: [{ when: { mem: { key: 'swingT', atLeast: 0 } }, sum: [0.5] }, { sum: [0] }] }],
  speed: 'pace', gestures: [{ cue: 'dusk', clock: 'swingT', duration: 0.3 }, { cue: 'greet', clock: 'swingT', duration: 0.3 }] });
const painted = () => ({ ...lamplighter(), material: { look: 'painterly', id: 'coat', rim: 0.3, bands: 0.6 },
  figure: { ...lamplighter().figure, materials: [{ kind: 'port', id: 'coat', source: 'coat' }] } });
const isMesh = (value: unknown): value is Mesh => value instanceof Mesh;
const mesh = (figure: SeatedFigure, index: number): Mesh => {
  const part: unknown = figure.root.children[index];
  if (!isMesh(part)) throw new Error('Missing figure mesh');
  return part;
};

test('a lamplighter seats on its own joint, leans on its speed clock and swings on either cue (tests 3, 5)', () => {
  const scope = new Scope('lamplighter'), figure = new SeatedFigure(v.parse(MountedSpecimenSeatSchema, lamplighter()), scope);
  const saddle = new Bone(); saddle.name = 'saddle';
  figure.attach({ mesh: { skeleton: new Skeleton([saddle]) }, speed: 3 });
  expect(saddle.children).toEqual([figure.root]);
  const coat: unknown = mesh(figure, 0).material;
  if (!(coat instanceof MeshStandardMaterial)) throw new Error('The scene declares a standard coat');
  expect(coat.color.getHex()).toBe(0x334455);
  expect(mesh(figure, 1).geometry.getAttribute('position').getX(0)).toBe(3);
  figure.update(0.1, []); expect(figure.root.rotation.x).toBe(0.1); // the seat's own speed
  figure.update(0.1, [], 0); expect(figure.root.rotation.x).toBe(0);
  figure.update(0, ['rain'], 0); expect(mesh(figure, 1).rotation.z).toBe(0); // an undeclared cue kind does nothing
  for (const cue of ['dusk', 'greet']) {
    figure.update(0, [cue], 0); expect(mesh(figure, 1).rotation.z).toBe(0.5);
    figure.update(0.31, [], 0); expect(mesh(figure, 1).rotation.z).toBe(0.5);
    figure.update(0.01, [], 0); expect(mesh(figure, 1).rotation.z).toBe(0);
  }
  expect(() => { figure.attach({ mesh: { skeleton: new Skeleton() }, speed: 0 }); }).toThrow('joint');
  scope.dispose();
});

test('the rider is client presentation: its scope owns every decoded shape and made material (test 4)', () => {
  const owned: (BufferGeometry | Material)[] = [];
  const view = seatedFigureView(v.parse(MountedSpecimenSeatSchema, painted()), resource => { owned.push(resource); });
  expect(owned.filter(resource => resource instanceof BufferGeometry)).toHaveLength(2);
  const look = owned.find(resource => resource instanceof Material);
  if (look === undefined) throw new Error('The lent look makes the port material');
  const torso: unknown = view.parts.get('torso');
  if (!isMesh(torso)) throw new Error('Missing torso');
  expect(torso.material).toBe(look);
  view.dispose();
  const scope = new Scope('lamplighter'), figure = new SeatedFigure(v.parse(MountedSpecimenSeatSchema, lamplighter()), scope);
  const coat: unknown = mesh(figure, 0).material, shapeGeometry = mesh(figure, 0).geometry;
  if (!(coat instanceof Material)) throw new Error('Missing coat');
  const coatDisposed = vi.spyOn(coat, 'dispose'), shapeDisposed = vi.spyOn(shapeGeometry, 'dispose');
  scope.dispose();
  expect(coatDisposed).toHaveBeenCalled(); expect(shapeDisposed).toHaveBeenCalled();
});

test('seat rows refuse callbacks, unknown looks and malformed looks (test 6)', () => {
  expect(v.safeParse(MountedSpecimenSeatSchema, lamplighter()).success).toBe(true);
  expect(v.safeParse(MountedSpecimenSeatSchema, painted()).success).toBe(true);
  for (const input of [{ ...lamplighter(), build: () => undefined }, { ...lamplighter(), species: 'donkey' },
    { ...painted(), material: { look: 'toon', id: 'coat', rim: 0.3, bands: 0.6 } }, { ...painted(), material: { id: 'coat', rim: 0.3, bands: 0.6 } },
    { ...painted(), material: { look: 'painterly', id: 'coat', rim: Number.NaN, bands: 0.6 } }, { ...lamplighter(), shapes: [] }])
    expect(v.safeParse(MountedSpecimenSeatSchema, input).success).toBe(false);
});

test('the rider host names no shard and no shard-only figure (test 2)', () => {
  const nouns = [...readdirSync('src/shards', { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('_')).map(entry => entry.name), 'shepherd', 'ferryman'];
  expect(nouns.length).toBeGreaterThan(3);
  for (const file of ['src/game/riding/seatedFigure.ts', 'src/game/models/mountedSpecimen.ts', 'src/format/mountedSpecimenRows.ts']) {
    const source = readFileSync(file, 'utf8').toLowerCase();
    expect(nouns.filter(noun => source.includes(noun))).toEqual([]);
  }
});
