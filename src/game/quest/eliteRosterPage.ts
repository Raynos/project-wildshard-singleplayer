import type { PatrolEncounterView } from '../boss/encounterView';
import { EventConditions, type ReturnProgram } from '../population/returnProgram';
import type { SpawnScriptRows } from '@wildshard/format/spawnScripts';
import { canReach } from '@wildshard/engine/ai/reach';
import { app } from '@wildshard/engine/app/runtime';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import { EliteBar } from '@wildshard/engine/ui/EliteBar';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { PouncerLedge } from '@wildshard/engine/ai/stalker';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { strikeFromData, type StrikeData } from '@wildshard/engine/ai/strikeRows';
import { Vector3, type Object3D } from 'three';
import type { PageWildlife } from '../population/wildlife';
import type { CrowdTargets } from '../shardfile/crowdRuntime';
import { wildEnv } from '../population/pageGroups';
import { Elites, type EliteScript } from '../Elite';
import { KeeperElitePage, ExternalElitePage, type KeeperEliteRow, type ExternalEliteRow } from './elitePage';
import type { AdventurePersistence } from './persistence';

/** Client-only named encounter roster. Content supplies rows and prepared drop
 * models; concrete entered authorities retain bodies, rewards and audio. */
export interface EliteRosterRows {
  readonly keepers: readonly KeeperEliteRow[]; readonly external: readonly ExternalEliteRow[];
  readonly conditions: ConstructorParameters<typeof EventConditions>[1];
  readonly strikes: readonly { readonly amount: number; readonly strike: StrikeData }[];
  readonly debug?: string; readonly fallbackStrike: StrikeData; readonly knockDuration: number;
  readonly prewarm: readonly { readonly kind: string; readonly variant: string }[];
}
type Ghosts = Pick<PatrolEncounterView, 'spawnRider' | 'spawnLine' | 'dissolve' | 'killsTonight'>;
interface EnteredPlay<T extends CrowdTargets> {
  readonly persistence: AdventurePersistence; readonly animals: AnimalManager;
  readonly wildlife: PageWildlife<T> | null;
  readonly taming: { readonly phase: string; readonly companion: Animal | null } | null;
  readonly interactables: Interactable[]; readonly hud: HUD; readonly audio: Audio; readonly music: Music;
}
interface RosterContext {
  readonly game: Game; readonly player: Player; readonly ledges: readonly PouncerLedge[];
  readonly rock: { readonly x: number; readonly z: number; readonly top: number };
  readonly clock: DayCycleClock; readonly weather: { readonly stormActive: boolean };
}
export class EliteRosterPage<T extends CrowdTargets = CrowdTargets> {
  bar: EliteBar | null = null; elites: Elites | null = null; scripts: EliteScript[] = [];
  readonly skins = new Set<string>(); ghosts: Ghosts | null = null;
  private play: EnteredPlay<T> | null = null;
  private conditions: EventConditions | null = null;
  private readonly contacts = new StrikeRunner();
  private readonly direction = new Vector3();
  constructor(private readonly ctx: RosterContext, private readonly rows: EliteRosterRows,
    private readonly decisions: ReturnProgram, private readonly models: ReadonlyMap<string, Object3D>, private readonly charge: SpawnScriptRows) {
    const ids = [...rows.keepers, ...rows.external].map(row => row.def.id);
    if (new Set(ids).size !== ids.length || ids.some(id => !models.has(id))) throw new Error('Invalid elite roster models or identities');
  }
  bind(play: EnteredPlay<T>): void {
    const { game, player } = this.ctx; this.play = play;
    const bar = new EliteBar(); this.bar = bar;
    const conditions = new EventConditions(this.decisions, this.rows.conditions); this.conditions = conditions;
    conditions.update(0, this.conditionFrame());
    const elites = new Elites({ scene: game.scene, camera: game.camera, renderer: game.renderer, player,
      condition: rule => conditions.holds(rule),
      addInteractable: it => { play.interactables.push(it); },
      removeInteractable: it => { const index = play.interactables.indexOf(it); if (index !== -1) play.interactables.splice(index, 1); },
      toast: text => { play.hud.toast(text); }, pickupHum: on => { play.audio.pickupHum(on); },
      sting: event => { if (event === 'kill') play.music.sting('chunk'); else play.music.combat(event === 'phase2' ? 1 : .8); },
      ownSkin: skin => { this.skins.add(skin); },
    }, bar, game.level.id, play.persistence.elites); this.elites = elites;
    const model = (id: string): Object3D => { const value = this.models.get(id); if (value === undefined) throw new Error('Missing elite drop model'); return value; };
    this.scripts = [
      ...this.rows.keepers.map(row => new KeeperElitePage(row, { game, player, animals: play.animals, elites, bar, ledges: this.ctx.ledges, rock: this.ctx.rock }, model(row.def.id))),
      ...this.rows.external.map(row => new ExternalElitePage(row, { game, player, animals: play.animals, elites }, this.decisions, model(row.def.id), row.mode === 'script' ? this.charge : undefined)),
    ];
    for (const script of this.scripts) { app.encounters.elite(script.def.id, script, game.levelScope); elites.add(script); const skin = script.def.drop.skin; if (skin !== null && elites.owned(script.def.id)) this.skins.add(skin); }
    if (this.rows.debug !== undefined) game.levelScope.onDispose(app.debug.scopedExpose(this.rows.debug, { scripts: this.scripts, elites, bar }));
    for (const row of this.rows.prewarm) { try { play.animals.factory.model(row.kind, row.variant); } catch (cause) { console.warn('[elites] prewarm failed', row.kind, cause); } }
  }
  private conditionFrame(): { phase: number; storm: number } {
    const phase = this.ctx.clock.dayPhase; return { phase: phase === 'night' ? 2 : phase === 'dusk' ? 1 : 0, storm: Number(this.ctx.weather.stormActive) };
  }
  initialize(): void { this.observeExternal(0); this.elites?.initialize(); this.drainEffects(); }
  private observeExternal(dt: number): void {
    const play = this.play; if (play === null) return;
    for (const script of this.scripts) if (script instanceof ExternalElitePage) script.observe(dt, {
      available: script.row.mode === 'script' ? this.ghosts !== null : play.wildlife !== null,
      kills: this.ghosts?.killsTonight ?? 0, bonded: play.taming?.phase === 'bonded', mount: play.taming?.companion ?? null });
  }
  update(dt: number, t: number): void {
    for (const script of this.scripts) if (script instanceof KeeperElitePage) {
      const at = script.animal?.position;
      script.observe({ playerCrouched: wildEnv.playerCrouched, playerFwdX: wildEnv.playerFwdX, playerFwdZ: wildEnv.playerFwdZ,
        grassHeight: at === undefined ? 0 : wildEnv.grassHeightAt(at.x, at.z), wind: wildEnv.wind });
    }
    this.conditions?.update(dt, this.conditionFrame()); this.observeExternal(dt); this.elites?.update(dt, t); this.drainEffects();
  }
  private hurt(actor: Animal, amount: number): void {
    const target = app.player, player = this.ctx.player;
    if (target === null) return;
    const strike = strikeFromData(this.rows.strikes.find(row => row.amount === amount)?.strike ?? this.rows.fallbackStrike);
    this.contacts.contact(strike, { actor, target: player.position, canReach: () => canReach(actor, player.position, app.physics), hit: () => {
      if (!canReach(actor, player.position, app.physics)) return;
      app.combat.hit({ source: 'env', sourceTags: [`elite.${actor.variant}`, 'feel.blow', 'cover.checked'], target, amount,
        point: actor.position, dir: this.direction.set(0, 0, 0), cause: { kind: actor.kind, label: actor.label } });
    } });
  }
  private drainEffects(): void {
    const play = this.play; if (play === null) return;
    for (const script of this.scripts) if (script instanceof KeeperElitePage || script instanceof ExternalElitePage) for (const effect of script.drainEffects()) {
      if (effect.kind === 'hit') this.hurt(effect.animal, effect.amount);
      else if (effect.kind === 'knock') { const length = Math.hypot(effect.x, effect.z) || 1; wildEnv.onKnockdown(effect.x / length, effect.z / length, this.rows.knockDuration); }
      else if (effect.kind === 'feed') play.hud.killFeed(effect.id);
      else if (effect.kind === 'sound') play.audio.animal(effect.id, effect.at, this.ctx.player.position, this.ctx.player.yaw);
      else if (effect.kind === 'record') { play.persistence.kill(effect.species, effect.variant); play.persistence.feat(effect.species); }
      else if (effect.kind === 'retire') this.ghosts?.dissolve(effect.actor);
      else if (effect.kind === 'support' && script instanceof ExternalElitePage) script.support(this.ghosts?.spawnLine({ count: effect.count }) ?? []);
      else if (effect.kind === 'request' && script instanceof ExternalElitePage) {
        const row = effect.row, point = row.def.lair;
        if (row.mode === 'script') { const actor = this.ghosts?.spawnRider({ x: point.x, z: point.z, yaw: row.spawn.yaw, variant: row.spawn.variant }); if (actor !== undefined && actor !== null) script.adopt(actor); }
        else {
          const herd = play.wildlife?.spawnHerd(point.x + row.spawn.offset[0], point.z + row.spawn.offset[1], row.spawn.mares, row.spawn.foals, row.spawn.stallion);
          if (herd === undefined) continue;
          const actor = play.animals.spawn(row.spawn.kind, point.x, point.z, row.spawn.yaw, row.spawn.variant), index = herd.members[0]?.herd ?? -1;
          actor.herd = index; if (index >= 0) play.animals.herds[index]?.members.push(actor); herd.adoptStallion(actor); script.adopt(actor, herd);
        }
      } else if (effect.kind === 'pack' && script instanceof KeeperElitePage) {
        const pack = play.wildlife?.spawnPack(effect.x, effect.z, effect.variants) ?? null;
        if (pack !== null) { pack.homeX = script.def.lair.x; pack.homeZ = script.def.lair.z; } script.pack = pack;
      }
    }
  }
}
