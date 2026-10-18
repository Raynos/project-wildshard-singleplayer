import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { SpawnScript } from '@wildshard/game/population/spawnScript';
import { ArgymaqKeeper } from '../runtime/argymaqKeeper';
import { NALATI_STRIKES, sampleStrike } from './strikes';
import { registerNalatiDefinition } from '../species/rows';
import { NativePouncerKeeper, NativeHowlerKeeper, NativeWindKeeper, argymaqDefinition, eliteRuleHolds } from './eliteRoster';
import type { SpawnScriptRows } from '@wildshard/format/spawnScripts';
import { EliteBrain } from '@wildshard/engine/ai/EliteBrain';
import { pinBrain } from '@wildshard/engine/ai/inspect';
import { canReach } from '@wildshard/engine/ai/reach';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { setEliteBrain, setEliteAct, setEliteDamage } from '../runtime/eliteBrain';
import { hasSpecies as hasLegacySpecies, speciesDef } from '@wildshard/engine/entities/species/registry';
import type { Player } from '@wildshard/engine/player/Player';
import { EliteBar } from '@wildshard/engine/ui/EliteBar';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { fxMaterial, FX } from '@wildshard/engine/fx/groundFx';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { encounterHit } from './damage';
import * as THREE from 'three';
import type { Wildlife } from '../creatures/wildlife';
import type { PackController, HerdController } from '../runtime/groupRegistry';
import type { Ledge } from '../world/types';
import { wildEnv } from '../creatures/env';
import { LEOPARD } from '../species/leopard';
import { EAGLE } from '../species/eagle';
import { KOKBORI } from '../species/kokbori';
import { Elites, GroundTell, type EliteDef, type EliteScript, type EliteRule, type ElitePersistence } from '@wildshard/game/Elite';
import { bakedActorGeometry } from '../world/places';
import poiLayoutRows from '../boot/poiLayout.generated.json' with { type: 'json' };

const { EAGLE_ROCK } = poiLayoutRows;
export type EliteSound = 'wolf_howl' | 'leopard_growl' | 'horse_squeal' | 'eagle_cry';
interface Env {
  game: Game; sky: Sky; player: Player; animals: AnimalManager; charge: SpawnScriptRows;
  elites: Elites; bar: EliteBar;
  wildlife: Wildlife | null;
  taming: { phase: string; tulpar: Animal | null } | null;
  ghosts: GhostsApi | null;
  ledges: Ledge[];
  hurt: (a: Animal, dmg: number) => void;
  knock: (dx: number, dz: number) => void;
  feed: (text: string) => void;
  record: (kind: string, variant: string) => void;
  sound: (name: EliteSound, at: THREE.Vector3) => void;
}
const _h = new THREE.Vector3();
function isHead(a: Animal, p: THREE.Vector3, slack = 0.12): boolean { a.headWorld(_h); return _h.distanceTo(p) < a.dims.headRadius * a.scale + slack; }
abstract class Base extends EliteBrain<Animal> implements EliteScript {
  private engagementScope: Scope | null = null;
  private engagementActor: Animal | null = null;
  protected engagement(engaged: boolean): void {
    if (!engaged || this.animal === null) {
      this.engagementScope?.dispose(); this.engagementScope = null; this.engagementActor = null; return;
    }
    if (this.engagementActor === this.animal && this.engagementScope !== null) return;
    this.engagementScope?.dispose();
    this.engagementScope = this.env.game.levelScope.child(`elite.${this.def.id}.engaged`);
    this.engagementActor = this.animal; pinBrain(this.animal, this.engagementScope);
  }
  constructor(override readonly def: EliteDef, protected readonly env: Env) { super(def, { player: env.player, random: () => app.rng.stream('ai').next() }); }
  abstract override spawn(): void;
  abstract override tick(dt: number, t: number, engaged: boolean, leashing: boolean): void;
  override despawn(): void { this.engagement(false); if (this.animal) this.env.animals.retire(this.animal); this.animal = null; }
  override reset(): void { this.p2 = false; }
  override enterPhase2(): void { this.p2 = true; }
  trophy(): void { /* Nalati awards skins rather than pack trophies. */ }
  dropModel(): THREE.Object3D { return trophyModel(this.def.id, this.env.sky); }
  protected fight(): void { /* Shared keepers own the active body goal. */ }
  protected sig(): void { this.env.elites.signature(this.def.id); }

}
function bindKeeper(def: EliteDef, env: Env, pattern: 'pouncer' | 'howler' | 'wind'): EliteScript {
  let animal: Animal | null = null, p2 = false, pack: PackController | null = null;
  const tell = new GroundTell(env.game.scene, 'ring', new THREE.Color(pattern === 'howler' ? 0.9 : 2.4, pattern === 'howler' ? 1.15 : 0.9, pattern === 'howler' ? 1.4 : 0.35));
  const geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true); geometry.translate(0, 0.5, 0);
  const material = fxMaterial(FX.beam, new THREE.Color(2.4, 1.7, 0.5), 0), beam = new THREE.Mesh(geometry, material);
  if (pattern === 'wind') { material.depthTest = false; beam.visible = false; beam.frustumCulled = false; beam.renderOrder = 31; env.game.scene.add(beam); }
  else { geometry.dispose(); material.dispose(); }
  const up = new THREE.Vector3(0, 1, 0), delta = new THREE.Vector3();
  const common = { player: env.player, lair: def.lair, phase2: () => p2, signature: () => { env.elites.signature(def.id); } };
  const policy = pattern === 'pouncer' ? new NativePouncerKeeper<Animal>({
    ...common, awareRadius: def.awareR, ledges: env.ledges, heightAt, isHead, ring: tell, hurt: env.hurt, knock: env.knock,
    opened: () => { env.feed(ecology.profiles.aqbars.opened); }, growl: at => { env.sound('leopard_growl', at); },
  }) : pattern === 'howler' ? new NativeHowlerKeeper<Animal>({
    ...common, pack: () => pack, environment: () => wildEnv, random: () => app.rng.stream('ai').next(), rings: tell, hurt: env.hurt,
    regrouped: () => { env.feed(ecology.profiles.kokbori.regrouped); }, interrupted: () => { env.feed(ecology.profiles.kokbori.interrupted); },
    closed: () => { env.feed(ecology.profiles.kokbori.closed); }, howl: at => { env.sound('wolf_howl', at); },
  }) : new NativeWindKeeper<Animal>({
    ...common, rock: EAGLE_ROCK, heightAt, wind: () => wildEnv.wind, random: () => app.rng.stream('ai').next(), isHead,
    tell: { setTime: t => { material.uniforms.uTime.value = t; }, aim: (from, to, alpha) => {
      delta.subVectors(to, from); beam.position.copy(from); beam.scale.set(1, delta.length(), 1);
      beam.quaternion.setFromUnitVectors(up, delta.normalize()); material.uniforms.uAlpha.value = alpha; beam.visible = true;
    }, chevron: point => { env.bar.chevron(point, env.game.camera); }, hide: () => { beam.visible = false; } },
    hurt: env.hurt, knock: env.knock, grounded: () => { env.feed(ecology.profiles.qyran.grounded); }, cry: at => { env.sound('eagle_cry', at); },
  }, ecology.profiles.qyran.spec);
  const spawn = (): void => {
    const kind = pattern === 'pouncer' ? LEOPARD : pattern === 'howler' ? KOKBORI : EAGLE;
    const a = env.animals.spawn(kind, def.lair.x + (pattern === 'wind' ? 26 : 0), def.lair.z, pattern === 'howler' ? Math.PI : 0, def.id);
    animal = a; a.herd = -1; if (pattern === 'pouncer') a.mem['low'] = 0.3;
    policy.spawned(a); setEliteBrain(a, (body, ctx) => { policy.think(body, ctx); });
    if (!(policy instanceof NativeWindKeeper)) setEliteAct(a, body => { policy.act(body); });
    setEliteDamage(a, (body, point) => policy.damage(body, point));
    if (pattern === 'howler') { pack = env.wildlife?.spawnPack(def.lair.x - 6, def.lair.z + 4, ['grey', 'tawny', 'grey', 'dark', 'scout']) ?? null; if (pack !== null) { pack.homeX = def.lair.x; pack.homeZ = def.lair.z; } }
  };
  let engagedScope: Scope | null = null;
  return { def, get animal() { return animal; }, spawn,
    despawn: () => { engagedScope?.dispose(); engagedScope = null; policy.disposeTell(); if (animal !== null) env.animals.retire(animal); animal = null;
      if (pack !== null) for (const member of pack.members) if (member.alive) env.animals.retire(member); pack = null; },
    reset: () => { p2 = false; if (policy instanceof NativeWindKeeper) policy.reset(); else policy.reset(animal); },
    enterPhase2: () => { p2 = true; if (policy instanceof NativeHowlerKeeper) policy.enterPhase2(animal); },
    trophy: () => undefined, dropModel: () => trophyModel(def.id, env.sky),
    tick: (dt, t, engaged, leashing) => {
      if (engaged && animal !== null && engagedScope === null) { engagedScope = env.game.levelScope.child(`elite.${def.id}`); pinBrain(animal, engagedScope); }
      else if (!engaged) { engagedScope?.dispose(); engagedScope = null; }
      policy.tick(animal, dt, t, engaged, leashing);
    },
  };
}
export interface GhostsApi {
  spawnRider: (o: { x: number; z: number; yaw: number; variant?: 'rider' | 'captain' }) => Animal | null;
  spawnLine: (o: { count?: number; captain?: boolean; at?: number }) => Animal[];
  dissolve: (a: Animal) => void;
  readonly killsTonight: number;
}
class QaraBatyr extends Base {
  private program: SpawnScript | null = null;
  private line: Animal[] = [];
  private readonly tell = new GroundTell(this.env.game.scene, 'lane', new THREE.Color(0.35, 1.6, 1.9));
  canSpawn(): boolean { return this.env.ghosts !== null && this.env.ghosts.killsTonight >= 5; }
  override spawn(): void {
    const c = this.def.lair, a = this.env.ghosts?.spawnRider({ x: c.x, z: c.z, yaw: 0, variant: 'captain' });
    if (a === undefined || a === null) return;
    this.animal = a; this.program = SpawnScript.page(this.env.animals, this.env.charge, app.physics); this.program.adopt('main', a.entityId);
    setEliteDamage(a, (_body, point) => this.program?.state('main')['mode'] === 4 && point.distanceTo(this.env.player.position) < 3.8 ? 3 : 1);
  }
  override despawn(): void {
    this.engagement(false); this.tell.hide(); this.program?.interrupt();
    for (const a of this.line) if (a.alive) this.env.ghosts?.dissolve(a); this.line = [];
    if (this.animal !== null) this.env.ghosts?.dissolve(this.animal); this.animal = null; this.program = null;
  }
  override reset(): void { super.reset(); this.program?.interrupt(); this.program?.signal('main', 0); this.tell.hide(); }
  override tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    this.engagement(engaged); const program = this.program, a = this.animal; if (program === null || a === null) return;
    if (engaged && this.line.every(body => !body.alive)) this.line = this.env.ghosts?.spawnLine({ count: 3 }) ?? [];
    program.frame(this.env.player.position, 0, { engaged: Number(engaged), leashing: Number(leashing), phase2: Number(this.p2), clock: t }); program.advanceFrame(dt);
    for (const effect of program.drainEffects()) {
      if (effect.kind === 'hit') { this.env.hurt(a, effect.hit.damage); this.env.knock(Math.sin(a.yaw), Math.cos(a.yaw)); }
      else if (effect.kind === 'cue') { const cue = program.cue(effect.id); if (cue === 'signature') this.sig(); else if (cue === 'squeal') this.env.sound('horse_squeal', a.position); else this.env.feed('He passes — his back is OPEN'); }
    }
    this.tell.hide(); this.tell.setTime(t);
    for (const row of program.strikePresentation()) if (row.phase === 'windup' || row.phase === 'active') this.tell.lane(row.x0, row.z0, row.x1, row.z1, row.width, row.phase === 'windup' ? 0.42 : 0.36);
  }
}
export const ARGYMAQ = ecology.argymaq;
export function registerArgymaq(): void {
  if (hasNalatiSpecies(ARGYMAQ) || !hasNalatiSpecies('horse')) return;
  const H = speciesDef('horse');
  const base = H.variants.find((v) => v.id === 'stallion') ?? H.variants[0];
  if (base === undefined) return;
  registerNalatiDefinition(argymaqDefinition(H, base));
}
class Argymaq extends Base {
  private herd: HerdController | null = null;
  private lane: GroundTell;
  private readonly keeper: ArgymaqKeeper<Animal>;
  constructor(def: EliteDef, env: Env) {
    super(def, env); this.lane = new GroundTell(env.game.scene, 'lane', new THREE.Color(2.4, 0.9, 0.35));
    this.keeper = new ArgymaqKeeper({ player: env.player, phase2: () => this.p2, lane: this.lane,
      signature: () => { this.sig(); }, taming: () => this.env.taming,
      adopted: tul => {
        tul.scale = 1.3; tul.mesh.scale.setScalar(1.3);
        this.env.record(ARGYMAQ, 'stallion'); this.env.elites.won(this.def.id);
        this.env.feed('Argymaq is yours — the best horse in Nalati'); this.herd = null;
      } });
  }
  override spawn(): void {
    registerArgymaq();
    const w = this.env.wildlife, c = this.def.lair;
    if (w === null || !hasNalatiSpecies(ARGYMAQ)) return;
    const herd = w.spawnHerd(c.x - 8, c.z + 6, 8, 1, false);
    const a = this.env.animals.spawn(ARGYMAQ, c.x, c.z, 0, 'stallion');
    const hi = herd.members[0]?.herd ?? -1;
    a.herd = hi; if (hi >= 0) this.env.animals.herds[hi]?.members.push(a);
    herd.adoptStallion(a);   // his brain finds this herd (HorseHerd.of): BEATEN → the taming row's break prompt
    const mats = Array.isArray(a.mesh.material) ? a.mesh.material : [a.mesh.material];
    for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) m.color.setRGB(0.62, 0.64, 0.72);
    this.herd = herd; this.animal = a;
  }
  override despawn(): void { this.engagement(false);  }
  broken(): boolean { return this.herd?.stallionState === 'beaten'; }
  barFrac(): number { const a = this.animal; return a ? Math.max(0, (a.hp / a.maxHp - 0.25) / 0.75) : 0; }
  override tick(dt: number, t: number, engaged: boolean): void {
    this.engagement(engaged); this.keeper.tick(this.animal, this.herd, dt, t, engaged);
  }
}
function trophyModel(id: string, sky: Sky): THREE.Object3D {
  const mat = painterlyMaterial(sky, { rim: 0.6 });
  const g = new THREE.Group(); g.add(new THREE.Mesh(bakedActorGeometry(`trophy:${id}`), mat));
  return g;
}
export interface ElitesCtx {
  game: Game; sky: Sky; player: Player;
  charge: SpawnScriptRows;
  ledges: Ledge[];
  phase: () => string;
  storm: () => boolean;
}
export interface ElitesPlay {
  persistence?: ElitePersistence;
  animals: AnimalManager;
  wildlife: Wildlife | null;
  taming: { phase: string; tulpar: Animal | null } | null;
  ghosts: GhostsApi | null;
  interactables: Interactable[];
  toast: (text: string) => void;
  feed: (text: string) => void;
  record: (kind: string, variant: string) => void;
  sting?: (event: 'banner' | 'phase2' | 'kill') => void;
  pickupHum?: (inside: boolean) => void;
  sound?: (name: EliteSound, at: THREE.Vector3) => void;
  params: URLSearchParams;
}
export class NalatiElites {
  bar: EliteBar | null = null;
  elites: Elites | null = null;
  scripts: EliteScript[] = [];
  readonly skins = new Set<string>();
  ghosts: GhostsApi | null = null;
  constructor(private readonly ctx: ElitesCtx) {}
  bind(play: ElitesPlay): void {
    const { game, sky, player } = this.ctx;
    const bar = new EliteBar();
    this.bar = bar;
    const condition = (rule: EliteRule): boolean => eliteRuleHolds(rule, this.ctx.phase(), this.ctx.storm());
    const elites = new Elites({
      scene: game.scene, camera: game.camera, renderer: game.renderer, player, condition,
      addInteractable: (it) => { play.interactables.push(it); },
      removeInteractable: (it) => { const i = play.interactables.indexOf(it); if (i !== -1) play.interactables.splice(i, 1); },
      toast: play.toast,
      ...(play.sting ? { sting: play.sting } : {}),
      ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
      ownSkin: (s) => { this.skins.add(s); },
    }, bar, 'nalati-grasslands', play.persistence);
    this.elites = elites;
    const env: Env = {
      game, sky, player, charge: this.ctx.charge, animals: play.animals, elites, bar, wildlife: play.wildlife, taming: play.taming, ghosts: play.ghosts ?? this.ghosts, ledges: this.ctx.ledges,
      hurt: (a, dmg) => {
        const spec = dmg === 14 ? NALATI_STRIKES.swipe : dmg === 35 ? NALATI_STRIKES.pounce : dmg === 22 ? NALATI_STRIKES.bite : dmg === 30 ? NALATI_STRIKES.stoop : NALATI_STRIKES.captain;
        sampleStrike(spec, a, player.position, () => { encounterHit(a, dmg, `elite.${a.variant}`, player.position); }, { reach: () => canReach(a, player.position, app.physics) });
      },
      knock: (dx, dz) => { const l = Math.hypot(dx, dz) || 1; wildEnv.onKnockdown?.(dx / l, dz / l, 1); },
      feed: play.feed, record: play.record,
      sound: (name, at) => { play.sound?.(name, at); },
    };
    this.scripts = [
      bindKeeper(ecology.elites['aqbars'] ?? fail('aqbars'), env, 'pouncer'),
      bindKeeper(ecology.elites['kokbori'] ?? fail('kokbori'), env, 'howler'),
      bindKeeper(ecology.elites['qyran'] ?? fail('qyran'), env, 'wind'),
      new QaraBatyr(ecology.elites['qara-batyr'] ?? fail('qara-batyr'), env),
      new Argymaq(ecology.elites['argymaq'] ?? fail('argymaq'), env),
    ];
    for (const s of this.scripts) { app.encounters.elite(s.def.id, s, game.levelScope); elites.add(s); const skin = s.def.drop.skin; if (skin !== null && elites.owned(s.def.id)) this.skins.add(skin); }
    for (const [k, v] of [[LEOPARD, 'aqbars'], [EAGLE, 'qyran'], [KOKBORI, 'kokbori']] as const) { try { play.animals.factory.model(k, v); } catch (e) { console.warn(`[elites] ${k} did not build`, e); } }
    this.ctx.game.levelScope.onDispose(app.debug.scopedExpose('nalati.elites', this));
  }
  initialize(): void { this.elites?.initialize(); }
  update(dt: number, t: number): void { this.elites?.update(dt, t); }
}
function fail(id: string): never { throw new Error(`elites: no def '${id}'`); }
export function wireElites(ctx: ElitesCtx): NalatiElites { return new NalatiElites(ctx); }
function hasNalatiSpecies(kind: string): boolean { return app.species.get(kind) !== undefined || hasLegacySpecies(kind); }
