import { practiceFrame } from '../src/shards/nine-dragon-stack/generators/practiceFrame';
// @vitest-environment happy-dom
import PRACTICE_PROGRAM from '../src/shards/nine-dragon-stack/behaviour/practice.generated.json' with {type:'json'};
// oxlint-disable-next-line import/no-nodejs-modules -- Native traversal uses the shipped physics binary.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Vector3, MeshBasicMaterial } from 'three';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { createSimHost } from '@wildshard/engine/sim';
import { tagCollider } from '@wildshard/engine/physics/surface';
import { Scope } from '@wildshard/engine/app/scope';
import { app } from '@wildshard/engine/app/runtime';
import type { PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import { parseGrappleProfile, parseGrappleFilament, type GrappleRows } from '@wildshard/format/grapple';
import type { ShardContext } from '@wildshard/game/plugin/context';
import { GrappleTool } from '@wildshard/game/grapple/tool';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { PracticeCourse } from '@wildshard/game/practice/course';
import { SWORD_WOOD } from '@wildshard/game/weapons/starterMeleeProfile';
import { grappleNeedsLift, grappleLiftTo } from '@wildshard/game/grapple/sim';
import { grappleCourse } from '@wildshard/game/grapple/course';
import { installGrapple } from '@wildshard/game/grapple/headless';
import { lendLooks } from '@wildshard/game/shardfile/lentLooks';
import { Filament, Rope } from '../src/game/grapple/ribbon';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { legacyDouble } from './fake/FakeGame';
import { filamentGeometry } from '../src/shards/nine-dragon-stack/generators/filamentGeometry';
import source from '../src/shards/nine-dragon-stack/data/grappleProfile.json' with { type: 'json' };
import filament from '../src/shards/nine-dragon-stack/data/filament.json' with { type: 'json' };
import room from '../src/shards/nine-dragon-stack/data/grappleCourse.json' with { type: 'json' };

// A made-up quarry drives the same native tool from its own x-axis rail and timing.
const quarry = parseGrappleProfile({ ...source, id: 'tool.quarry-claw', course: {
  name: 'Quarry', mode: { ...source.course.mode, zipSpeed: 14 },
  clearance: { axis: 'x', plane: 0, min: -4, max: 4, base: 0, top: 2, ceiling: 8, owners: ['quarry.rail'] },
}, headless: { step: 'quarry.claw', lock: 'quarry.lock', aim: 'quarry.pitch', eye: 1.68, aspect: 1, portraitFov: 70 },
  fact: { name: 'quarry.crossed', entity: 'quarry.pit', source: 'quarry.crossing' },
  looks: { muzzle: 'quarry.muzzle', bite: 'quarry.bite', dock: 'quarry.dock', sparks: 'quarry.sparks', ribbon: 'quarry.line' },
});

test('two course rows rotate the clearance plane and reject invalid anchors', () => {
  for (const profile of [parseGrappleProfile(source), quarry]) {
    const c = profile.course.clearance; if (c === undefined) throw new Error('Fixture clearance is missing');
    const course = grappleCourse({ ...profile.course, hooks: [] }), axis = c.axis, cross = axis === 'x' ? 'z' : 'x';
    const from = new Vector3(0, c.base, 0), to = from.clone();
    from[axis] = c.plane + 2; to[axis] = c.plane - 2; from[cross] = to[cross] = (c.min + c.max) / 2;
    expect(grappleNeedsLift(course, from, to)).toBe(true);
    expect(grappleNeedsLift(course, to, from)).toBe(false);
    expect(grappleLiftTo(course, from, to)).toBeGreaterThanOrEqual(c.base + 3.5);
  }
  expect(() => grappleCourse({ name: 'bad', hooks: [{ x: Number.NaN, y: 0, z: 0 }] })).toThrow('anchors');
});

test('quarry lock and fire use the real capsule, clear the rail and release the guard', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const rail = host.physics.world.createCollider(rapier.ColliderDesc.cuboid(.2, 1, 4).setTranslation(0, 1, 0));
  tagCollider(rail, 'stone', 'quarry.rail'); host.physics.step();
  host.player.position.set(4, .12, 0); host.player.yaw = Math.PI / 2;
  let commands: ReturnType<Parameters<typeof installGrapple>[1]['commands']> = [];
  const effects: { kind: 'fact'; name: string; actorId: string }[] = [];
  const tick = { commands: () => commands, emit: (effect: { kind: 'fact'; name: string; actorId: string }): void => { effects.push(effect); } };
  const installed = installGrapple(host, tick, quarry, quarry.course.mode ?? { ...source.course.mode, id: 'grapple' }, [{ x: -4, y: 2, z: 0 }], [rail.handle]);
  try {
    commands = [{ kind: 'script', actorId: quarry.headless.lock, value: 1 }]; host.step();
    expect(installed.sim.target).not.toBeNull();
    commands = [{ kind: 'player', jump: true }]; host.step();
    expect(installed.guardOpen()).toBe(true); expect(rail.isEnabled()).toBe(false);
    commands = [];
    for (let frame = 0; frame < 240; frame++) host.step();
    expect(installed.sim.phase).toBe('idle'); expect(installed.guardOpen()).toBe(false); expect(rail.isEnabled()).toBe(true);
    expect(effects).toEqual([{ kind: 'fact', name: 'quarry.crossed', actorId: 'quarry.pit' }]);
  } finally { host.dispose(); }
});

test('quarry ribbon keeps endpoints pinned and uses only its declared look', () => {
  const scope = new Scope('quarry.ribbon'), writes: string[] = [], material = new MeshBasicMaterial();
  lendLooks(scope, { materials: new Map([['quarry.line', material]]), setParam: id => { writes.push(id); }, setTexture: () => undefined,
    bindMeshMap: () => material });
  const rope = new Rope(8), a = new Vector3(1, 2, 3), b = new Vector3(-5, 3, 8);
  const line = new Filament(rope.n, filamentGeometry(rope.n), quarry.looks.ribbon, parseGrappleFilament(filament));
  try {
    rope.reset(a, b); rope.step(1 / 60, a, b); line.update(rope);
    expect(Array.from(rope.p.slice(0, 3))).toEqual(a.toArray()); expect(Array.from(rope.p.slice(-3))).toEqual(b.toArray());
    expect(new Set(writes)).toEqual(new Set(['quarry.line']));
  } finally { line.mesh.geometry.dispose(); material.dispose(); scope.dispose(); }
});

test('quarry practice rows select the equipped native tool and translate their hooks', () => {
  const scope = new Scope('quarry.practice'), previous = app.levelScope, state = app.state;
  app.levelScope = scope;
  const tool = new GrappleTool(legacyDouble<ShardContext>({}), { equipment: { ...SWORD_WOOD, id: 'tool.quarry-claw' },
    profile: quarry, presentation: legacyDouble<GrappleRows>({}), hooks: [] });
  const select = vi.spyOn(tool, 'setGrappleCourse');
  let update: Parameters<PlaygroundHost['game']['onUpdate']>[0] = () => undefined;
  const position = new Vector3(), pads = room.pads.map(pad => ({ ...pad, x: pad.x + 20 }));
  const host = legacyDouble<PlaygroundHost>({
    game: legacyDouble<PlaygroundHost['game']>({
      app: legacyDouble<PlaygroundHost['game']['app']>({ equipment: legacyDouble<NonNullable<PlaygroundHost['game']['app']['equipment']>>({ tools: [tool] }) }),
      onUpdate: run => {update=run;},
    }),
    player: legacyDouble<PlaygroundHost['player']>({ position, velocity: new Vector3(), hover: false, onGround: true,
      setHover: () => undefined, spawn: (x, z, _yaw, y) => { position.set(x, y ?? 0, z); } }),
    registry: legacyDouble<PlaygroundHost['registry']>({ add: piece => piece }),
    spawn: { x: 11, z: -9 }, toast: () => undefined,
  });
  const course = new PracticeCourse(host, legacyDouble<ShardContext>({scope}), {kind:'grapple',layout:{ program:PRACTICE_PROGRAM,frame:practiceFrame({...room,pads}),course: { ...room, title: 'Quarry hook run', pads },
    hooks: [{ pad: 'quarry-hook', x: 3, y: 4, z: 5 }],
    presentation: { parts: [], colliders: [], map: { bounds: { x0: -20, x1: 20, z0: -20, z1: 20 }, shapes: [] } } } });
  try {
    course.enter(); expect(course.entered).toBe(true);
    expect(select).toHaveBeenLastCalledWith({ name: 'Quarry hook run', hooks: [new Vector3(14, 3004, -4)] });
    const start=pads.find(pad=>pad.id===room.run.from);if(start===undefined)throw new Error('Missing start pad');
    expect(position.toArray()).toEqual([host.spawn.x+start.x,3000+start.top,host.spawn.z+start.z+start.d/2-3]);
    const project=vi.spyOn(ReturnProgram.prototype,'project');
    try {for(let frame=0;frame<60;frame++)update(1/60,frame/60);expect(project).toHaveBeenCalledTimes(10);}
    finally {project.mockRestore();}
    course.exit(); expect(select).toHaveBeenLastCalledWith(null); expect(course.entered).toBe(false);
  } finally { select.mockRestore(); course.exit(); scope.dispose(); app.levelScope = previous; app.setState(state); }
});
