import type { ShardContext } from '@wildshard/game/shard/context';
import type { TimedEncountersRows } from '@wildshard/format/encounterRows';
import { Vector3, type BufferGeometry } from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { canReach } from '@wildshard/engine/ai/reach';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import type { TargetHit } from '@wildshard/engine/combat/types';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Game } from '@wildshard/engine/core/Game';
import type { Player } from '@wildshard/engine/player/Player';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { CueDirector } from '@wildshard/game/audio/cueDirector';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { wildEnv } from '@wildshard/game/population/pageGroups';
import { PatrolEncounterView, SlotEncounterView, type EncounterSites } from '@wildshard/game/boss/encounterView';

interface TimedEncounterContext {
  readonly game: Game; readonly sky: SkyRig; readonly player: Player; readonly forest: Forest;
  readonly sites: EncounterSites | null; readonly clock: DayCycleClock;
}
/** Listed Nalati night binding over existing AS and native slot/patrol views. */
export class NalatiNight {
  readonly slots: SlotEncounterView; readonly riders: PatrolEncounterView;
  private readonly rows; private readonly strike;
  private readonly contacts = new StrikeRunner(); private readonly direction = new Vector3();
  constructor(private readonly ctx: TimedEncounterContext, input: TimedEncountersRows,
    figures: Readonly<Record<string, BufferGeometry>>, guest: ReturnProgram, private readonly cues: CueDirector) {
    const rows = this.rows = input, scope = ctx.game.levelScope;
    if (scope.disposed) throw new Error('Encounter owner was disposed during admission');
    this.strike = strikeFromData(rows.contact.strike);
    const program = ReturnProgram.page(rows.program, scope);
    this.slots = new SlotEncounterView(rows.slots, rows.view, program, { scene: ctx.game.scene, cues: this.cues, sites: ctx.sites?.sites ?? null, guest });
    this.riders = new PatrolEncounterView({ patrol: rows.patrol, motion: rows.motion, view: rows.ride }, program,
      { game: ctx.game, sky: ctx.sky, player: ctx.player, forest: ctx.forest, cues: this.cues, figures });
  }
  /** Borrow declared presentation owners while the encounter keeps its clock. */
  static async install(owner: ShardContext, ctx: TimedEncounterContext, file: string,
    figures: Readonly<Record<string, BufferGeometry>>, guest: ReturnProgram): Promise<NalatiNight> {
    const input = await owner.product.json<TimedEncountersRows>(file);
    const presentation = CueDirector.entered(owner,input.presentation);
    if (presentation === undefined) throw new Error('Missing declared encounter presentation');
    return new NalatiNight(ctx, input, figures, guest, presentation);
  }
  update(dt: number, time: number): void {
    const { ctx, rows } = this, player = ctx.player;
    ctx.sites?.apply(this.slots.update(dt, { kind: Number(rows.phases.slots.includes(ctx.clock.dayPhase)) }));
    for (const { damage, from } of this.riders.update(dt, time, { hold: 0, night: Number(rows.phases.patrol.includes(ctx.clock.dayPhase)) })) {
      const actor = from ?? this.riders.riders[0]?.a, target = app.player;
      if (actor === undefined || target === null) continue;
      if (!this.contacts.contains(this.strike, { actor, target: player.position,
        ...(rows.contact.origin === 'player' ? { origin: player.position } : {}) }) || !canReach(actor, player.position, app.physics)) continue;
      app.combat.hit({ source: 'env', sourceTags: rows.contact.tags, target, amount: damage,
        point: actor.position, dir: this.direction.set(0, 0, 0), cause: { kind: actor.kind, label: actor.label } });
    }
    this.cues.setLight(Math.max(rows.lightFloor, wildEnv.light)); this.cues.update(dt);
  }
  attach(animals: AnimalManager): void {
    try { this.slots.attachActors(animals); } catch (cause) { console.error('[encounters] slot actors disabled:', cause); }
    try { this.riders.attachActors(animals); } catch (cause) { console.error('[encounters] patrol actors disabled:', cause); }
  }
  target(origin: Vector3, direction: Vector3, maxDistance: number, hit: TargetHit | null): TargetHit | null {
    return this.riders.target(origin, direction, maxDistance, hit);
  }
}
