import { AggressionDirector } from './director';

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
}
