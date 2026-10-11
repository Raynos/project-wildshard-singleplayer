import { AnimationClip, BoxGeometry, Group, Scene, TetrahedronGeometry, Vector3, VectorKeyframeTrack } from 'three';
import { expect, it } from 'vitest';
import { readScene, type SceneDescription } from '../src/sdk/scene';
import { restoreSceneGraph } from '../src/sdk/sceneGraph';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { Entry, Portal, SocketLift } from '../src/sdk/entries';
import { PlayerStart, Spawn } from '../src/sdk/spawns';
import { BoxCollider, CapsuleCollider, HullCollider, MeshCollider } from '../src/sdk/physics';
import { AmbienceZone, Cue, Score } from '../src/sdk/sceneAudio';
import { Director } from '../src/sdk/director';
import { Mover } from '../src/sdk/movers';
import { Zipline, Updraft, Mount, Grapple } from '../src/sdk/modes';
import { TEMPLATE_AUDIO } from '../src/shards/_template/data/audio';
import { PASTEL_AUDIO } from '../src/shards/pastel-plain/data/audio';
import { parsePortalLink } from '../src/format/portalLink';
import { parseSocketLift } from '../src/format/socketLift';

function transport(scene: Scene) {
  const before = readScene(scene);
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Actual persisted JSON is the round-trip gate.
  const persisted = JSON.parse(JSON.stringify(before)) as SceneDescription;
  const restored = restoreSceneGraph(persisted), after = readScene(restored);
  expect(after).toStrictEqual(before);
  expect(encodeCanonicalJson(after)).toBe(encodeCanonicalJson(before));
  return restored;
}

it('restores every SDK graph declaration with local parameters, hierarchy and independent recipes', () => {
  const scene = new Scene(), group = new Group(); group.position.set(3, 0, 2); group.scale.setScalar(2); group.rotation.y = 0.2;
  const box = BoxCollider.fromData({ kind: 'box', x: 1, y: 2, z: 3, hx: 1.7, hy: 2.1, hz: 3.3, yaw: 0.3, surface: 'metal' }); box.name = 'box';
  const capsule = new CapsuleCollider(0.6, 2.3, 'grass'); capsule.name = 'capsule';
  const hull = new HullCollider(new TetrahedronGeometry(), 'rock'); hull.name = 'hull';
  const mesh = new MeshCollider(new BoxGeometry(), 'stone'); mesh.name = 'mesh';
  const spawn = new Spawn('blob'); spawn.name = 'blob.1'; spawn.rotation.y = 0.25;
  const cable = new Zipline(new Vector3(0, 5, 0), new Vector3(10, 0, 0), { hang: 1 }); cable.name = 'cable';
  const wind = new Updraft(new Vector3(), new Vector3(0, 10, 8), { width: 3, lift: 2 }); wind.name = 'wind';
  const mount = new Mount({ walk: 1, trot: 2, canter: 3, gallop: 4 }); mount.name = 'mount';
  const grapple = new Grapple({ maxRange: 20 }); grapple.name = 'grapple';
  const body = new Group(); body.name = 'door'; body.position.set(0, 1, 0);
  const mover = new Mover(body, { trigger: { kind: 'interact', permission: 0 }, driver: { kind: 'track' },
    clip: new AnimationClip('open', 2, [new VectorKeyframeTrack('door.position', [0, 2], [0, 1, 0, 0, 3, 0])]) });
  group.add(box, capsule, hull, mesh, cable, wind, mount, grapple, mover);
  scene.add(group, spawn, new PlayerStart(), ...Entry.midpoints());
  const director = new Director({ id: 'door.flow', inputs: { open: 'flag:door.open' }, stages: [{ id: 'closed' }, { id: 'open', when: 'open', do: [{ emit: 'door.open' }] }] });
  director.attachTo(scene);
  try {
    const restored = transport(scene);
    for (const [name, constructor] of [['box', BoxCollider], ['capsule', CapsuleCollider], ['hull', HullCollider], ['mesh', MeshCollider], ['blob.1', Spawn], ['player', PlayerStart], ['entry.north', Entry], ['cable', Zipline], ['wind', Updraft], ['mount', Mount], ['grapple', Grapple]] as const) expect(restored.getObjectByName(name)).toBeInstanceOf(constructor);
    let restoredMover: Mover | undefined;
    restored.traverse(object => { if (object instanceof Mover) restoredMover = object; });
    if (restoredMover === undefined) throw new Error('Missing mover');
    expect(restoredMover.body).toBe(restoredMover.children[0]);
    expect(restoredMover.toMotionData()).toStrictEqual(mover.toMotionData());
    const restoredDirector: unknown = restored.getObjectByName('door.flow')?.userData['director'];
    expect(restoredDirector).toBeInstanceOf(Director);
    if (!(restoredDirector instanceof Director)) throw new Error('Missing director');
    expect(restoredDirector.toJSON()).toStrictEqual(director.toJSON());
    const restoredGrapple = restored.getObjectByName('grapple');
    if (!(restoredGrapple instanceof Grapple)) throw new Error('Missing grapple');
    restoredGrapple.options.maxRange = 30; expect(grapple.options.maxRange).toBe(20);
  } finally { hull.geometry.dispose(); mesh.geometry.dispose(); }
});

it('restores exact portal and socket-lift subclasses, not ordinary midpoint entries', () => {
  const portal = parsePortalLink({ road: { id: 'road', at: [0, 0, 240], floor: 'road-floor' }, destination: { id: 'arrival', at: [0, 12, 20], floor: 'arrival-floor' }, exit: { id: 'exit', at: [0, 12, 24], floor: 'exit-floor' }, links: [{ from: 'road', to: 'arrival' }, { from: 'exit', to: 'road' }], route: [[0, 12, 20], [0, 12, 24]] });
  const lift = parseSocketLift({ mover: 'lift', gate: 'gate', roadStop: [240, 0, 0], topStop: [240, 12, 0], route: [[240, 12, 0], [220, 12, 0]], rideTicks: 120, approach: { colliders: ['floor'], route: [[238, 0, 0], [240, 0, 0]] } });
  const scene = new Scene(); scene.add(new Portal('north', portal), new SocketLift('east', lift));
  const restored = transport(scene);
  expect(restored.getObjectByName('entry.north')).toBeInstanceOf(Portal);
  expect(restored.getObjectByName('entry.east')).toBeInstanceOf(SocketLift);
});

for (const [name, recipe] of [['Template 1', TEMPLATE_AUDIO], ['Pastel Plain', PASTEL_AUDIO]] as const) it(`${name}: restores audio classes with original profile bytes and no duplicate graph cues`, () => {
  const scene = new Scene(); scene.add(Score.fromData(recipe));
  const restored = transport(scene); expect(readScene(restored).audio).toStrictEqual(recipe);
  expect(restored.getObjectByName('audio')).toBeInstanceOf(Score);
  restored.traverse(object => { if (object instanceof Cue) expect(object.toCueData()).toBeDefined(); });
});

it('retains a transformed ambience recipe locally, applying parent scale exactly once after restore', () => {
  const scene = new Scene(), group = new Group(); group.position.x = 10; group.scale.setScalar(2);
  const zone = new AmbienceZone({ id: 'camp', x: 1, z: 2, inner: 3, outer: 5, gain: 0.8, source: 'forest' });
  group.add(zone); scene.add(group, new Score({ ...TEMPLATE_AUDIO, cues: [], zones: { id: 'forest', smoothSeconds: 0.1, tickHz: 30, silentSeconds: 5, holdSeconds: 1, levels: { forest: 1 }, wet: {}, zones: [] } }));
  const restored = transport(scene); expect(restored.getObjectByName('camp')).toBeInstanceOf(AmbienceZone);
});

it('refuses a mover reference outside its own graph child rather than silently inventing a body', () => {
  const scene = new Scene(), body = new Group(); body.name = 'door';
  const mover = new Mover(body, { trigger: { kind: 'always' }, driver: { kind: 'static' } }); scene.add(mover);
  const data = readScene(scene), row = data.nodes.find(node => node.declaration?.kind === 'mover');
  if (row?.declaration?.kind !== 'mover') throw new Error('Missing mover recipe');
  row.declaration.body = data.nodes[0]?.id ?? '';
  expect(() => restoreSceneGraph(data)).toThrow('Mover body must be its graph child');
});
