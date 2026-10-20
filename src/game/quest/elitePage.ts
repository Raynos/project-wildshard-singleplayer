import type { HerdBrain } from '@wildshard/engine/ai/herd';
import type { ReturnProgram } from '../population/returnProgram';
import type { SpawnScriptRows } from '@wildshard/format/spawnScripts';
import { app } from '@wildshard/engine/app/runtime';
import { pinBrain } from '@wildshard/engine/ai/pinning';
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
import { DomePuffs, fxMaterial, FX } from '@wildshard/engine/fx/groundFx';
import { SpawnScript } from '../population/spawnScript';
import { EliteDecisions } from './eliteDecisions';
import { parseEliteFeature, parseExternalElite, type ExternalEliteData } from '@wildshard/format/eliteFeature';


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
  const puffs = new DomePuffs(game.scene, new THREE.Color(...view.puffColor), view.puffPool.capacity, view.puffPool.segments, view.puffPool.order), color = new THREE.Color(...view.tellColor);
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

/** Client-only data binding of approved stalker and wind-diver encounter policies.
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

/** External native allocation remains with its existing body owner. These rows
 * bind either a v1 fight slot or an AS-projected herd encounter to that body. */
export type ExternalEliteRow = ExternalEliteData;
export type ExternalEliteEffect = KeeperEliteEffect | { readonly kind: 'request'; readonly row: ExternalEliteRow }
  | { readonly kind: 'retire'; readonly actor: Animal } | { readonly kind: 'support'; readonly count: number }
  | { readonly kind: 'record'; readonly species: string; readonly variant: string };
type EncounterHerd = Pick<HerdBrain<Animal>, 'stallionState' | 'stallion' | 'leadAway'>;
/** Client-only native projection over admitted AS decisions. Observations and adopted
 * bodies are values; shard callbacks, subclass hooks and service factories are
 * never admitted. Support and exceptional allocation leave as typed requests. */
export class ExternalElitePage implements EliteScript {
  readonly def: EliteDef;
  animal: Animal | null = null;
  private herd: EncounterHerd | null = null;
  private line: readonly Animal[] = [];
  private program: SpawnScript | null = null;
  private readonly events: ExternalEliteEffect[] = [];
  private readonly tell: GroundTell;
  private scope: Scope | null = null;
  private phase2 = false; private pending = false; private elapsed = 0; private readyTime = 0; private initialized = false;
  private laneT = 0; private runT = 0; private previousState = 0; private fraction = 0; private isBroken = false;
  private readonly from = new THREE.Vector3(); private readonly to = new THREE.Vector3();
  private observations: { available: boolean; kills: number; bonded: boolean; mount: Animal | null } = { available: false, kills: 0, bonded: false, mount: null };
  private eligible = false;
  constructor(readonly row: ExternalEliteRow, private readonly services: Pick<KeeperEliteServices, 'game' | 'animals' | 'player' | 'elites'>,
    private readonly decisions: ReturnProgram, private readonly drop: THREE.Object3D, private readonly fight?: SpawnScriptRows) {
    this.row = parseExternalElite(row); this.def = row.def; this.tell = new GroundTell(services.game.scene, 'lane', new THREE.Color(...row.tell));
    if (row.mode === 'script' && fight === undefined) throw new Error('Script encounter needs an admitted fight');
  }
  observe(dt: number, observations: typeof this.observations): void {
    this.observations = observations; this.readyTime += dt;
    if (!this.initialized || this.readyTime + 1e-9 >= .1) {
      this.initialized = true; this.readyTime = 0;
      this.eligible = this.row.mode === 'herd' || this.decisions.project(this.row.ready, { kills: observations.kills, engaged: 0, line: 0 })['accept'] === 1;
    }
  }
  canSpawn(): boolean { return this.observations.available && this.eligible; }
  spawn(): void { if (this.animal?.alive === true || this.pending) return; this.pending = true; this.events.push({ kind: 'request', row: this.row }); }
  adopt(animal: Animal, herd: EncounterHerd | null = null): void {
    if (!this.pending) throw new Error('Unrequested encounter body');
    this.pending = false; this.animal = animal; this.herd = herd;
    if (this.row.mode === 'script') {
      const fight = this.fight; if (fight === undefined) throw new Error('Missing encounter fight');
      this.program = SpawnScript.page(this.services.animals, fight, this.services.game.app.physics); this.program.adopt('main', animal.entityId);
      setEliteDamage(animal, (_body, point) => this.decisions.project(this.row.damage, { mode: Number(this.program?.state('main')['mode'] ?? 0), distance: point.distanceTo(this.services.player.position) })['scale'] ?? 1);
    } else {
      for (const material of Array.isArray(animal.mesh.material) ? animal.mesh.material : [animal.mesh.material]) if (material instanceof THREE.MeshLambertMaterial) material.color.setRGB(...this.row.spawn.color);
    }
  }
  support(actors: readonly Animal[]): void { this.line = actors; }
  despawn(): void {
    this.scope?.dispose(); this.scope = null; this.tell.hide(); this.program?.interrupt(); this.pending = false;
    if (this.row.mode === 'herd') return;
    for (const actor of this.line) if (actor.alive) this.events.push({ kind: 'retire', actor }); this.line = [];
    if (this.animal !== null) this.events.push({ kind: 'retire', actor: this.animal }); this.animal = null; this.program = null;
  }
  reset(): void { this.phase2 = false; this.program?.interrupt(); this.program?.signal('main', 0); this.tell.hide(); }
  enterPhase2(): void { this.phase2 = true; }
  broken(): boolean { return this.isBroken; }
  barFrac(): number { return this.row.mode === 'script' && this.animal !== null ? this.animal.hp / this.animal.maxHp : this.fraction; }
  trophy(): void { /* The encounter host owns rewards. */ }
  dropModel(): THREE.Object3D { return this.drop.clone(true); }
  tick(dt: number, time: number, engaged: boolean, leashing: boolean): void {
    const animal = this.animal; if (animal === null) return;
    if (engaged && this.scope === null) { this.scope = this.services.game.levelScope.child(`elite.${this.def.id}`); pinBrain(animal, this.scope); }
    else if (!engaged) { this.scope?.dispose(); this.scope = null; }
    this.elapsed += dt;
    if (this.row.mode === 'script') {
      const program = this.program; if (program === null) return;
      if (this.elapsed + 1e-9 >= .1) {
        this.elapsed = 0;
        const count = this.decisions.project(this.row.step, { kills: this.observations.kills, engaged: Number(engaged), line: this.line.filter(actor => actor.alive).length })['count'] ?? 0;
        if (count > 0) this.events.push({ kind: 'support', count });
      }
      program.frame(this.services.player.position, 0, { engaged: Number(engaged), leashing: Number(leashing), phase2: Number(this.phase2), clock: time }); program.advanceFrame(dt);
      for (const effect of program.drainEffects()) {
        if (effect.kind === 'hit') { this.events.push({ kind: 'hit', animal, amount: effect.hit.damage }, { kind: 'knock', x: Math.sin(animal.yaw), z: Math.cos(animal.yaw) }); }
        else if (effect.kind === 'cue') {
          const cue = this.row.cues[program.cue(effect.id)]; if (cue === undefined) continue;
          if (cue.signature === true) this.services.elites.signature(this.def.id);
          if (cue.voice !== undefined) this.events.push({ kind: 'sound', id: cue.voice, at: animal.position.clone() });
          if (cue.feed !== undefined) this.events.push({ kind: 'feed', id: cue.feed, at: animal.position.clone() });
        }
      }
      this.tell.hide(); this.tell.setTime(time);
      for (const strike of program.strikePresentation()) if (strike.phase === 'windup' || strike.phase === 'active') this.tell.lane(strike.x0, strike.z0, strike.x1, strike.z1, strike.width, strike.phase === 'windup' ? .42 : .36);
      return;
    }
    const herd = this.herd; if (herd === null) return;
    if (this.elapsed + 1e-9 >= .1) {
      const state = this.row.states[herd.stallionState] ?? 0;
      const result = this.decisions.project(this.row.step, { dt: this.elapsed, state, previousState: this.previousState, laneT: this.laneT, runT: this.runT,
        phase2: Number(this.phase2), engaged: Number(engaged), bonded: Number(this.observations.bonded), same: Number(herd.stallion === animal), health: animal.hp / animal.maxHp });
      this.elapsed = 0; this.previousState = state; this.laneT = result['laneT'] ?? this.laneT; this.runT = result['runT'] ?? this.runT; this.fraction = result['fraction'] ?? 0;
      this.isBroken = herd.stallionState === this.row.broken;
      if (result['capture'] === 1) { this.from.copy(animal.position); this.to.copy(this.services.player.position); }
      if (result['signature'] === 1) this.services.elites.signature(this.def.id);
      if (result['lead'] === 1) herd.leadAway(this.services.player.position.x, this.services.player.position.z);
      const mount = this.observations.mount;
      if (result['adopt'] === 1 && mount !== null) {
        mount.scale = this.row.adopted.scale; mount.mesh.scale.setScalar(mount.scale); this.services.elites.won(this.def.id); this.herd = null;
        this.events.push({ kind: 'record', species: this.row.adopted.kind, variant: this.row.adopted.variant }, { kind: 'feed', id: this.row.adopted.feed, at: mount.position.clone() });
      }
    }
    this.tell.setTime(time);
    if (this.laneT > 0) {
      const dx = this.to.x - this.from.x, dz = this.to.z - this.from.z, distance = Math.hypot(dx, dz) || 1, k = Math.max(0, distance - 3) / distance;
      this.tell.lane(this.from.x, this.from.z, this.from.x + dx * k, this.from.z + dz * k, 3, .55 * Math.min(1, this.laneT * 2));
    } else this.tell.hide();
  }
  drainEffects(): ExternalEliteEffect[] { return this.events.splice(0); }
}
