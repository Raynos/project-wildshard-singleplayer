import * as THREE from 'three';
import * as v from 'valibot';
import type { Scope } from '@wildshard/engine/app/scope';
import { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { HerdBrain } from '@wildshard/engine/ai/herd';
import type { InputService } from '@wildshard/engine/input/InputService';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { Player } from '@wildshard/engine/player/Player';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { TamingBinding } from './binding';
import type { TamingObservation } from './bindingTypes';
import type { TamingPrograms } from './taming';
import type { Mount } from './mount';
import { ReturnProgram } from '../population/returnProgram';
import { RideHUD } from './hud';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import type { Interactable } from '@wildshard/engine/world/interact/types';

const Profile = v.strictObject({ upgradeKind: v.string(), bonds: v.tuple([v.string(), v.string()]), names: v.tuple([v.string(), v.string()]),
  offset: v.tuple([v.number(), v.number()]), fields: v.strictObject({ upgraded: v.string(), horseUpgraded: v.string(), candidateUpgraded: v.string() }),
  labels: v.strictObject({ mount: v.string(), breaking: v.string(), trust: v.string(), start: v.string(), thrown: v.string(), bonded: v.tuple([v.string(), v.string()]) }) });


const collections = new WeakMap<Scope, Map<string, readonly HerdBrain<Animal>[]>>();
function nativeHerds(value: unknown): value is readonly HerdBrain<Animal>[] {
  return Array.isArray(value) && value.length <= 8 && value.every((herd: unknown) => herd instanceof HerdBrain
    && Object.getPrototypeOf(herd) === HerdBrain.prototype && herd.members.every((actor: unknown) => actor instanceof Animal));
}
/** Bind concrete engine herds once. An authored callback, subclass or structural
 * policy object cannot enter the riding feature through this service registry. */
export function admitRenderedHerds(scope: Scope, id: string, value: unknown): void {
  if (!nativeHerds(value)) throw new Error('Invalid rendered riding herds');
  const map = collections.get(scope) ?? new Map<string, readonly HerdBrain<Animal>[]>();
  if (map.has(id)) throw new Error('Duplicate rendered riding herds'); map.set(id, value); collections.set(scope, map);
  scope.onDispose(() => { map.delete(id); });
}
export interface PageTamingRows {
  herds: string; programs: TamingPrograms; binding: unknown; savedBond: string | null;
  rest: { x: number; z: number; face: { x: number; z: number } };
  adopted: { kind: string; variant: string; upgrade: { scale: number; colour: readonly number[] } };
  thrownLabel: string;
}
export type PageTamingEvent = { kind: 'notice'; text: string } | { kind: 'bond'; value: string }
  | { kind: 'bonded'; actor: string } | { kind: 'breaking'; on: boolean };
/** Client presentation observes the common state machine and drains data effects;
 * no author callback is registered on the game host. */
export interface PageTamingOwner {
  readonly phase: 'wild' | 'breaking' | 'bonded'; readonly companion: Animal | null; readonly upgraded: boolean;
  readonly promptHorse: Animal | null; readonly view: TamingObservation;
  readonly interactable: { position: THREE.Vector3; radius: number; label: string; onInteract: () => void };
  update: (dt: number) => void; noteEvent: (name: string, x: number, z: number) => void; noteShot: (x: number, z: number) => void;
  startBreaking: () => void; forceBreak: () => void; setInput: (input: InputService | null) => void; drainEvents: () => PageTamingEvent[];
}
/** Client-only native effect adapter. Placement, persisted bond values, labels and
 * upgrade appearance are rows; the existing engine actors own their real rigs. */
export function createPageTaming(ctx: LevelContext, player: Player, animals: AnimalManager, mount: Mount, rows: PageTamingRows): PageTamingOwner {
  const profile = v.parse(Profile, rows.binding);
  const colour = v.parse(v.tuple([v.number(), v.number(), v.number()]), rows.adopted.upgrade.colour);
  const herds = collections.get(ctx.scope)?.get(rows.herds); if (herds === undefined) throw new Error('Missing rendered riding herds');
  let events: PageTamingEvent[] = [];
  const law = new TamingBinding<Animal, HerdBrain<Animal>>({ profile, programs: rows.programs,
    bond: { read: () => rows.savedBond, write: value => { events.push({ kind: 'bond', value }); } }, player,
    mount: { get mounted() { return mount.mounted; }, get horse() { return mount.horse; },
      get breakShake() { return mount.breakShake; }, set breakShake(value) { mount.breakShake = value; },
      get breakRoll() { return mount.breakRoll; }, set breakRoll(value) { mount.breakRoll = value; },
      mount: (actor, breaking) => mount.mount(actor.entityId, breaking), dismount: thrown => { mount.dismount(thrown); },
      addMountable: (actor, name) => { mount.addMountable(actor.entityId, name); }, removeMountable: actor => { mount.removeMountable(actor.entityId); } },
    hud: { offer: false, lean: 0 }, herds: () => herds, rest: rows.rest, wind: () => windOf(ctx), random: Math.random,
    hideStallion: actor => { actor.hidden = true; actor.mesh.visible = false; actor.position.y = -1e4; },
    retireBonded: actor => {
      actor.hidden = true; actor.mesh.visible = false; actor.alive = false; actor.position.y = -1e4;
      const index = animals.animals.indexOf(actor); if (index !== -1) animals.animals.splice(index, 1); actor.mesh.removeFromParent();
    },
    spawnBonded: (x, z, yaw, upgraded) => {
      const actor = animals.spawn(rows.adopted.kind, x, z, yaw, rows.adopted.variant);
      actor.place(x, z, yaw); actor.position.y = terrainHeight(x, z); actor.mem['whistle'] = 1;
      if (upgraded) {
        const appearance = rows.adopted.upgrade; actor.scale = appearance.scale; actor.mesh.scale.setScalar(appearance.scale);
        for (const material of Array.isArray(actor.mesh.material) ? actor.mesh.material : [actor.mesh.material])
          if (material instanceof THREE.MeshLambertMaterial) material.color.setRGB(...colour);
      }
      return actor;
    },
    hurt: amount => {
      const target = ctx.app.player; if (target === null) return;
      ctx.app.combat.hit({ source: 'env', sourceTags: ['env.ride'], target, amount, throughWalls: true, point: player.position,
        dir: new THREE.Vector3(), cause: { kind: 'env.ride', label: rows.thrownLabel, text: rows.thrownLabel } });
    }, toast: text => { events.push({ kind: 'notice', text }); },
  });
  law.input = ctx.app.input;
  law.onBonded = actor => { events.push({ kind: 'bonded', actor: actor.entityId }); };
  law.onBreaking = on => { events.push({ kind: 'breaking', on }); };
  ctx.scope.onDispose(() => { law.input = null; });
  return { get phase() { return law.phase; }, get companion() { return law.companion; }, get upgraded() { return law.upgraded; },
    get promptHorse() { return law.promptHorse; }, view: law.view, interactable: law.interactable,
    update: dt => { law.update(dt); }, noteEvent: (name, x, z) => { law.noteEvent(name, x, z); }, noteShot: (x, z) => { law.noteShot(x, z); },
    startBreaking: () => { law.startBreaking(); }, forceBreak: () => { law.forceBreak(); }, setInput: input => { law.input = input; },
    drainEvents: () => { const out = events; events = []; return out; } };
}
const winds = new WeakMap<Scope, { x: number; z: number; strength: number }>();
/** Publish the scoped numeric world observation, without a wind callback. */
export function admitRidingWind(scope: Scope, wind: { x: number; z: number; strength: number }): void {
  if (winds.has(scope)) throw new Error('Duplicate riding wind'); winds.set(scope, wind); scope.onDispose(() => { winds.delete(scope); });
}
function windOf(ctx: LevelContext): { x: number; z: number; strength: number } {
  const wind = winds.get(ctx.scope); if (wind === undefined) throw new Error('Missing riding wind'); return wind;
}

/** Labels, the hitch point and the admitted guest are shard data. */
export interface RidingActionRows {
  herds: string; program: unknown; rail: { x: number; z: number }; tagRange: number; tagHeight: number;
  labels: { name: string; panic: string; thrown: string; bolt: string }; squeal: string;
}
export type RidingActionEvent = { kind: 'notice'; text: string } | { kind: 'name'; actor: string; current: string };
/** Prompt arbitration, riding events and HUD projection over concrete owners.
 * The author supplies no handler or selector; naming opens through a data event. */
export class RidingActions {
  readonly hud: RideHUD;
  readonly interactable: Interactable;
  private readonly nameIt: Interactable;
  private naming: Animal | null = null;
  private selected: Interactable | null = null;
  private decisionClock = 0;
  private events: RidingActionEvent[] = [];
  private readonly rules: ReturnProgram;
  private readonly herds: readonly HerdBrain<Animal>[];
  constructor(ctx: LevelContext, private readonly mount: Mount, private readonly taming: PageTamingOwner,
    private readonly player: Player, private readonly camera: THREE.PerspectiveCamera, private readonly animals: AnimalManager, private readonly rows: RidingActionRows) {
    const herds = collections.get(ctx.scope)?.get(rows.herds); if (herds === undefined) throw new Error('Missing rendered riding herds'); this.herds = herds;
    this.rules = ReturnProgram.page(rows.program, ctx.scope);
    this.hud = new RideHUD(ctx, camera, { tagRange: rows.tagRange, tagHeight: rows.tagHeight });
    this.nameIt = { position: new THREE.Vector3(rows.rail.x, 0, rows.rail.z), radius: 0, label: rows.labels.name,
      onInteract: () => { const actor = this.naming; if (actor !== null) this.events.push({ kind: 'name', actor: actor.entityId, current: mount.nameOf(actor.entityId) ?? actor.label }); } };
    this.interactable = { position: new THREE.Vector3(0, -1e4, 0), radius: 0, label: '', onInteract: () => { this.selected?.onInteract(); } };
    ctx.on('creature.signal', ({ name, x, z }) => {
      taming.noteEvent(name, x, z);
      const actor = mount.horse; if (actor === null || (name !== 'rider-bitten' && name !== 'scare' && name !== 'lightning')) return;
      const result = this.rules.project('panic', { x, z, px: actor.position.x, pz: actor.position.z, bite: Number(name === 'rider-bitten'), practice: Number(practiceRoom.open) });
      const duration = result['duration'] ?? 0;
      if (duration > 0 && mount.panic(x, z, duration) && name !== 'rider-bitten') this.events.push({ kind: 'notice', text: actor.label + rows.labels.panic });
    });
  }
  /** Native mounted physics runs every frame; decisions keep their original guest. */
  advanceMount(dt: number, wet: boolean, blocked: boolean): void {
    const mount = this.mount; mount.wet = wet; mount.blockedAhead = blocked;
    mount.stampedes = new Set(this.herds.flatMap(herd => herd.stampeding ? herd.members.map(actor => actor.entityId) : herd.stallionState === 'charge' && herd.stallion !== null ? [herd.stallion.entityId] : []));
    mount.update(dt);
    for (const event of mount.drainEvents()) {
      if (event.kind === 'mount') {
        for (const herd of this.herds) { const actor = event.horse === null ? null : herd.members.find(member => member.entityId === event.horse) ?? null; if (actor !== null || herd.ridden !== null) herd.setRidden(actor); }
      } else if (event.kind === 'thrown') this.events.push({ kind: 'notice', text: this.rows.labels.thrown });
      else if (event.kind === 'bolt') this.events.push({ kind: 'notice', text: event.name + this.rows.labels.bolt });
      else { const actor = mount.horse ?? mount.mountables.find(row => row.a.entityId === event.horse)?.a; if (actor !== undefined) this.animals.onSound?.(this.rows.squeal, actor.position); }
    }
  }
  private nameUpdate(open: boolean): void {
    this.naming = null; this.nameIt.radius = 0;
    const mount = this.mount; if (mount.mounted || open) return;
    const p = this.player.position; let best = Infinity, nearest: Readonly<Record<string, number>> | null = null;
    for (const entry of mount.mountables) {
      const a = entry.a, row = this.rules.project('name', { alive: Number(a.alive), x: a.position.x, z: a.position.z, cx: this.rows.rail.x, cz: this.rows.rail.z, px: p.x, pz: p.z, yaw: a.yaw, scale: a.scale });
      const distance = row['distance'] ?? 1e12;
      if (distance < best && distance < 1e12) { best = distance; this.naming = a; nearest = row; }
    }
    const actor = this.naming; if (actor === null || nearest === null) return;
    const x = nearest['x'] ?? actor.position.x, z = nearest['z'] ?? actor.position.z;
    this.nameIt.position.set(x, terrainHeight(x, z) + 1.5, z); this.nameIt.radius = nearest['radius'] ?? 0;
    this.nameIt.label = `${this.rows.labels.name} ${mount.nameOf(actor.entityId) ?? actor.label}`;
  }
  /** Observe after the taming owner advances. Selection is presentation; the
   * guest's rail eligibility remains sampled no faster than ten times a second. */
  observe(dt: number, namingOpen: boolean): void {
    const m = this.mount;
    this.hud.update(this.taming.view, { mounted: m.mounted, breaking: m.breaking, steed: m.steed, winded: m.winded, gait: m.gait, leanLow: m.leanLow,
      beat: m.beat, spurFlash: m.spurFlash, spur: { latched: m.spur.latched, streak: m.spur.streak }, horse: m.horse?.entityId ?? null,
      mountables: m.mountables.map(row => ({ id: row.a.entityId, name: row.name, whistle: row.a.mem['whistle'] === 1, hidden: row.a.hidden, position: [row.a.position.x, row.a.position.y, row.a.position.z], scale: row.a.scale })) });
    this.decisionClock += dt; if (this.decisionClock + 1e-9 >= .1) { this.decisionClock = 0; this.nameUpdate(namingOpen); }
    let best: Interactable | null = null, distance = Infinity;
    const count = m.interactables.length;
    for (let i = 0; i <= count + 1; i++) {
      const it = i < count ? m.interactables[i] : i === count ? this.taming.interactable : this.nameIt;
      if (it === undefined || it.radius <= 0) continue;
      const d = it.position.distanceTo(this.camera.position); if (d < it.radius && d < distance) { distance = d; best = it; }
    }
    this.selected = best;
    if (best === null) { this.interactable.radius = 0; this.interactable.position.set(0, -1e4, 0); return; }
    this.interactable.position.copy(best.position); this.interactable.radius = best.radius; this.interactable.label = best.label;
    this.interactable.weak = m.mounted && best !== this.taming.interactable;
  }
  drainEvents(): RidingActionEvent[] { const events = this.events; this.events = []; return events; }
}
