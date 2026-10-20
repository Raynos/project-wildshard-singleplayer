import * as v from 'valibot';
import { Vector3, type BufferGeometry } from 'three';
import { CreatureStrikeSchema } from '@wildshard/format/creatures';
import { app } from '@wildshard/engine/app/runtime';
import { canReach } from '@wildshard/engine/ai/reach';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import type { CombatTag } from '@wildshard/engine/combat/pipeline';
import type { TargetHit } from '@wildshard/engine/combat/types';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Game } from '@wildshard/engine/core/Game';
import type { Player } from '@wildshard/engine/player/Player';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { CueDirector } from '../audio/cueDirector';
import { ReturnProgram } from '../population/returnProgram';
import { wildEnv } from '../population/pageGroups';
import type { PageCreatureGuest } from '../population/creatureGuest';
import { PatrolEncounterView, SlotEncounterView, type EncounterSites } from './encounterView';

const tag = v.custom<CombatTag>(value => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.*-]+$/u.test(value));
/** A timed encounter composition names phase membership, native rows and contact. */
export const TimedEncountersSchema = v.object({ program: v.unknown(), cues: v.unknown(), slots: v.unknown(), view: v.unknown(),
  patrol: v.unknown(), motion: v.unknown(), ride: v.unknown(), phases: v.strictObject({ slots: v.array(v.string()), patrol: v.array(v.string()) }),
  lightFloor: v.pipe(v.number(), v.finite(), v.minValue(0)),
  contact: v.strictObject({ strike: CreatureStrikeSchema, tags: v.array(tag), origin: v.picklist(['actor', 'player']) }),
});
interface TimedEncounterContext {
  readonly game: Game; readonly sky: SkyRig; readonly player: Player; readonly forest: Forest;
  readonly sites: EncounterSites | null; readonly clock: DayCycleClock;
}
/** Client-only composition of approved slot and patrol owners. Content supplies
 * rows and prepared geometry; existing authorities retain bodies and damage. */
export class TimedEncounters {
  readonly slots: SlotEncounterView; readonly riders: PatrolEncounterView;
  private readonly cues: CueDirector; private readonly rows; private readonly strike;
  private readonly contacts = new StrikeRunner(); private readonly direction = new Vector3();
  constructor(private readonly ctx: TimedEncounterContext, input: unknown,
    figures: Readonly<Record<string, BufferGeometry>>, guest: PageCreatureGuest) {
    const rows = this.rows = v.parse(TimedEncountersSchema, input), scope = ctx.game.levelScope;
    if (scope.disposed) throw new Error('Encounter owner was disposed during admission');
    this.strike = strikeFromData(rows.contact.strike); this.cues = new CueDirector(ctx.game, rows.cues, scope);
    const program = ReturnProgram.page(rows.program, scope);
    this.slots = new SlotEncounterView(rows.slots, rows.view, program, { scene: ctx.game.scene, cues: this.cues, sites: ctx.sites?.sites ?? null, guest });
    this.riders = new PatrolEncounterView({ patrol: rows.patrol, motion: rows.motion, view: rows.ride }, program,
      { game: ctx.game, sky: ctx.sky, player: ctx.player, forest: ctx.forest, cues: this.cues, figures });
  }
  update(dt: number, time: number): void {
    const { ctx, rows } = this, player = ctx.player;
    ctx.sites?.apply(this.slots.update(dt, { kind: Number(rows.phases.slots.includes(ctx.clock.dayPhase)) }));
    for (const { damage, from } of this.riders.update(dt, time, { hold: 0, night: Number(rows.phases.patrol.includes(ctx.clock.dayPhase)) })) {
      const actor = from ?? this.riders.riders[0]?.a, target = app.player;
      if (actor === undefined || target === null) continue;
      this.contacts.contact(this.strike, { actor, target: player.position,
        ...(rows.contact.origin === 'player' ? { origin: player.position } : {}), canReach: () => true, hit: () => {
          if (!canReach(actor, player.position, app.physics)) return;
          app.combat.hit({ source: 'env', sourceTags: rows.contact.tags, target, amount: damage,
            point: actor.position, dir: this.direction.set(0, 0, 0), cause: { kind: actor.kind, label: actor.label } });
        } });
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
