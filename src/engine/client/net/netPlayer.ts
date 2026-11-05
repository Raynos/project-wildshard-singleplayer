// P1-E5.3-C6 (E5-REPLICATION §5.2): a Player on the wire. Each fixed step's controls become a command the server gets and the
// predictor steps at once; each frame takes the newest owner block and reconciles; `flush` runs once a frame, so at Low Power
// Mode's 2.47 steps a frame a bundle carries them all (J121). Nothing here knows how bytes travel or what the server runs.
import { Vector3 } from 'three';
import type { NetCommand } from '@wildshard/format/netCommand';
import type { OwnHit, WeaponWire } from '../../shared/combat/Weapon';
import { NET_BUTTONS } from '../../shared/input/netButtons';
import { quantiseCommand } from '../../shared/net/command';
import type { DecodedFrame } from '../../shared/net/frame';
import { PLAYER_CLASS } from '../../shared/net/netSchemas';
import type { Physics } from '../../shared/physics/Physics';
import type { Player, PlayerLink, PlayerWireInput } from '../player/Player';
import { AttackPrediction } from './attackPrediction';
import type { NetClient } from './client';
import { predictedPlayer, PredictionWorld } from './predictionWorld';
import { Predictor } from './predictor';

/** Where this player's attacks are drawn: `EquipmentService`, on a page. */
export interface NetWeapons { readonly bindWire: (wire: WeaponWire | null) => void; readonly serverHit: (hit: OwnHit) => void; readonly attackRefused: () => void }

/** The owner block's columns for the last attack the server started and the slot it says this player holds. */
const LAST_SWING = PLAYER_CLASS.owner.findIndex(column => column.name === 'lastSwingSeq'), HELD = PLAYER_CLASS.owner.findIndex(column => column.name === 'held');

/** One client's own character. */
export class NetPlayer implements PlayerLink {
  readonly predictor: Predictor;
  readonly world: PredictionWorld;
  /** Its swings and shots, until the server rules on them (J47). */
  readonly attacks: AttackPrediction = new AttackPrediction();
  /** Its weapons' line to the server: what the next command carries. */
  readonly wire: WeaponWire = {
    press: started => { this.pressed = true; this.pressStarted ||= started; },
    hold: heavy => { this.heavy = heavy; },
    fire: ads => { this.launcher = { slot: this.held, ads, fire: true }; },
    afterStep: run => { this.afterStep = run; },
    steps: () => this.frameSteps,
    nextSeq: () => (this.seq + 1) & 0xffff,
  };
  /** Whether this page stands in the world a frame came from. A crossing's frames wait behind this until the page has made it. */
  inCell: (cell: number) => boolean = () => true;
  /** Biggest camera offset a correction has left, in metres: what a proof page reports. */
  worstOffset = 0;
  private readonly client: NetClient;
  private readonly player: Player;
  private seen: DecodedFrame | null = null;
  private pressed = false;
  private pressStarted = false;
  private heavy = false;
  private held = 0;
  private afterStep: (() => void) | null = null;
  private frameSteps = 0;
  private launcher: NonNullable<NetCommand['launcher']> | null = null;
  private seq = 0;
  private weapons: NetWeapons | null = null;
  private readonly off: readonly (() => void)[];
  constructor(client: NetClient, player: Player, physics: Physics) {
    this.client = client; this.player = player;
    this.world = new PredictionWorld(physics);
    this.predictor = new Predictor(predictedPlayer(player, this.world), PLAYER_CLASS.owner);
    this.attacks.onRefused(() => { this.weapons?.attackRefused(); });
    this.off = [client.onCombat(event => {
      // an own blow plays the moment it is heard: the predicted swing already ran (J47)
      if (event.kind !== 'hit' || event.confirmFor === 0) return;
      this.attacks.confirm(event.confirmFor);
      const kind = this.client.entities.get(event.target)?.initial['kind'];
      this.weapons?.serverHit({ kind: typeof kind === 'string' ? kind : '', at: new Vector3(...event.at), head: event.head, killed: event.killed, amount: event.amount, seq: event.confirmFor });
    }),
    // A crossing is a snap (§5.2): nothing is sent until the next world's first frame seats this body there, in its coordinates.
    client.onTravel(() => { this.seen = null; })];
  }
  /** Draw this player's attacks on `weapons`: they stop settling their own contact and take the server's word. */
  bindWeapons(weapons: NetWeapons): void { this.weapons = weapons; weapons.bindWire(this.wire); }
  /** The server has put this body somewhere: a frame has been heard. */
  get joined(): boolean { return this.seen !== null; }

  /** A fixed step. False, with nothing sent, before the first frame or when a full ring says the server stopped answering. */
  step(input: PlayerWireInput): boolean {
    if (this.seen === null || this.predictor.full) return false;
    const armed = this.armed(input), seq = this.seq = this.client.command(armed);
    this.frameSteps++;
    if (this.pressStarted || armed.launcher?.fire === true) this.attacks.started(seq);
    this.pressed = false; this.pressStarted = false; this.launcher = null;
    this.world.poseFor(seq, false);
    const stepped = this.predictor.step(quantiseCommand({ ...armed, seq, viewTick: 0 })), run = this.afterStep;
    this.afterStep = null; run?.();
    return stepped;
  }
  /** The step's controls, with what the weapon in hand has for this command. */
  private armed(input: PlayerWireInput): PlayerWireInput & Partial<Pick<NetCommand, 'attack' | 'launcher'>> {
    const { launcher } = this, buttons = this.heavy ? input.buttons | NET_BUTTONS.heavy : input.buttons;
    return { ...input, buttons, ...(this.pressed ? { attack: { aim: this.player.sampleAimCommand() } } : {}), ...(launcher === null ? {} : { launcher }) };
  }
  /** The start of a render frame, before its fixed steps: the newest owner block, compared once. */
  reconcile(): void {
    this.frameSteps = 0;
    const frame = this.client.latest;
    if (frame === null || frame === this.seen || !this.inCell(frame.cell)) return;
    const first = this.seen === null;
    this.seen = frame;
    this.world.frame(frame.tick, frame.lastSeq);
    if (first) { this.predictor.adopt(frame.lastSeq, frame.owner); return; }
    this.predictor.reconcile(frame.lastSeq, frame.owner);
    const swung = PLAYER_CLASS.owner[LAST_SWING]?.value(frame.owner[LAST_SWING] ?? 0), held = PLAYER_CLASS.owner[HELD]?.value(frame.owner[HELD] ?? 0);
    this.attacks.frame(frame.lastSeq, typeof swung === 'number' ? swung : 0);
    if (typeof held === 'number') this.held = held;
  }
  /** The end of a render frame: send what its steps queued, and glide the camera. */
  present(dt: number): void {
    if (this.seen !== null) this.client.flush();
    this.predictor.update(dt);
    this.worstOffset = Math.max(this.worstOffset, this.player.renderOffset.length());
  }
  dispose(): void { for (const off of this.off) off(); this.weapons?.bindWire(null); this.world.dispose(); }
}
