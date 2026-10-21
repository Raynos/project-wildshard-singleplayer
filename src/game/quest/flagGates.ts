import * as v from 'valibot';
import { QuestFlagGatesSchema } from '@wildshard/format/questInteractions';
import { test, type Flags } from '@wildshard/engine/world/interact/flags';
import { staticBoxCollider } from '@wildshard/engine/physics/query';
import { withOwner } from '@wildshard/engine/app/ownership';
import type { SimHost } from '@wildshard/engine/sim';
import type { ShardContext } from '../plugin/context';
import { boundQuestState } from './boundState';

type Collider = ReturnType<SimHost['physics']['world']['getCollider']>;
/** Gates borrow the installed flags and exact collision owners. Native gates run
 * at their caller's original phase; page pieces retain registry fixed-step sync.
 * No clock, flag listener, body duplication or save envelope is introduced. */
export class QuestFlagGates {
  private readonly rows;
  private readonly flags: Flags;
  private readonly native: SimHost | null;
  private colliders: Collider[] = [];
  constructor(owner: SimHost | ShardContext, input: unknown, restoring = false) {
    this.rows = v.parse(QuestFlagGatesSchema, input);
    if (owner.scope.disposed) throw new Error('Quest gates require a live owner');
    this.native = 'physics' in owner ? owner : null;
    if ('physics' in owner) {
      if (this.rows.gates.some(row => row.target.kind !== 'box')) throw new Error('Native quest gates require baked boxes');
      this.flags = owner.flags;
      if (!restoring) this.physicsRestored();
    } else {
      const world = owner.game.runtime?.world, quest = this.rows.quest;
      if (world === undefined || world === null || quest === undefined) throw new Error('Quest gates require their entered world and quest');
      this.flags = boundQuestState(owner.scope, quest).flags;
      const pieces = this.rows.gates.map(row => {
        if (row.target.kind !== 'piece' || world.registry.get(row.id) !== undefined) throw new Error('Page quest gates require unique registered piece targets');
        const source = world.registry.get(row.target.piece);
        if (source?.colliders === undefined || source.follows === undefined) throw new Error('Quest gate requires its original moving piece');
        return { row, source, colliders: source.colliders, follows: source.follows };
      });
      withOwner(owner.scope, () => {
        for (const { row, source, colliders, follows } of pieces) world.registry.add({
          id: row.id, name: row.name ?? row.id, category: source.category, file: 'src/game/quest/flagGates.ts',
          ...(source.surface === undefined ? {} : { surface: source.surface }), colliders, follows,
          ...(source.followRotation === undefined ? {} : { followRotation: source.followRotation }),
          active: () => !test(this.flags, row.opensWhen),
        });
      });
    }
  }
  /** Rebind restored native handles without spawning or replaying flag edges. */
  physicsRestored(): void {
    const host = this.native;
    if (host === null) throw new Error('Page quest gates retain their registry owner');
    this.colliders = this.rows.gates.map(row => {
      if (row.target.kind !== 'box') throw new Error('Native quest gates require baked boxes');
      const collider = staticBoxCollider(host.physics, row.target.box);
      if (collider === null) throw new Error('Native quest gate has no baked collider');
      return collider;
    });
  }
  /** Native latches release after transitions in the same tick, as before. */
  sync(): void {
    if (this.native === null) return;
    this.rows.gates.forEach((row, i) => {
      const collider = this.colliders[i];
      if (test(this.flags, row.opensWhen) && collider?.isEnabled() === true) collider.setEnabled(false);
    });
  }
}
