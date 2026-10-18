/** Practice owns only its selected actor; implementations retain all resource cleanup. */
export interface PracticeEncounterPorts<Selection, Actor extends object> {
  /** Return a fresh, exclusively owned actor. Abort is advisory; late results are still disposed. */
  readonly load: (selection: Selection, signal: AbortSignal) => Promise<Actor>;
  /** Retire the actor's registrations, listeners and resources without awarding world progress. */
  readonly dispose: (actor: Actor) => void;
}

export type PracticeEncounterPhase = 'idle' | 'loading' | 'active' | 'defeated' | 'error' | 'disposed';

/** A local practice result, never a currency grant or a durable world completion. */
export interface PracticeEncounterReward<Selection> {
  readonly scope: 'practice';
  readonly attempt: number;
  readonly selection: Selection;
}

export interface PracticeEncounterSnapshot<Selection, Actor extends object> {
  readonly scope: 'practice';
  readonly phase: PracticeEncounterPhase;
  readonly attempt: number;
  readonly selection: Selection | null;
  readonly actor: Actor | null;
  readonly reward: PracticeEncounterReward<Selection> | null;
  readonly rewardCount: number;
  readonly error: unknown;
}

/**
 * One selected practice encounter with race-safe replacement and teardown.
 * Contains no renderer, enemy AI, shard imports, persistence or world-reward ports.
 * A defeated actor stays owned until retry, replacement or exit so its death can finish.
 */
export class EncounterSession<Selection, Actor extends object> {
  private current: PracticeEncounterSnapshot<Selection, Actor> = Object.freeze({
    scope: 'practice', phase: 'idle', attempt: 0, selection: null,
    actor: null, reward: null, rewardCount: 0, error: null,
  });
  private pending: AbortController | null = null;
  private selected: { readonly value: Selection } | null = null;

  constructor(private readonly ports: PracticeEncounterPorts<Selection, Actor>) {}

  /** Immutable snapshot, stable until the next transition. Actor resources remain adapter-owned. */
  get snapshot(): PracticeEncounterSnapshot<Selection, Actor> { return this.current; }

  /** Replaces the previous attempt, including when a prior load has not settled. */
  async select(selection: Selection): Promise<boolean> {
    if (this.current.phase === 'disposed') return false;
    const previous = this.current, pending = this.pending, controller = new AbortController();
    const attempt = previous.attempt + 1;
    this.selected = { value: selection };
    this.pending = controller;
    this.current = Object.freeze({
      scope: 'practice', phase: 'loading', attempt, selection,
      actor: null, reward: null, rewardCount: previous.rewardCount, error: null,
    });
    pending?.abort();
    try {
      if (previous.actor !== null) this.ports.dispose(previous.actor);
      // An abort/dispose callback may already have selected a newer attempt or exited.
      if (this.current.attempt !== attempt) return false;
      const actor = await this.ports.load(selection, controller.signal);
      if (this.current.attempt !== attempt) {
        this.ports.dispose(actor);
        return false;
      }
      this.pending = null;
      this.current = Object.freeze({ ...this.current, phase: 'active', actor });
      return true;
    } catch (error) {
      // A failed old request cannot overwrite the current actor or its error state.
      if (this.current.attempt !== attempt) return false;
      this.pending = null;
      this.current = Object.freeze({ ...this.current, phase: 'error', error });
      return false;
    }
  }

  /** A retry creates a fresh attempt and actor, including after a failed or pending load. */
  retry(): Promise<boolean> {
    return this.selected === null ? Promise.resolve(false) : this.select(this.selected.value);
  }

  /** A retained loaded actor opens a fresh bout on entry/retry; prior receipts never carry into it. */
  begin(actor: Actor): boolean {
    if ((this.current.phase !== 'active' && this.current.phase !== 'defeated') || this.current.actor !== actor) return false;
    this.current = Object.freeze({ ...this.current, phase: 'active', attempt: this.current.attempt + 1, reward: null });
    return true;
  }

  /** Claims one in-memory practice result for the currently active actor. */
  defeat(actor: Actor): PracticeEncounterReward<Selection> | null {
    if (this.current.phase !== 'active' || this.current.actor !== actor || this.selected === null) return null;
    const reward: PracticeEncounterReward<Selection> = Object.freeze({
      scope: 'practice', attempt: this.current.attempt, selection: this.selected.value,
    });
    this.current = Object.freeze({
      ...this.current, phase: 'defeated', reward, rewardCount: this.current.rewardCount + 1,
    });
    return reward;
  }

  /** Clears all practice state. A later selection may open a new encounter. */
  exit(): void {
    if (this.current.phase !== 'disposed') this.close('idle');
  }

  /** Terminal teardown: late loads are retired and subsequent selection stays disabled. */
  dispose(): void {
    if (this.current.phase !== 'disposed') this.close('disposed');
  }

  private close(phase: 'idle' | 'disposed'): void {
    const previous = this.current, pending = this.pending;
    this.pending = null;
    this.selected = null;
    this.current = Object.freeze({
      scope: 'practice', phase, attempt: previous.attempt + 1, selection: null,
      actor: null, reward: null, rewardCount: 0, error: null,
    });
    pending?.abort();
    if (previous.actor !== null) this.ports.dispose(previous.actor);
  }
}
