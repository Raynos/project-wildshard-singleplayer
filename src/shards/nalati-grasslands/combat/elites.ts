import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { SpawnScript } from '@wildshard/game/population/spawnScript';
import { ArgymaqKeeper, eliteAdmission } from '../runtime/argymaqKeeper';
import { NALATI_STRIKES, sampleStrike } from './strikes';
import { registerNalatiDefinition } from '../species/rows';
import { argymaqDefinition } from './eliteRoster';
import type { SpawnScriptRows } from '@wildshard/format/spawnScripts';
import { EliteBrain } from '@wildshard/engine/ai/EliteBrain';
import { pinBrain } from '@wildshard/engine/ai/inspect';
import { canReach } from '@wildshard/engine/ai/reach';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { KeeperElitePage, setEliteDamage } from '@wildshard/game/quest/elitePage';
import { hasSpecies as hasLegacySpecies, speciesDef } from '@wildshard/engine/entities/species/registry';
import type { Player } from '@wildshard/engine/player/Player';
import { EliteBar } from '@wildshard/engine/ui/EliteBar';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { encounterHit } from './damage';
import * as THREE from 'three';
import type { Wildlife } from '../creatures/wildlife';
import type { HerdController } from '../runtime/groupRegistry';
import type { Ledge } from '../world/types';
import { wildEnv } from '../creatures/env';
import { LEOPARD } from '../species/leopard';
import { EAGLE } from '../species/eagle';
import { KOKBORI } from '../species/kokbori';
import { Elites, GroundTell, type EliteDef, type EliteScript, type EliteRule, type ElitePersistence } from '@wildshard/game/Elite';
import { bakedActorGeometry } from '../world/places';
import poiLayoutRows from '../boot/poiLayout.generated.json' with { type: 'json' };

const { EAGLE_ROCK } = poiLayoutRows;
export type EliteSound = string;
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
export interface GhostsApi {
  spawnRider: (o: { x: number; z: number; yaw: number; variant?: 'rider' | 'captain' }) => Animal | null;
  spawnLine: (o: { count?: number; captain?: boolean; at?: number }) => Animal[];
  dissolve: (a: Animal) => void;
  readonly killsTonight: number;
}
class QaraBatyr extends Base {
  private program: SpawnScript | null = null;
  private line: Animal[] = [];
  private elapsed = 0;
  private readonly decisions = eliteAdmission();
  private readonly tell = new GroundTell(this.env.game.scene, 'lane', new THREE.Color(0.35, 1.6, 1.9));
  canSpawn(): boolean { return this.env.ghosts !== null && this.decisions.project('eliteAux', { kills: this.env.ghosts.killsTonight, engaged: 0, line: 0 })['accept'] === 1; }
  override spawn(): void {
    const c = this.def.lair, a = this.env.ghosts?.spawnRider({ x: c.x, z: c.z, yaw: 0, variant: 'captain' });
    if (a === undefined || a === null) return;
    this.animal = a; this.program = SpawnScript.page(this.env.animals, this.env.charge, app.physics); this.program.adopt('main', a.entityId);
    setEliteDamage(a, (_body, point) => this.decisions.project('eliteDamage', { mode: Number(this.program?.state('main')['mode'] ?? 0), distance: point.distanceTo(this.env.player.position) })['scale'] ?? 1);
  }
  override despawn(): void {
    this.engagement(false); this.tell.hide(); this.program?.interrupt();
    for (const a of this.line) if (a.alive) this.env.ghosts?.dissolve(a); this.line = [];
    if (this.animal !== null) this.env.ghosts?.dissolve(this.animal); this.animal = null; this.program = null;
  }
  override reset(): void { super.reset(); this.program?.interrupt(); this.program?.signal('main', 0); this.tell.hide(); }
  override tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    this.engagement(engaged); const program = this.program, a = this.animal; if (program === null || a === null) return;
    this.elapsed += dt;
    if (this.elapsed + 1e-9 >= .1) {
      this.elapsed = 0;
      const count = this.decisions.project('eliteAux', { kills: this.env.ghosts?.killsTonight ?? 0, engaged: Number(engaged), line: this.line.filter(body => body.alive).length })['count'] ?? 0;
      if (count > 0) this.line = this.env.ghosts?.spawnLine({ count }) ?? [];
    }
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
const keeperEnvs = new WeakMap<NalatiElites, Env>();
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
    const decisions = eliteAdmission();
    const condition = (rule: EliteRule): boolean => decisions.project('eliteRule', {
      rule: rule === 'always' ? 0 : rule === 'storm' ? 1 : rule === 'night' ? 2 : 3,
      phase: this.ctx.phase() === 'night' ? 2 : this.ctx.phase() === 'dusk' ? 1 : 0, storm: Number(this.ctx.storm()),
    })['accept'] === 1;
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
    keeperEnvs.set(this, env);
    this.scripts = [
      ...ecology.keeperElites.map(row => new KeeperElitePage(row, { game, player, animals: play.animals, elites, bar, ledges: env.ledges, rock: EAGLE_ROCK }, trophyModel(row.def.id, sky))),
      new QaraBatyr(ecology.elites['qara-batyr'] ?? fail('qara-batyr'), env),
      new Argymaq(ecology.elites['argymaq'] ?? fail('argymaq'), env),
    ];
    for (const s of this.scripts) { app.encounters.elite(s.def.id, s, game.levelScope); elites.add(s); const skin = s.def.drop.skin; if (skin !== null && elites.owned(s.def.id)) this.skins.add(skin); }
    for (const [k, v] of [[LEOPARD, 'aqbars'], [EAGLE, 'qyran'], [KOKBORI, 'kokbori']] as const) { try { play.animals.factory.model(k, v); } catch (e) { console.warn(`[elites] ${k} did not build`, e); } }
    this.ctx.game.levelScope.onDispose(app.debug.scopedExpose('nalati.elites', { scripts: this.scripts, elites, bar }));
  }
  initialize(): void { this.elites?.initialize(); }
  update(dt: number, t: number): void {
    for (const script of this.scripts) if (script instanceof KeeperElitePage) {
      const at = script.animal?.position;
      script.observe({ playerCrouched: wildEnv.playerCrouched, playerFwdX: wildEnv.playerFwdX, playerFwdZ: wildEnv.playerFwdZ,
        grassHeight: at === undefined ? 0 : wildEnv.grassHeightAt(at.x, at.z), wind: wildEnv.wind });
    }
    this.elites?.update(dt, t);
    const env = keeperEnvs.get(this); if (env === undefined) return;
    for (const script of this.scripts) if (script instanceof KeeperElitePage) for (const effect of script.drainEffects()) {
      if (effect.kind === 'hit') env.hurt(effect.animal, effect.amount);
      else if (effect.kind === 'knock') env.knock(effect.x, effect.z);
      else if (effect.kind === 'feed') env.feed(effect.id);
      else if (effect.kind === 'sound') env.sound(effect.id, effect.at);
      else {
        const pack = env.wildlife?.spawnPack(effect.x, effect.z, [...effect.variants]) ?? null;
        if (pack !== null) { pack.homeX = script.def.lair.x; pack.homeZ = script.def.lair.z; } script.pack = pack;
      }
    }
  }
}
function fail(id: string): never { throw new Error(`elites: no def '${id}'`); }
export function wireElites(ctx: ElitesCtx): NalatiElites { return new NalatiElites(ctx); }
function hasNalatiSpecies(kind: string): boolean { return app.species.get(kind) !== undefined || hasLegacySpecies(kind); }
