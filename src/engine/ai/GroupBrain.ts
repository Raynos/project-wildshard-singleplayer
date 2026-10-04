import { AggressionDirector } from './director';
import * as v from 'valibot';

const groupState = v.strictObject({
  members: v.array(v.string()), time: v.nullable(v.pipe(v.number(), v.finite())),
  directors: v.array(v.strictObject({ cap: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(128)), held: v.array(v.string()) })),
});

export interface GroupMember { readonly alive: boolean }
/** Shared roster, blackboard and decision clock. Authored goals remain in the owning content. */
export class GroupBrain<A extends GroupMember> {
  readonly tickClass = 'ai';
  readonly members: A[];
  readonly blackboard = new Map<string, unknown>();
  private groupTime = -Infinity;
  private directors: Map<number, AggressionDirector<A>> | undefined;
  constructor(members: A[]) { this.members = members; }
  /** Member callbacks may arrive together; the group makes one decision per simulation instant. */
  protected groupDelta(time: number, dt: number): number {
    if (Math.abs(time - this.groupTime) < 1e-8) return 0;
    this.groupTime = time;
    return dt;
  }
  /** Dynamic mounted/bold caps reuse the same finite director without another random roll. */
  protected groupDirector(cap: number, attacking: (actor: A) => boolean): AggressionDirector<A> {
    this.directors ??= new Map();
    let director = this.directors.get(cap);
    if (director === undefined) { director = new AggressionDirector<A>(cap); this.directors.set(cap, director); }
    director.sweep(attacking);
    for (const member of this.members) if (member.alive && attacking(member)) director.take(member);
    return director;
  }
  /** Snapshot the shared decision clock and token pools using stable member ids; actor state is owned separately. */
  protected snapshotGroup(identity: (actor: A) => string): string {
    return JSON.stringify({ members: this.members.map(identity), time: this.groupTime === -Infinity ? null : this.groupTime,
      directors: [...(this.directors ?? [])].sort(([a], [b]) => a - b).map(([cap, director]) => ({ cap,
        held: this.members.filter(actor => director.holds(actor)).map(identity) })) });
  }
  /** Validate the complete roster and token pools before replacing group continuation; no decisions or RNG run. */
  protected restoreGroup(saved: string, identity: (actor: A) => string): void {
    const data = v.parse(groupState, JSON.parse(saved)), ids = this.members.map(identity), actors = new Map(this.members.map(actor => [identity(actor), actor]));
    if (actors.size !== this.members.length || JSON.stringify(data.members) !== JSON.stringify(ids)
      || new Set(data.directors.map(row => row.cap)).size !== data.directors.length) throw new Error('Incompatible group continuation');
    const directors = new Map<number, AggressionDirector<A>>();
    for (const row of data.directors) {
      if (new Set(row.held).size !== row.held.length || row.held.length > row.cap) throw new Error('Invalid group token continuation');
      const director = new AggressionDirector<A>(row.cap);
      for (const id of row.held) { const actor = actors.get(id); if (actor === undefined) throw new Error('Unresolved group member'); director.take(actor); }
      directors.set(row.cap, director);
    }
    this.groupTime = data.time ?? -Infinity; this.directors = directors;
  }
}
