import * as v from 'valibot';
import { Vector3, MathUtils } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

const finite = v.pipe(v.number(), v.finite()), point = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({ version: v.literal(1), lastPlayer: point, playerVelocity: point, shooter: v.nullable(v.string()) });
export interface GhostVolleyPorts<A extends AnimalSim> {
  readonly player: { readonly position: Vector3 };
  /** The real published horse-body socket, before the shipping shoulder offset. Never infer it from feet. */
  readonly seat: (a: A, out: Vector3) => void;
  readonly random: () => number;
  /** Borrows the two reused vectors; a projectile owner copies them synchronously. */
  readonly launch: (origin: Vector3, velocity: Vector3) => void;
  readonly resolve: (id: string) => A | null;
}

/** GhostRiders' shipping ballistic solve and lead history, independent of its material and particle presentation.
 * The roster owns fire timers; the real projectile pool owns flight/contact. Each shot consumes exactly two AI draws.
 * Impact attribution intentionally retains the page's last-shooter law, including a shooter retired during flight. */
export class GhostVolleyKeeper<A extends AnimalSim> {
  private readonly lastPlayer = new Vector3();
  private readonly playerVelocity = new Vector3();
  private readonly origin = new Vector3();
  private readonly target = new Vector3();
  private readonly velocity = new Vector3();
  private shooter: A | null = null;
  constructor(private readonly ports: GhostVolleyPorts<A>) {}

  /** Once per night-roster frame, even when it has no living rider (matching the page). */
  update(dt: number): void {
    const p = this.ports.player.position;
    if (dt > 0) {
      this.playerVelocity.subVectors(p, this.lastPlayer).multiplyScalar(1 / dt);
      if (this.playerVelocity.length() > 20) this.playerVelocity.set(0, 0, 0);
    }
    this.lastPlayer.copy(p);
  }

  shoot(a: A): void {
    const p = this.ports.player.position, origin = this.origin, target = this.target;
    this.ports.seat(a, origin); origin.y += 0.7 * a.scale;
    const dist = Math.hypot(p.x - origin.x, p.z - origin.z), tFlight = dist / 34;
    target.set(p.x + this.playerVelocity.x * tFlight * 0.8, p.y + 1.2, p.z + this.playerVelocity.z * tFlight * 0.8);
    const dx = target.x - origin.x, dz = target.z - origin.z, dy = target.y - origin.y, h = Math.hypot(dx, dz);
    const v2 = 34 * 34, g = 5;
    const disc = v2 * v2 - g * (g * h * h + 2 * dy * v2);
    const th = disc >= 0 ? Math.atan((v2 - Math.sqrt(disc)) / (g * Math.max(h, 1e-3))) : Math.PI / 4;
    const spread = MathUtils.degToRad(1.4);
    const yaw = Math.atan2(dx, dz) + (this.ports.random() - 0.5) * spread * 2, pitch = th + (this.ports.random() - 0.5) * spread;
    this.velocity.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(34);
    this.shooter = a;
    this.ports.launch(origin, this.velocity);
  }

  /** The roster's ordinary fallback is applied by its hit owner only when this is null. */
  get lastShooter(): A | null { return this.shooter; }
  snapshot(): v.InferOutput<typeof Saved> {
    return { version: 1, lastPlayer: [this.lastPlayer.x, this.lastPlayer.y, this.lastPlayer.z],
      playerVelocity: [this.playerVelocity.x, this.playerVelocity.y, this.playerVelocity.z], shooter: this.shooter?.entityId ?? null };
  }
  restore(input: unknown): void {
    const s = v.parse(Saved, input), shooter = s.shooter === null ? null : this.ports.resolve(s.shooter);
    if (s.shooter !== null && (shooter === null || shooter.entityId !== s.shooter)) throw new Error('Missing ghost volley shooter identity');
    this.lastPlayer.fromArray(s.lastPlayer); this.playerVelocity.fromArray(s.playerVelocity); this.shooter = shooter;
  }
}
