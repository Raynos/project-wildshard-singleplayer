import { Vector3 } from 'three';
import { parse } from 'valibot';
import type { Game } from '@wildshard/engine/core/Game';
import type { Scope } from '@wildshard/engine/app/scope';
import type { CombatCues } from '@wildshard/engine/combat/cues';
import { Impacts } from '@wildshard/engine/fx/Impacts';
import { effectField, type EffectField } from '@wildshard/engine/fx/effectField';
import { CueDirectorSchema, type CueDirectorRows } from '@wildshard/format/cueDirector';
import type { ShardContext } from '../plugin/context';
import { sceneModelSource } from '../shardfile/sceneSources';

/** Client-only cue director over real audio, particle and effect-field owners.
 * Callers supply cue ids and native point/direction values, never handlers. */
export class CueDirector {
  private readonly rows: CueDirectorRows;
  private readonly fields = new Map<string, EffectField>();
  private readonly at = new Vector3(); private readonly direction = new Vector3();
  private readonly game: Game; private readonly scope: Scope; private readonly sounds: CombatCues | undefined;
  constructor(game: Game, input: unknown, scope: Scope = game.levelScope, sounds?: CombatCues) {
    this.game = game; this.scope = scope; this.sounds = sounds;
    this.rows = parse(CueDirectorSchema, input);
    if (this.rows.rows.some(row => row.sound !== undefined) && sounds === undefined) throw new Error('Cue director requires its native sound owner');
  }
  /** Prepare the declared fields using the resident scene's compiled looks.
   * Its entered scope owns geometry and clocks, borrowing material lifetime. */
  static install(ctx: ShardContext, input: unknown): CueDirector {
    const runtime = ctx.game.runtime;
    if (runtime?.world === undefined || runtime.world === null || runtime.play === null) throw new Error('Cue director requires its entered world');
    const director = new CueDirector(runtime.world.game, input, ctx.scope, runtime.play.cues);
    for (const row of director.rows.fields) {
      const material = sceneModelSource(ctx.product, row.library).look(row.look);
      if (material === undefined) throw new Error(`Missing cue field look: ${row.look}`);
      const field = effectField(row, material); director.fields.set(row.id, field);
      ctx.root.add(field.object); ctx.scope.own(field.geometry); ctx.scope.onDispose(() => { field.object.removeFromParent(); });
      if (row.place !== undefined) field.place(new Vector3(...row.place.at), new Vector3(...row.place.aim));
    }
    ctx.system({ id: 'cue.director', phase: 'update', run: dt => { for (const field of director.fields.values()) field.update(dt); } });
    return director;
  }
  /** Preserve one shared salt per cue, synchronous VFX-before-sound order,
   * and scope-owned delayed dispatch with copied source positions. */
  cue(id: string, point: Vector3, direction: Vector3): void {
    if (this.scope.disposed) throw new Error('Cue director owner is disposed');
    const row = this.rows.rows.find(candidate => candidate.id === id);
    if (row === undefined) throw new Error(`Unknown directed cue: ${id}`);
    for (const target of row.vfx) if (target.kind === 'field' && !this.fields.has(target.field)) throw new Error(`Unprepared cue field: ${target.field}`);
    if (row.delay !== undefined && row.delay > 0) {
      const at = point.clone(), aim = direction.clone();
      this.scope.timeout(row.delay * 1000, () => { this.dispatch(row, at, aim); });
    } else this.dispatch(row, point, direction);
  }
  private dispatch(row: CueDirectorRows['rows'][number], point: Vector3, direction: Vector3): void {
    const salt = row.vfx.some(target => target.kind === 'field') ? this.game.app.rng.stream('cosmetic').next() : 0;
    for (const target of row.vfx) {
      this.at.set(point.x + target.offset[0], point.y + target.offset[1], point.z + target.offset[2]); this.direction.copy(direction);
      if (target.kind === 'impact') {
        if (target.reverse) this.direction.negate();
        Impacts.for(this.game).burst(target.material, this.at, this.direction, target.count);
      } else {
        this.at.x += direction.x * target.ahead; this.at.z += direction.z * target.ahead;
        const field = this.fields.get(target.field);
        if (field === undefined) throw new Error(`Unprepared cue field: ${target.field}`);
        field.burst(this.at, direction, salt);
      }
    }
    if (row.sound !== undefined) {
      if (this.sounds === undefined) throw new Error('Cue sound owner is absent');
      this.sounds.cue(row.sound as `cue.${string}`, row.soundPhase === undefined ? {} : { phase: row.soundPhase });
    }
  }
}
