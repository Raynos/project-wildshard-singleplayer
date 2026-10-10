import { Vector3 } from 'three';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { AntlerKingCore, type KingCoreEnv, type KingFightState } from '../../src/shards/pine-hollow/combat/kingFight';
import { Lane } from '../../src/shards/pine-hollow/combat/lane';
import { PINE_LANES } from '../../src/shards/pine-hollow/combat/strikes';

/** Construct the production phased King, lending real bodies and silent views to the frozen strike probes. */
export class AntlerKingProbe extends AntlerKingCore<Animal> {
  protected override readonly ctx: KingCoreEnv<Animal>;
  protected override readonly tellRing = { setTime: (): void => undefined, ring: (): void => undefined, hide: (): void => undefined };
  protected override readonly waves = [0, 1].map(() => ({ r: 0, on: false, hit: false, delay: 0 }));
  protected override readonly lane = new Lane<Animal>(PINE_LANES.king);
  protected override readonly thrallLanes = [0, 1, 2].map(() => new Lane<Animal>(PINE_LANES.thrall));
  private readonly weakPoint: (point: Vector3) => boolean;
  constructor(body: Animal, ports: Partial<KingCoreEnv<Animal>> = {}, weakPoint: (point: Vector3) => boolean = () => false) {
    super();
    this.ctx = { player: { position: new Vector3(), onGround: true, shove: (): void => undefined },
      reach: () => true, hurt: (): void => undefined, trauma: (): void => undefined, shot: (): void => undefined, ...ports };
    // Keep the frozen host's optional wall-bypass call shape: ordinary contacts supply only body and damage.
    if (ports.hurt !== undefined) {
      const hurt = ports.hurt;
      this.ctx = { ...this.ctx, hurt: (a, damage, through) => { if (through === undefined) hurt(a, damage); else hurt(a, damage, through); } };
    }
    this.weakPoint = weakPoint;
    this.king = body;
  }
  /** Restore real policy state instead of setting fields on an unconstructed legacy prototype. */
  seed(state: Partial<KingFightState>): void {
    const body = this.king;
    this.restoreFight({ ...this.fightState(() => 'king'), ...state }, id => id === 'king' ? body : null);
  }
  protected override groundAt(): number { return 0; }
  protected override makeKing(): Animal { throw new Error('Strike probe does not spawn bodies'); }
  protected override retireKing(): void { /* The test owns the body. */ }
  protected override parkKing(): void { /* No view. */ }
  protected override unparkKing(): void { /* No view. */ }
  protected override spawnThrall(): Animal { throw new Error('Strike probe does not spawn adds'); }
  protected override retireThrall(): void { /* The test owns the body. */ }
  protected override action(): void { /* No view. */ }
  protected override roar(): void { /* No view. */ }
  protected override onRibs(point: Vector3): boolean { return this.weakPoint(point); }
}
