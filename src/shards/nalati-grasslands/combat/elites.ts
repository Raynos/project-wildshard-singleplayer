import { EventConditions } from '@wildshard/game/population/returnProgram';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { eliteAdmission } from '../runtime/argymaqKeeper';
import { NALATI_STRIKES, sampleStrike } from './strikes';
import { registerNalatiDefinition } from '../species/rows';
import { argymaqDefinition } from './eliteRoster';
import type { SpawnScriptRows } from '@wildshard/format/spawnScripts';
import { canReach } from '@wildshard/engine/ai/reach';
import { app } from '@wildshard/engine/app/runtime';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { KeeperElitePage, ExternalElitePage } from '@wildshard/game/quest/elitePage';
import { hasSpecies as hasLegacySpecies, speciesDef } from '@wildshard/engine/entities/species/registry';
import type { Player } from '@wildshard/engine/player/Player';
import { EliteBar } from '@wildshard/engine/ui/EliteBar';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { encounterHit } from './damage';
import * as THREE from 'three';
import type { Wildlife } from '../creatures/wildlife';
import type { Ledge } from '../world/types';
import { wildEnv } from '../creatures/env';
import { LEOPARD } from '../species/leopard';
import { EAGLE } from '../species/eagle';
import { KOKBORI } from '../species/kokbori';
import { Elites, type EliteScript, type ElitePersistence } from '@wildshard/game/Elite';
import { bakedActorGeometry } from '../world/places';
import poiLayoutRows from '../boot/poiLayout.generated.json' with { type: 'json' };

const { EAGLE_ROCK } = poiLayoutRows;
export type EliteSound = string;
interface Env {
  game: Game; sky: Sky; player: Player; animals: AnimalManager; charge: SpawnScriptRows;
  elites: Elites; bar: EliteBar; conditions: EventConditions;
  wildlife: Wildlife | null;
  taming: { phase: string; companion: Animal | null } | null;
  ghosts: GhostsApi | null;
  ledges: Ledge[];
  hurt: (a: Animal, dmg: number) => void;
  knock: (dx: number, dz: number) => void;
  feed: (text: string) => void;
  record: (kind: string, variant: string) => void;
  sound: (name: EliteSound, at: THREE.Vector3) => void;
}
export interface GhostsApi {
  spawnRider: (o: { x: number; z: number; yaw: number; variant?: 'rider' | 'captain' }) => Animal | null;
  spawnLine: (o: { count?: number; captain?: boolean; at?: number }) => Animal[];
  dissolve: (a: Animal) => void;
  readonly killsTonight: number;
}
export const ARGYMAQ = ecology.argymaq;
export function registerArgymaq(): void {
  if (hasNalatiSpecies(ARGYMAQ) || !hasNalatiSpecies('horse')) return;
  const H = speciesDef('horse');
  const base = H.variants.find((v) => v.id === 'stallion') ?? H.variants[0];
  if (base === undefined) return;
  registerNalatiDefinition(argymaqDefinition(H, base));
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
  taming: { phase: string; companion: Animal | null } | null;
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
    const conditions = new EventConditions(decisions, [
      { id: 'always', signal: 'eliteRule', observations: { rule: 0 } }, { id: 'storm', signal: 'eliteRule', observations: { rule: 1 } },
      { id: 'night', signal: 'eliteRule', observations: { rule: 2 } }, { id: 'dusk', signal: 'eliteRule', observations: { rule: 3 } },
    ]);
    conditions.update(0, this.conditionFrame());
    const elites = new Elites({
      scene: game.scene, camera: game.camera, renderer: game.renderer, player, condition: rule => conditions.holds(rule),
      addInteractable: (it) => { play.interactables.push(it); },
      removeInteractable: (it) => { const i = play.interactables.indexOf(it); if (i !== -1) play.interactables.splice(i, 1); },
      toast: play.toast,
      ...(play.sting ? { sting: play.sting } : {}),
      ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
      ownSkin: (s) => { this.skins.add(s); },
    }, bar, 'nalati-grasslands', play.persistence);
    this.elites = elites;
    const env: Env = {
      game, sky, player, charge: this.ctx.charge, animals: play.animals, elites, bar, conditions, wildlife: play.wildlife, taming: play.taming, ghosts: play.ghosts ?? this.ghosts, ledges: this.ctx.ledges,
      hurt: (a, dmg) => {
        const spec = dmg === 14 ? NALATI_STRIKES.swipe : dmg === 35 ? NALATI_STRIKES.pounce : dmg === 22 ? NALATI_STRIKES.bite : dmg === 30 ? NALATI_STRIKES.stoop : NALATI_STRIKES.captain;
        sampleStrike(spec, a, player.position, () => { encounterHit(a, dmg, `elite.${a.variant}`, player.position); }, { reach: () => canReach(a, player.position, app.physics) });
      },
      knock: (dx, dz) => { const l = Math.hypot(dx, dz) || 1; wildEnv.onKnockdown?.(dx / l, dz / l, 1); },
      feed: play.feed, record: play.record,
      sound: (name, at) => { play.sound?.(name, at); },
    };
    keeperEnvs.set(this, env);
    registerArgymaq();
    this.scripts = [
      ...ecology.keeperElites.map(row => new KeeperElitePage(row, { game, player, animals: play.animals, elites, bar, ledges: env.ledges, rock: EAGLE_ROCK }, trophyModel(row.def.id, sky))),
      ...ecology.externalElites.map(row => new ExternalElitePage(row, { game, player, animals: play.animals, elites }, decisions, trophyModel(row.def.id, sky), row.mode === 'script' ? this.ctx.charge : undefined)),
    ];
    for (const s of this.scripts) { app.encounters.elite(s.def.id, s, game.levelScope); elites.add(s); const skin = s.def.drop.skin; if (skin !== null && elites.owned(s.def.id)) this.skins.add(skin); }
    for (const [k, v] of [[LEOPARD, 'aqbars'], [EAGLE, 'qyran'], [KOKBORI, 'kokbori']] as const) { try { play.animals.factory.model(k, v); } catch (e) { console.warn(`[elites] ${k} did not build`, e); } }
    this.ctx.game.levelScope.onDispose(app.debug.scopedExpose('nalati.elites', { scripts: this.scripts, elites, bar }));
  }
  private conditionFrame(): { phase: number; storm: number } { const phase = this.ctx.phase(); return { phase: phase === 'night' ? 2 : phase === 'dusk' ? 1 : 0, storm: Number(this.ctx.storm()) }; }
  initialize(): void { this.observeExternal(0); this.elites?.initialize(); this.drainEffects(); }
  private observeExternal(dt: number): void {
    const env = keeperEnvs.get(this); if (env === undefined) return;
    for (const script of this.scripts) if (script instanceof ExternalElitePage) script.observe(dt, {
      available: script.row.mode === 'script' ? env.ghosts !== null : env.wildlife !== null,
      kills: env.ghosts?.killsTonight ?? 0, bonded: env.taming?.phase === 'bonded', mount: env.taming?.companion ?? null });
  }
  update(dt: number, t: number): void {
    for (const script of this.scripts) if (script instanceof KeeperElitePage) {
      const at = script.animal?.position;
      script.observe({ playerCrouched: wildEnv.playerCrouched, playerFwdX: wildEnv.playerFwdX, playerFwdZ: wildEnv.playerFwdZ,
        grassHeight: at === undefined ? 0 : wildEnv.grassHeightAt(at.x, at.z), wind: wildEnv.wind });
    }
    keeperEnvs.get(this)?.conditions.update(dt, this.conditionFrame());
    this.observeExternal(dt); this.elites?.update(dt, t); this.drainEffects();
  }
  private drainEffects(): void {
    const env = keeperEnvs.get(this); if (env === undefined) return;
    for (const script of this.scripts) if (script instanceof KeeperElitePage || script instanceof ExternalElitePage) for (const effect of script.drainEffects()) {
      if (effect.kind === 'hit') env.hurt(effect.animal, effect.amount);
      else if (effect.kind === 'knock') env.knock(effect.x, effect.z);
      else if (effect.kind === 'feed') env.feed(effect.id);
      else if (effect.kind === 'sound') env.sound(effect.id, effect.at);
      else if (effect.kind === 'record') env.record(effect.species, effect.variant);
      else if (effect.kind === 'retire') env.ghosts?.dissolve(effect.actor);
      else if (effect.kind === 'support' && script instanceof ExternalElitePage) script.support(env.ghosts?.spawnLine({ count: effect.count }) ?? []);
      else if (effect.kind === 'request' && script instanceof ExternalElitePage) {
        const row = effect.row, c = row.def.lair;
        if (row.mode === 'script') { const actor = env.ghosts?.spawnRider({ x: c.x, z: c.z, yaw: row.spawn.yaw, variant: row.spawn.variant }); if (actor !== undefined && actor !== null) script.adopt(actor); }
        else {
          const herd = env.wildlife?.spawnHerd(c.x + row.spawn.offset[0], c.z + row.spawn.offset[1], row.spawn.mares, row.spawn.foals, row.spawn.stallion);
          if (herd === undefined) continue;
          const actor = env.animals.spawn(row.spawn.kind, c.x, c.z, row.spawn.yaw, row.spawn.variant), index = herd.members[0]?.herd ?? -1;
          actor.herd = index; if (index >= 0) env.animals.herds[index]?.members.push(actor); herd.adoptStallion(actor); script.adopt(actor, herd);
        }
      } else if (effect.kind === 'pack' && script instanceof KeeperElitePage) {
        const pack = env.wildlife?.spawnPack(effect.x, effect.z, [...effect.variants]) ?? null;
        if (pack !== null) { pack.homeX = script.def.lair.x; pack.homeZ = script.def.lair.z; } script.pack = pack;
      }
    }
  }
}
export function wireElites(ctx: ElitesCtx): NalatiElites { return new NalatiElites(ctx); }
function hasNalatiSpecies(kind: string): boolean { return app.species.get(kind) !== undefined || hasLegacySpecies(kind); }
