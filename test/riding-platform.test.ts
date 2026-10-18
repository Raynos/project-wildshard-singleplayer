// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { PerspectiveCamera, Vector3, SkinnedMesh } from 'three';
import { App } from '@wildshard/engine/app/app';
import { Scope } from '@wildshard/engine/app/scope';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { Player } from '@wildshard/engine/player/Player';
import { playerModes } from '@wildshard/engine/player/modes';
import { overrideTerrain } from '@wildshard/engine/world/Heightfield';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { DiscOpts } from '@wildshard/engine/ui/hudSlots';
import type { RideHudState, MountProfile } from '@wildshard/format/riding';
import { Mount } from '@wildshard/game/riding/mount';
import { RideHUD } from '@wildshard/game/riding/hud';
import { legacyDouble } from './fake/FakeGame';

function fixture(kind: string, speeds: MountProfile['speeds']): { mount: Mount; actor: Animal; scope: Scope; ctx: LevelContext; camera: PerspectiveCamera; slots: DiscOpts[]; widgets: string[] } {
  const scope = new Scope('riding-fixture'), app = new App(), camera = new PerspectiveCamera(), slots: DiscOpts[] = [], widgets: string[] = [];
  scope.onDispose(overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 }));
  const ctx = legacyDouble<LevelContext>({ app, scope, hud: {
    disc: (row: DiscOpts): HTMLButtonElement => { slots.push(row); const button = document.createElement('button'); button.className = row.cls; return button; },
    widget: (band: string, _el: HTMLElement, order: number): void => { widgets.push(`${band}:${String(order)}`); },
    relabel: (): (() => void) => () => undefined, verb: (): void => undefined, pin: (): void => undefined,
  } });
  const player = legacyDouble<Player>({ camera, position: new Vector3(), velocity: new Vector3(), keys: new Set<string>(), touchMove: { x: 0, y: 0 }, touchJump: false, moveScale: 1,
    yaw: 0, pitch: 0, hover: false, swimming: false, wading: false, ride: null,
    setHover: (): void => undefined, setBodyEnabled: (): void => undefined });
  const actor = legacyDouble<Animal>({ entityId: 'fixture.mount', kind, variant: 'starter', alive: true, hidden: false, hp: 100, maxHp: 100,
    yaw: 0, gaitPhase: 0, scale: 1, seed: .5, position: new Vector3(3, 0, 5), lookTarget: new Vector3(), mem: {}, mesh: new SkinnedMesh(),
    setMotion: (): void => undefined });
  const animals = legacyDouble<AnimalManager>({ animals: [actor] });
  playerModes(player).register({ id: 'ride', hud: 'ride' }, scope);
  return { mount: new Mount(ctx, player, animals, { speeds, names: {}, thrownDamage: 7, thrownLabel: 'Thrown', restAt: { x: 3, z: 5 } }), actor, scope, ctx, camera, slots, widgets };
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
