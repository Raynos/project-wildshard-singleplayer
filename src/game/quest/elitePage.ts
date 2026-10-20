import { app } from '@wildshard/engine/app/runtime';
import { pinBrain } from '@wildshard/engine/ai/inspect';
import type { Scope } from '@wildshard/engine/app/scope';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { StalkerBrain, type PouncerSpec, type HowlerSpec, type PouncerLedge, type HowlerPack } from '@wildshard/engine/ai/stalker';
import { DiverBrain, type WindDiverSpec } from '@wildshard/engine/ai/diver';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import type { EliteBar } from '@wildshard/engine/ui/EliteBar';
import * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { Player } from '@wildshard/engine/player/Player';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { CameraFX } from '@wildshard/engine/player/CameraFX';
import { Impacts } from '@wildshard/engine/fx/Impacts';
import { GroundTell, type Elites, type EliteScript, type EliteDef } from '../Elite';
import { fxMaterial, FX, type FxMaterial } from '@wildshard/engine/fx/groundFx';
import { SpawnScript } from '../population/spawnScript';
import { EliteDecisions } from './eliteDecisions';
import { parseEliteFeature, type EliteFeatureRows } from '@wildshard/format/eliteFeature';

/** Private bounded dome presentation; all geometry, pool and style choices come from the admitted feature rows. */
class Puffs {
  private readonly items: { mesh: THREE.Mesh; mat: FxMaterial; t: number; life: number; r0: number; r1: number; alpha: number }[] = [];
  private next = 0;
  constructor(parent: THREE.Object3D, view: NonNullable<EliteFeatureRows['view']>) {
    const pool = view.puffPool, geometry = new THREE.SphereGeometry(1, pool.segments[0], pool.segments[1]);
    for (let i = 0; i < pool.capacity; i++) {
      const mat = fxMaterial(FX.dome, new THREE.Color(...view.puffColor), 0), mesh = new THREE.Mesh(geometry, mat);
      mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = pool.order; parent.add(mesh);
      this.items.push({ mesh, mat, t: 0, life: 0, r0: 0.5, r1: 3, alpha: 1 });
    }
  }
  burst(at: THREE.Vector3, r0: number, r1: number, life: number, alpha: number): void {
    const item = this.items[this.next]; if (item === undefined) return;
    this.next = (this.next + 1) % this.items.length; item.mesh.position.copy(at);
    item.t = 0; item.life = life; item.r0 = r0; item.r1 = r1; item.alpha = alpha;
    item.mesh.scale.setScalar(r0); item.mesh.visible = true;
  }
  update(dt: number, t: number): void {
    for (const item of this.items) {
      if (!item.mesh.visible) continue;
      item.t += dt; const k = Math.min(1, item.t / Math.max(0.001, item.life));
      item.mesh.scale.setScalar(item.r0 + (item.r1 - item.r0) * (1 - (1 - k) * (1 - k)));
      item.mat.uniforms.uAlpha.value = item.alpha * (1 - k) * Math.min(1, item.t * 12);
      item.mat.uniforms.uTime.value = t; if (k >= 1) item.mesh.visible = false;
    }
  }
}

/** Client-only presentation over the same v1 owner as native encounters. Every authority is an existing concrete service;
 * content contributes only rows and prepared models, with no shard callback, override or reflected path. */
export function installEliteFeaturePage(game: Game, animals: AnimalManager, player: Player, sky: SkyRig, elites: Elites,
  models: ReadonlyMap<string, THREE.Object3D>, input: unknown, seed: number, hud: HUD, god = false): {
  readonly elites: Elites; readonly update: (dt: number, t: number) => void; readonly force: (id: string, move: string) => void; readonly isElite: (body: Animal) => boolean;
} {
  const rows = parseEliteFeature(input), view = rows.view;
  if (view === undefined) throw new Error('Elite page needs declared presentation');
  for (const body of animals.animals.filter(candidate => rows.fights.some(row => row.kind === candidate.kind && row.variant === candidate.variant))) {
    const variants = rows.ordinary[body.kind]; if (variants === undefined) throw new Error('Missing ordinary encounter variants');
    const herd = body.herd, { x, z } = body.position, yaw = body.yaw; animals.retire(body);
    const ordinary = animals.spawn(body.kind, x, z, yaw, variants); ordinary.herd = herd;
    const group = herd >= 0 ? animals.herds[herd] : undefined;
    if (group !== undefined) { const index = group.members.indexOf(body); if (index === -1) group.members.push(ordinary); else group.members[index] = ordinary; }
  }
  const puffs = new Puffs(game.scene, view), color = new THREE.Color(...view.tellColor);
  const controllers = rows.fights.map(row => new EliteDecisions(row, SpawnScript.page(animals, row.program, game.app.physics), rows, seed));
  const point = new THREE.Vector3(), direction = new THREE.Vector3(), tells = new Map<string, GroundTell>();
  const bodyFor = (controller: EliteDecisions): Animal | null => {
    const body = controller.animal; if (body === null) return null;
    const real = animals.animals.find(row => row === body); if (real === undefined) throw new Error('Foreign elite page body'); return real;
  };
  for (const controller of controllers) {
    for (const slot of controller.row.program.slots) for (const kind of new Set((controller.row.program.strikes ?? []).flatMap(row => row.tell === undefined ? [] : [row.tell]))) {
      tells.set(`${controller.def.id}:${slot.handle}:${kind}`, new GroundTell(game.scene, kind, color));
    }
    const script: EliteScript = { def: controller.def, get animal() { return bodyFor(controller); },
      spawn: () => { controller.spawn(); }, despawn: () => { controller.despawn(); },
      tick: (dt, t, engaged, leashing) => { controller.tick(dt, t, engaged, leashing); },
      enterPhase2: () => { controller.enterPhase2(); }, reset: () => { controller.reset(); }, trophy: () => { controller.trophy(); hud.killFeed(`${controller.def.drop.trophyName ?? 'Felled'} — ${controller.def.name}`); },
      dropModel: () => {
        const id = controller.def.drop.skin, model = id === null ? undefined : models.get(id);
        if (model === undefined) throw new Error('Missing admitted elite drop model'); const clone = model.clone(true); clone.visible = true; return clone;
      },
    };
    const scope = game.app.levelScope;
    if (scope !== null) game.app.encounters.elite(script.def.id, Object.assign(script, { force: (move: string) => { controller.force(move); } }), scope);
    elites.add(script);
  }
  return {
    elites,
    isElite: body => controllers.some(controller => controller.animal === body),
    force: (id, move) => { controllers.find(controller => controller.def.id === id)?.force(move); },
    update: (dt, t) => {
      for (const controller of controllers) controller.frame(player.position, sky.dayNight?.dusk ?? 0, sky.dayNight?.night ?? 0, god, player.yaw);
      elites.update(dt, t);
      for (const controller of controllers) {
        const program = controller.program;
        for (const effect of program.drainEffects()) {
          if (effect.kind === 'hit') {
            if (god) continue;
            const body = program.body(effect.actor), health = game.app.player;
            if (body === null || health === null) continue;
            game.app.combat.hit({ source: body.combatActor(), sourceTags: [`creature.${body.kind}`, 'feel.blow', 'cover.checked'], target: health,
              amount: effect.hit.damage, point: body.position, dir: direction.set(0, 0, 0), throughWalls: effect.hit.throughWalls, cause: { kind: body.kind, label: body.label } });
            if (effect.hit.stun > 0) game.app.effects?.apply(health, 'effect.stun', undefined, { duration: effect.hit.stun });
            if (effect.hit.trauma > 0) CameraFX.for(game).addTrauma(effect.hit.trauma);
          } else if (effect.kind === 'cue') {
            const name = program.cue(effect.id), cue = view.cues.find(row => row.id === name), body = program.body(effect.actor);
            if (cue === undefined || body === null) continue;
            if (cue.signature === true) elites.signature(controller.def.id);
            if (cue.trauma !== undefined) CameraFX.for(game).addTrauma(cue.trauma);
            if (cue.voice !== undefined) animals.onSound?.(cue.voice, point.set(effect.at.x, effect.at.y, effect.at.z));
            const fx = cue.effect; if (fx === undefined) continue;
            if (fx.kind === 'puff') {
              if (fx.at === 'head') body.headWorld(point); else point.copy(body.position);
              point.y += fx.height * body.scale; puffs.burst(point, fx.speed, fx.size, fx.lifetime, fx.opacity);
            } else { point.copy(body.position); point.y += fx.height; direction.set(player.position.x - point.x, 0, player.position.z - point.z); Impacts.for(game).burst('dirt', point, direction, fx.count); }
          }
        }
        const active = new Set<string>();
        for (const strike of program.strikePresentation()) {
          if (strike.tell === undefined) continue;
          const key = `${controller.def.id}:${strike.actor}:${strike.tell}`, body = program.body(strike.actor); if (body === null) continue;
          active.add(key); let tell = tells.get(key);
          if (tell === undefined) { tell = new GroundTell(game.scene, strike.tell, color); tells.set(key, tell); }
          tell.setTime(t);
          if (strike.tell === 'lane' && strike.phase === 'windup') {
            const k = Math.min(1, strike.time / Math.max(0.001, strike.windup)); tell.lane(strike.x0, strike.z0, strike.x1, strike.z1, strike.width, 0.35 + 0.55 * k * (0.75 + 0.25 * Math.sin(t * 22)));
          } else if (strike.tell === 'lane' && strike.phase === 'active') tell.lane(strike.x0, strike.z0, strike.x1, strike.z1, strike.width, Math.max(0, 0.6 - strike.time * 1.2));
          else if (strike.tell === 'ring' && strike.phase === 'windup') { const k = Math.min(1, strike.time / Math.max(0.001, strike.windup)); tell.ring(body.position.x, body.position.z, strike.radius * (0.7 + 0.3 * k), 0.35 + 0.6 * k * (0.7 + 0.3 * Math.sin(t * 20))); }
          else tell.hide();
        }
        for (const [key, tell] of tells) if (key.startsWith(`${controller.def.id}:`) && !active.has(key)) tell.hide();
      }
      puffs.update(dt, t);
    },
  };
}

const keeperBrains = new WeakMap<Animal, (a: Animal, c: ThinkCtx) => void>();
const keeperActs = new WeakMap<Animal, (a: Animal, c: ThinkCtx) => void>();
const keeperDamage = new WeakMap<Animal, (a: Animal, p: THREE.Vector3, d: THREE.Vector3) => number>();
/** Species delegate only their existing native decision, body and damage slots. */
export function setEliteBrain(a: Animal, fn: (a: Animal, c: ThinkCtx) => void): void { keeperBrains.set(a, fn); }
export function setEliteAct(a: Animal, fn: (a: Animal, c: ThinkCtx) => void): void { keeperActs.set(a, fn); }
export function setEliteDamage(a: Animal, fn: (a: Animal, p: THREE.Vector3, d: THREE.Vector3) => number): void { keeperDamage.set(a, fn); }
export function eliteThink(a: Animal, c: ThinkCtx): void { keeperBrains.get(a)?.(a, c); }
export function eliteAct(a: Animal, c: ThinkCtx): void { keeperActs.get(a)?.(a, c); }
export function eliteDamageMul(a: Animal, p: THREE.Vector3, d: THREE.Vector3): number { return keeperDamage.get(a)?.(a, p, d) ?? 1; }

/** Data-only page binding of approved stalker and wind-diver encounter policies.
 * Native species keep their existing AI cadence; effects leave as named values. */
export type KeeperEliteRow = {
  readonly def: EliteDef; readonly kind: string; readonly yaw: number; readonly offset: readonly [number, number];
  readonly memory: Readonly<Record<string, number>>; readonly tell: readonly [number, number, number];
  readonly beam: readonly [number, number, number]; readonly messages: Readonly<Record<string, string>>;
  readonly voices: Readonly<Record<string, string>>;
  readonly pack?: { readonly offset: readonly [number, number]; readonly variants: readonly string[] };
} & ({ readonly pattern: 'pouncer'; readonly spec: PouncerSpec } | { readonly pattern: 'howler'; readonly spec: HowlerSpec }
  | { readonly pattern: 'wind'; readonly spec: WindDiverSpec });
export type KeeperEliteEffect = { readonly kind: 'feed'; readonly id: string; readonly at: THREE.Vector3 }
  | { readonly kind: 'sound'; readonly id: string; readonly at: THREE.Vector3 }
  | { readonly kind: 'hit'; readonly animal: Animal; readonly amount: number }
  | { readonly kind: 'knock'; readonly x: number; readonly z: number }
  | { readonly kind: 'pack'; readonly x: number; readonly z: number; readonly variants: readonly string[] };
/** Existing entered services, separate from the row. No author factory or
 * lifecycle override is accepted. The owner may attach a real pack after spawn. */
export interface KeeperEliteServices {
  readonly game: Game; readonly animals: AnimalManager; readonly player: Player; readonly elites: Elites; readonly bar: EliteBar;
  readonly ledges: readonly PouncerLedge[]; readonly rock: { readonly x: number; readonly z: number; readonly top: number };
}
export class KeeperElitePage implements EliteScript {
  readonly def: EliteDef;
  animal: Animal | null = null;
  pack: (HowlerPack<Animal> & { readonly members: readonly Animal[] }) | null = null;
  private phase2 = false;
  private observations = { playerCrouched: false, playerFwdX: 0, playerFwdZ: -1, grassHeight: .55, wind: { x: -.8, z: .6 } };
  observe(row: typeof this.observations): void { this.observations = row; }
  private readonly policy: StalkerBrain<Animal> | DiverBrain<Animal>;
  private readonly events: KeeperEliteEffect[] = [];
  private engagement: Scope | null = null;
  constructor(readonly row: KeeperEliteRow, private readonly services: KeeperEliteServices, private readonly drop: THREE.Object3D) {
    this.def = row.def;
    const { game, player, elites, bar } = services;
    const tell = new GroundTell(game.scene, 'ring', new THREE.Color(...row.tell));
    const geometry = new THREE.CylinderGeometry(.05, .05, 1, 6, 1, true); geometry.translate(0, .5, 0);
    const material = fxMaterial(FX.beam, new THREE.Color(...row.beam), 0), beam = new THREE.Mesh(geometry, material);
    if (row.pattern === 'wind') { material.depthTest = false; beam.visible = false; beam.frustumCulled = false; beam.renderOrder = 31; game.scene.add(beam); }
    else { geometry.dispose(); material.dispose(); }
    const up = new THREE.Vector3(0, 1, 0), delta = new THREE.Vector3(), head = new THREE.Vector3();
    const event = (kind: 'feed' | 'sound', name: string, at = player.position): void => {
      const id = (kind === 'feed' ? row.messages : row.voices)[name]; if (id !== undefined) this.events.push({ kind, id, at: at.clone() });
    };
    const common = { player, lair: row.def.lair, phase2: () => this.phase2, signature: () => { elites.signature(row.def.id); } };
    const contact = { hurt: (animal: Animal, amount: number): void => { this.events.push({ kind: 'hit', animal, amount }); },
      knock: (x: number, z: number): void => { this.events.push({ kind: 'knock', x, z }); },
      isHead: (animal: Animal, point: THREE.Vector3): boolean => animal.headWorld(head).distanceTo(point) < animal.dims.headRadius * animal.scale + .12 };
    if (row.pattern === 'pouncer') this.policy = new StalkerBrain({ pattern: 'pouncer', spec: row.spec, ports: {
      ...common, ...contact, awareRadius: row.def.awareR, ledges: services.ledges, heightAt: terrainHeight, ring: tell,
      opened: () => { event('feed', 'opened'); }, growl: at => { event('sound', 'growl', at); } } });
    else if (row.pattern === 'howler') this.policy = new StalkerBrain({ pattern: 'howler', spec: row.spec, ports: {
      ...common, ...contact, pack: () => this.pack, environment: () => ({ ...this.observations, grassHeightAt: () => this.observations.grassHeight }), random: () => app.rng.stream('ai').next(), rings: tell,
      regrouped: () => { event('feed', 'regrouped'); }, interrupted: () => { event('feed', 'interrupted'); }, closed: () => { event('feed', 'closed'); }, howl: at => { event('sound', 'howl', at); } } });
    else this.policy = new DiverBrain(null, { pattern: 'wind', spec: row.spec, ports: {
      ...common, ...contact, rock: services.rock, heightAt: terrainHeight, wind: () => this.observations.wind, random: () => app.rng.stream('ai').next(),
      tell: { setTime: time => { material.uniforms.uTime.value = time; }, aim: (from, to, alpha) => {
        delta.subVectors(to, from); beam.position.copy(from); beam.scale.set(1, delta.length(), 1);
        beam.quaternion.setFromUnitVectors(up, delta.normalize()); material.uniforms.uAlpha.value = alpha; beam.visible = true;
      }, chevron: point => { bar.chevron(point, game.camera); }, hide: () => { beam.visible = false; } },
      grounded: () => { event('feed', 'grounded'); }, cry: at => { event('sound', 'cry', at); } } });
  }
  spawn(): void {
    const { row, policy, services } = this, a = services.animals.spawn(row.kind, this.def.lair.x + row.offset[0], this.def.lair.z + row.offset[1], row.yaw, row.def.id);
    this.animal = a; a.herd = -1; Object.assign(a.mem, row.memory);
    if (row.pack !== undefined) this.events.push({ kind: 'pack', x: row.def.lair.x + row.pack.offset[0], z: row.def.lair.z + row.pack.offset[1], variants: row.pack.variants });
    if (policy instanceof StalkerBrain) {
      policy.spawned(a); setEliteBrain(a, (body, context) => { if (row.pattern === 'pouncer') policy.decidePouncer(body, context); else policy.decideHowler(body, context); });
      setEliteAct(a, body => { policy.act(body); }); setEliteDamage(a, (body, point) => policy.damage(body, point));
    } else { policy.spawnWind(a); setEliteBrain(a, (body, context) => { policy.decideWind(body, context); }); setEliteDamage(a, (body, point) => policy.windDamage(body, point)); }
  }
  despawn(): void {
    this.events.length = 0;
    this.engagement?.dispose(); this.engagement = null;
    if (this.policy instanceof StalkerBrain) this.policy.disposeTell(); else this.policy.disposeWindTell();
    if (this.animal !== null) this.services.animals.retire(this.animal); this.animal = null;
    if (this.pack !== null) for (const member of this.pack.members) if (member.alive) this.services.animals.retire(member); this.pack = null;
  }
  reset(): void { this.phase2 = false; if (this.policy instanceof StalkerBrain) this.policy.reset(this.animal); else this.policy.resetWind(); }
  enterPhase2(): void { this.phase2 = true; if (this.policy instanceof StalkerBrain && this.row.pattern === 'howler') this.policy.enterPhase2(this.animal); }
  trophy(): void { /* Rewards are owned by the encounter host. */ }
  dropModel(): THREE.Object3D { return this.drop.clone(true); }
  tick(dt: number, time: number, engaged: boolean, leashing: boolean): void {
    if (engaged && this.animal !== null && this.engagement === null) { this.engagement = this.services.game.levelScope.child(`elite.${this.def.id}`); pinBrain(this.animal, this.engagement); }
    else if (!engaged) { this.engagement?.dispose(); this.engagement = null; }
    if (this.policy instanceof StalkerBrain) this.policy.advance(this.animal, dt, time, engaged, leashing); else this.policy.advanceWind(this.animal, dt, time, engaged, leashing);
  }
  drainEffects(): KeeperEliteEffect[] { return this.events.splice(0); }
}
