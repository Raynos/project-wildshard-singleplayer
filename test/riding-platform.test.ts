// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { PerspectiveCamera, Vector3, SkinnedMesh } from 'three';
import { app as pageApp } from '@wildshard/engine/app/runtime';
import { PracticeCourse } from '@wildshard/game/practice/course';
import type { ShardContext } from '@wildshard/game/plugin/context';
import type { PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import { horseCourseRows } from '../src/shards/nalati-grasslands/generators/courseScene';
import { App } from '@wildshard/engine/app/app';
import { Scope } from '@wildshard/engine/app/scope';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { Player } from '@wildshard/engine/player/Player';
import { playerModes } from '@wildshard/engine/player/modes';
import { overrideTerrain } from './fake/terrain';
import type { HerdBrain } from '@wildshard/engine/ai/herd';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { DiscOpts } from '@wildshard/engine/ui/hudSlots';
import { RidingControlsSchema, type RideHudState, type MountProfile } from '@wildshard/format/riding';
import { parse } from 'valibot';
import { createPageRiding, respawnPageMounted, RidingActions, type PageTamingOwner, type PageRidingRows, type PageRidingOwners } from '@wildshard/game/riding/client';
import fixturePrograms from '../src/shards/nalati-grasslands/behaviour/riding.generated.json' with { type: 'json' };
import { Mount } from '@wildshard/game/riding/mount';
import { RideHUD } from '@wildshard/game/riding/hud';
import { legacyDouble } from './fake/FakeGame';

function fixture(kind: string, speeds: MountProfile['speeds'], registerMode = true): { player: Player; animals: AnimalManager; mount: Mount; actor: Animal; scope: Scope; ctx: LevelContext; camera: PerspectiveCamera; slots: DiscOpts[]; widgets: string[] } {
  const scope = new Scope('riding-fixture'), app = new App(), camera = new PerspectiveCamera(), slots: DiscOpts[] = [], widgets: string[] = [];
  scope.onDispose(overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 }));
  const ctx = legacyDouble<LevelContext>({ app, scope, hud: {
    disc: (row: DiscOpts): HTMLButtonElement => { slots.push(row); const button = document.createElement('button'); button.className = row.cls; return button; },
    widget: (band: string, _el: HTMLElement, order: number): void => { widgets.push(`${band}:${String(order)}`); },
    relabel: (): (() => void) => () => undefined, verb: (): void => undefined, pin: (): void => undefined,
  } });
  const player = legacyDouble<Player>({ camera, position: new Vector3(), velocity: new Vector3(), keys: new Set<string>(), touchMove: { x: 0, y: 0 }, touchJump: false, moveScale: 1,
    onGround: true,
    yaw: 0, pitch: 0, crouching: false, hover: false, swimming: false, wading: false, ride: null,
    setHover: (): void => undefined, setBodyEnabled: (): void => undefined });
  const actor = legacyDouble<Animal>({ entityId: 'fixture.mount', kind, variant: 'starter', alive: true, hidden: false, hp: 100, maxHp: 100,
    yaw: 0, speed: 0, state: 'idle', lookWeight: 0, gaitPhase: 0, scale: 1, seed: .5, position: new Vector3(3, 0, 5), lookTarget: new Vector3(), mem: {}, mesh: new SkinnedMesh(),
    setMotion: (): void => undefined });
  const animals = legacyDouble<AnimalManager>({ animals: [actor] });
  if (registerMode) playerModes(player).register({ id: 'ride', hud: 'ride' }, scope);
  return { player, animals, mount: new Mount(ctx, player, animals, { speeds, names: {}, thrownDamage: 7, thrownLabel: 'Thrown', restAt: { x: 3, z: 5 } }), actor, scope, ctx, camera, slots, widgets };
}

test.each([
  ['horse', { walk: 1.8, trot: 4.5, canter: 8.5, gallop: 13 }],
  ['fixture-mule', { walk: 1, trot: 3, canter: 5, gallop: 8 }],
] as const)('G478 fixture rows drive registration, riding and naming for %s', (kind, speeds) => {
  const f = fixture(kind, speeds), id = f.actor.entityId;
  try {
    f.mount.addMountable(id, 'Companion');
    f.mount.rename(id, 'Juniper');
    expect(f.mount.nameOf(id)).toBe('Juniper');
    expect(f.mount.mount(id)).toBe(true);
    expect(f.mount.mount(id)).toBe(false);
    expect(f.mount.drainEvents()).toEqual([{ kind: 'mount', horse: id }]);
    expect(f.mount.panic(-10, -10, 2)).toBe(true);
    expect(f.mount.drainEvents()).toEqual([{ kind: 'panic', horse: id, seconds: 2 }]);
    f.mount.dismount(true);
    expect(f.mount.drainEvents()).toEqual([{ kind: 'thrown' }, { kind: 'mount', horse: null }]);
    expect(f.mount.mounted).toBe(false);
    f.mount.removeMountable(id);
    expect(f.mount.mountables).toEqual([]);
    expect(() => f.mount.addMountable('foreign', 'No')).toThrow();
  } finally { f.mount.dismount(); f.scope.dispose(); }
});

test('HUD accepts a fictional second shard observation and retains the baseline slots and strings', () => {
  const f = fixture('fixture-mule', { walk: 1, trot: 3, canter: 5, gallop: 8 });
  const root = document.createElement('div'); root.id = 'hud'; document.body.append(root);
  try {
    const hud = new RideHUD(f.ctx, f.camera, { tagRange: 45, tagHeight: 1.8 });
    const state: RideHudState = { mounted: true, breaking: false, steed: 62, winded: false, gait: 'trot', leanLow: 0, beat: false, spurFlash: 0,
      spur: { latched: false, streak: 0 }, horse: 'mule', mountables: [{ id: 'mule', name: 'Juniper', whistle: true, hidden: false, position: [0, 0, -8], scale: 1 }] };
    hud.update(null, state);
    expect(f.slots.map(row => row.spot)).toEqual(['r0', 'edge-l', 'lean-l', 'lean-r', 'aim']);
    expect(f.widgets).toEqual(['band.3:2']);
    expect(root.querySelector('.ws-ride-name')?.textContent).toBe('Juniper');
    expect(root.querySelector<HTMLElement>('.ws-ride-sbar i')?.style.width).toBe('62%');
    expect(hud.inputVerbs(true)['verb.1']).toMatchObject({ label: 'Dismount' });
    hud.update({ trust: null, alert: 0, ear: null, round: 2, balance: .5, danger: true, offer: false }, { ...state, breaking: true });
    expect(root.querySelector('.ws-ride-round')?.textContent).toBe('TAMING 2/5');
  } finally { f.scope.dispose(); root.remove(); }
});

test('G478 orchard fixture drives the data-only taming host and restores its bond', async () => {
  const { TamingSession } = await import('@wildshard/game/riding/taming');
  const { default: programs } = await import('../src/shards/nalati-grasslands/behaviour/riding.generated.json');
  const aliases = { upgraded: 'argymaq', horseUpgraded: 'horseArgymaq', candidateUpgraded: 'argymaq' };
  const session = new TamingSession(programs, aliases);
  const frame = { x: 0, y: 0, z: 2, mounted: null as string | null, crouched: true, wind: { x: 0, z: 1, strength: 1 }, offer: true, lean: 0,
    random: [.25, .25, .25] as const, herds: [{ cx: 0, cz: 0, trust: 100, alert: 0, beaten: true, fleeing: false,
      stallion: { id: 'orchard.mule', x: 0, y: 0, z: 0, alive: 1, upgraded: 0, scale: .8, dot: 0 } }] };
  session.sample(.1, frame); frame.mounted = 'orchard.mule'; session.start(frame);
  let previous = 0;
  const effects = [];
  for (let tick = 0; tick < 220 && session.phase === 'breaking'; tick++) {
    const balance = session.view.balance;
    frame.lean = Math.max(-1, Math.min(1, balance * 8 + (balance - previous) * 20)); previous = balance;
    effects.push(...session.sample(.1, frame));
  }
  expect(effects.find(effect => effect.kind === 'bond')).toEqual({ kind: 'bond', herd: 0, actor: 'orchard.mule', previous: null, upgraded: false });
  session.adopt('orchard.companion', false);
  const wire = session.snapshot(), restored = new TamingSession(programs, aliases);
  restored.restore(wire, ['orchard.mule', 'orchard.companion'], 1, 'orchard.companion');
  expect(restored.snapshot()).toBe(wire);
  expect(() => restored.restore(wire, ['foreign'], 1, null)).toThrow();
});

test('fixture riding actions selects the rail prompt and emits a naming row', () => {
  const f = fixture('fixture-mule', { walk: 1, trot: 3, canter: 5, gallop: 8 });
  const animals = legacyDouble<AnimalManager>({ animals: [f.actor] });
  const ctx = legacyDouble<LevelContext>({ ...f.ctx, on: () => undefined });
  const taming: PageTamingOwner = { phase: 'wild', companion: null, upgraded: false, promptHorse: null,
    view: { trust: null, alert: 0, ear: null, round: null, balance: 0, danger: false, offer: false },
    interactable: { position: new Vector3(), radius: 0, label: '', onInteract: () => undefined },
    update: () => undefined, noteEvent: () => undefined, noteShot: () => undefined, startBreaking: () => undefined,
    forceBreak: () => undefined, setInput: () => undefined, drainEvents: () => [] };
  const owners: PageRidingOwners = { id: 'orchard.herds', herds: [], wind: { x: 0, z: 0, strength: 0 } };
  const actions = new RidingActions(ctx, f.mount, taming, legacyDouble<Player>({ position: f.actor.position }), f.camera, animals,
    { herds: 'orchard.herds', program: fixturePrograms.riding, rail: { x: 3, z: 5 }, tagRange: 30, tagHeight: 2,
      labels: { name: 'Name', panic: ' startled', thrown: 'Thrown', bolt: ' resting' }, squeal: 'mule-call' }, owners);
  try {
    f.mount.addMountable(f.actor.entityId, 'Orchard mule');
    f.camera.position.set(3, 1.5, 6.15);
    actions.observe(.1, false);
    expect(actions.interactable.label).toBe('Name Orchard mule');
    actions.interactable.onInteract();
    expect(actions.drainEvents()).toEqual([{ kind: 'name', actor: f.actor.entityId, current: 'Orchard mule' }]);
    actions.observe(.1, true);
    expect(actions.interactable.label).not.toBe('Name Orchard mule');
  } finally { f.scope.dispose(); }
});


test('full orchard riding session owns its native mount and data prompts', () => {
  const speeds = { walk: 1, trot: 3, canter: 5, gallop: 8 }, f = fixture('fixture-mule', speeds, false);
  const input=f.ctx.app.input;
  input.register({id:'orchard.walk',actions:['move.left','move.right'],keys:{'move.left':['KeyJ'],'move.right':['KeyL']}},f.scope);
  const controls=parse(RidingControlsSchema,{foot:'orchard.foot',mounted:'orchard.saddle',breaking:'orchard.balance',movement:'orchard.walk',dismount:'Get down',
    keys:{'ride.whistle':['KeyH'],'ride.offer':['KeyF'],'ride.gallop':['AltLeft'],'move.forward':['ArrowUp'],'move.back':['ArrowDown'],
      'move.left':['ArrowLeft'],'move.right':['ArrowRight'],'lean.left':['KeyA'],'lean.right':['KeyD']},
    describe:[{group:'riding',id:'orchard.call',label:'Call mule',actions:['ride.whistle']}]});
  const ctx = legacyDouble<LevelContext>({ ...f.ctx, on: () => undefined,
    inputContext:def=>input.register(def,f.scope),system:spec=>f.ctx.app.addSystem(spec,f.scope) });
  const owners: PageRidingOwners = { id: 'orchard.herds', herds: [], wind: { x: 0, z: 1, strength: .2 } };
  const rest = { x: 3, z: 5, face: { x: 0, z: 1 } };
  const rows: PageRidingRows = {
    profile: { speeds, names: {}, thrownDamage: 7, thrownLabel: 'Thrown', restAt: rest }, mode: { id: 'ride', hud: 'ride' },
    controls,mountables: [{ id: f.actor.entityId, name: 'Orchard mule' }],
    taming: { herds: 'orchard.herds', programs: fixturePrograms, savedBond: null, rest,
      adopted: { kind: 'fixture-mule', variant: 'companion', upgrade: { scale: 1.2, colour: [.5, .6, .7] } }, thrownLabel: 'Thrown',
      binding: { upgradeKind: 'silver-mule', bonds: ['mule', 'silver-mule'], names: ['Mule', 'Silver mule'], offset: [2, 0],
        fields: { upgraded: 'argymaq', horseUpgraded: 'horseArgymaq', candidateUpgraded: 'argymaq' },
        labels: { mount: 'Mount', breaking: 'Breaking', trust: 'Trust', start: 'Tame', thrown: 'Thrown', bonded: ['Bonded', 'Silver bond'] } } },
    actions: { herds: 'orchard.herds', program: fixturePrograms.riding, rail: rest, tagRange: 30, tagHeight: 2,
      labels: { name: 'Name', panic: ' startled', thrown: 'Thrown', bolt: ' resting' }, squeal: 'mule-call' },
  };
  expect(() => createPageRiding(ctx, f.player, f.animals, f.camera, { ...rows, taming: { ...rows.taming, herds: 'foreign' } }, owners)).toThrow('Mismatched rendered riding herds');
  expect(() => createPageRiding(ctx, f.player, f.animals, f.camera, { ...rows, actions: { ...rows.actions, herds: 'foreign' } }, owners)).toThrow('Mismatched rendered riding herds');
  const imposter = legacyDouble<HerdBrain<Animal>>({ members: [] });
  expect(() => createPageRiding(ctx, f.player, f.animals, f.camera, rows, { ...owners, herds: [imposter] })).toThrow('Invalid rendered riding herds');
  expect(input.contexts).toEqual([]); expect(f.slots).toEqual([]);
  const session = createPageRiding(ctx, f.player, f.animals, f.camera, rows, owners);
  try {
    f.camera.position.set(3, 1.5, 6.15); session.update(.1, false, false, false);
    expect(session.interactable.label).toBe('Name Orchard mule'); session.interactable.onInteract();
    expect(session.drainEvents()).toEqual([{ kind: 'name', actor: f.actor.entityId, current: 'Orchard mule' }]);
    expect(session.mount.mount(f.actor.entityId)).toBe(true);
    expect(session.mount.mounted).toBe(true); expect(session.taming.phase).toBe('wild');
    const step=():void=>{for(const system of f.ctx.app.systemsByPhase().input)system.run(1/60,0);};
    expect(input.contexts).toEqual(['orchard.foot']);step();expect(input.contexts).toEqual(['orchard.foot','orchard.saddle']);
    expect(input.bindings.keys('orchard.balance')['lean.left']).toEqual(['KeyJ']);
    expect(input.bindings.table.rows.some(row=>row.label==='Call mule')).toBe(true);
    input.push('orchard.balance',f.scope);expect(input.allowed('ride.whistle')).toBe(false);expect(input.allowed('attack')).toBe(false);
    input.pop('orchard.balance');input.press('ride.horseTab');step();expect(session.mount.mounted).toBe(false);step();expect(input.contexts).toEqual(['orchard.foot']);
    Reflect.set(f.actor,'place',(x: number,z: number,yaw: number) => { f.actor.position.set(x,0,z); f.actor.yaw = yaw; });
    respawnPageMounted(ctx,new Vector3(30,0,-12),.3,{ yaw: Math.PI,steed: 91 });
    expect(session.mount.horse).toBe(f.actor); expect(session.mount.feet.toArray()).toEqual([30,0,-12]);
    expect(f.player.position.toArray()).toEqual([30,0,-12]); expect(f.player.yaw).toBeCloseTo(.3);
    expect(session.mount.steed).toBe(91); expect(session.mount.winded).toBe(false);
    expect(()=>parse(RidingControlsSchema,{...controls,run:()=>undefined})).toThrow();
  } finally { session.mount.dismount(); f.scope.dispose(); }
  expect(input.contexts).toEqual([]);expect(input.has('orchard.saddle')).toBe(false);expect(input.bindings.table.rows).toEqual([]);
});


test('Nalati practice reuses its entered mount and respawns one horse across room entries', () => {
  const f = fixture('horse', { walk: 1.8, trot: 4.5, canter: 8.5, gallop: 13 });
  const previousScope = pageApp.levelScope, previousState = pageApp.state;
  pageApp.levelScope = f.scope;
  const rows = horseCourseRows(), registrations: string[] = [];
  let spawned = 0, update: Parameters<PlaygroundHost['game']['onUpdate']>[0] = () => undefined;
  f.player.mountedOn = null;
  f.animals.spawn = () => { spawned++; return f.actor; };
  f.actor.place = (x, z, yaw) => { f.actor.position.set(x, 0, z); f.actor.yaw = yaw; };
  f.player.spawn = (x, z, yaw, y) => { f.player.position.set(x, y ?? 0, z); f.player.yaw = yaw; };
  const host = legacyDouble<PlaygroundHost>({
    player: f.player, animals: f.animals, spawn: {x: 0, z: 0}, toast: () => undefined,
    registry: legacyDouble<PlaygroundHost['registry']>({add: piece => { registrations.push(piece.id); return piece; }}),
    game: legacyDouble<PlaygroundHost['game']>({onUpdate: run => {update = run;}}),
  });
  const course = new PracticeCourse(host, legacyDouble<ShardContext>({scope: f.scope}), {kind: 'horse', layout: rows});
  try {
    expect(registrations).toEqual([rows.piece.id]);
    expect(course.root.visible).toBe(false);
    course.enter();
    expect(spawned).toBe(1); expect(course.entered).toBe(true); expect(course.root.visible).toBe(true);
    expect(f.mount.mountables).toHaveLength(1); expect(f.mount.mountables[0]?.a).toBe(f.actor);
    expect(f.player.position.toArray()).toEqual([rows.fieldAt.x + rows.riderStart.x, 3000, rows.fieldAt.z + rows.riderStart.z]);
    expect(f.actor.position.y).toBe(3000);
    update(.1, 0);
    course.exit();
    expect(f.mount.mountables).toEqual([]); expect(f.actor.hidden).toBe(true); expect(f.actor.mesh.visible).toBe(false);
    expect(course.root.visible).toBe(false);
    course.enter(); expect(spawned).toBe(1); expect(f.actor.hidden).toBe(false);
    course.exit();
  } finally {
    course.exit(); f.scope.dispose(); pageApp.levelScope = previousScope; pageApp.setState(previousState);
  }
});
