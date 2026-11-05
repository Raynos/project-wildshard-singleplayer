// P1-E5.3-C6 (E5-REPLICATION §5.2): a Player on the wire. Each fixed step's controls become a command the server gets and the
// predictor steps at once; each frame takes the newest owner block and reconciles; `flush` runs once a frame, so at Low Power
// Mode's 2.47 steps a frame a bundle carries them all (J121). Nothing here knows how bytes travel or what the server runs.
import { quantiseCommand } from '../../shared/net/command';
import type { DecodedFrame } from '../../shared/net/frame';
import { PLAYER_CLASS } from '../../shared/net/netSchemas';
import type { Physics } from '../../shared/physics/Physics';
import type { Player, PlayerLink, PlayerWireInput } from '../player/Player';
import type { NetClient } from './client';
import { predictedPlayer, PredictionWorld } from './predictionWorld';
import { Predictor } from './predictor';

/** One client's own character. */
export class NetPlayer implements PlayerLink {
  readonly predictor: Predictor;
  readonly world: PredictionWorld;
  /** Biggest camera offset a correction has left, in metres: what a proof page reports. */
  worstOffset = 0;
  private readonly client: NetClient;
  private readonly player: Player;
  private seen: DecodedFrame | null = null;
  constructor(client: NetClient, player: Player, physics: Physics) {
    this.client = client; this.player = player;
    this.world = new PredictionWorld(physics);
    this.predictor = new Predictor(predictedPlayer(player, this.world), PLAYER_CLASS.owner);
  }
  /** The server has put this body somewhere: a frame has been heard. */
  get joined(): boolean { return this.seen !== null; }

  /** A fixed step. False, with nothing sent, before the first frame or when a full ring says the server stopped answering. */
  step(input: PlayerWireInput): boolean {
    if (this.seen === null || this.predictor.full) return false;
    const seq = this.client.command(input);
    this.world.poseFor(seq, false);
    return this.predictor.step(quantiseCommand({ ...input, seq, viewTick: 0 }));
  }
  /** The start of a render frame, before its fixed steps: the newest owner block, compared once. */
  reconcile(): void {
    const frame = this.client.latest;
    if (frame === null || frame === this.seen) return;
    const first = this.seen === null;
    this.seen = frame;
    this.world.frame(frame.tick, frame.lastSeq);
    if (first) { this.predictor.adopt(frame.lastSeq, frame.owner); return; }
    this.predictor.reconcile(frame.lastSeq, frame.owner);
  }
  /** The end of a render frame: send what its steps queued, and glide the camera. */
  present(dt: number): void {
    if (this.seen !== null) this.client.flush();
    this.predictor.update(dt);
    this.worstOffset = Math.max(this.worstOffset, this.player.renderOffset.length());
  }
  dispose(): void { this.world.dispose(); }
}
