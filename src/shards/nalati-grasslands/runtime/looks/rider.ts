import type { MountedSpecimenSeatRows } from '@wildshard/format/mountedSpecimenRows';
/**
 * The shepherd's rider (listed view code, G530 / O1): Nalati's only mounted figure, so its drawing lives here, not as a
 * one-user platform host. Two painterly meshes seated on the camp horse's `body` joint, leaning with the horse's speed and
 * cracking his whip on the pasture raid's `crack` cue, from the admitted rows (riding/mounted-figure.json: figure scene, mount
 * joint, eased clips, cue clocks, its meshes' shadows; the shape book's shepherd geometry). The raid, its cues and the horse are the riding
 * host's; this reads them once a frame and decides nothing.
 */
import type { BufferGeometry, Object3D } from 'three';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { shapeBook } from '@wildshard/game/models/shapeBook';
import { playClips, type ClipCtx } from '@wildshard/game/plugin/animation';
import { createClientScene } from '@wildshard/game/plugin/ui';

/** The rider's admitted rows: the profile file and the shape-book geometry it draws. */
export const RIDER = { json: 'riding/mounted-figure.json', geometry: ['shepherd-body', 'shepherd-arm'] } as const;

/** The profile admits at most 16 gestures; the riding host presents at most 8 raid signals a frame. */
const GESTURES = 16, SIGNALS = 8;
/** A mount the rider sits on: its skeleton (the declared joint) and its speed. */
interface Mount { readonly mesh: { readonly skeleton: { getBoneByName: (name: string) => Object3D | undefined } }; readonly speed: number }

export class ShepherdRider {
  readonly root: Object3D;
  private readonly row: MountedSpecimenSeatRows;
  private readonly frame: ClipCtx;
  private seat: Mount | null = null;
  constructor(input: MountedSpecimenSeatRows, geometry: ReadonlyMap<string, BufferGeometry>) {
    const row = this.row = input;
    const material = painterlyMaterial(null, { rim: row.material.rim, bands: row.material.bands });
    const view = createClientScene(row.figure, { geometry, materials: new Map([[row.material.id, material]]) });
    this.root = view.root;
    const mem: Record<string, number> = {};
    for (let i = 0; i < GESTURES; i++) { const gesture = row.gestures[i]; if (gesture === undefined) break; mem[gesture.clock] = -1; }
    this.frame = { t: 0, phase: 0, dt: 0, speed: 0, alive: true, deathT: 0, attack: -1, mem, bones: Object.fromEntries(view.parts) };
  }
  /** Seat on an actual rig; a missing declared joint refuses. */
  attach(mount: Mount): void {
    const bone = mount.mesh.skeleton.getBoneByName(this.row.mount);
    if (bone === undefined) throw new Error('Missing mounted figure joint');
    bone.add(this.root); this.seat = mount;
  }
  cue(kind: string): void {
    for (let i = 0; i < GESTURES; i++) { const row = this.row.gestures[i]; if (row === undefined) break; if (row.cue === kind) this.frame.mem[row.clock] = 0; }
  }
  /** Once a frame: this frame's raid signals, then the seated mount's speed. */
  update(dt: number, signals: readonly string[], speed = this.seat?.speed ?? 0): void {
    for (let i = 0; i < SIGNALS; i++) { const kind = signals[i]; if (kind === undefined) break; this.cue(kind); }
    const frame = this.frame, mem = frame.mem; frame.dt = dt; frame.t += dt; frame.speed = speed; mem[this.row.speed] = speed;
    for (let i = 0; i < GESTURES; i++) { const row = this.row.gestures[i]; if (row === undefined) break; if ((mem[row.clock] ?? -1) >= 0) mem[row.clock] = (mem[row.clock] ?? 0) + dt; }
    playClips(this.row.clips, frame);
    for (let i = 0; i < GESTURES; i++) { const row = this.row.gestures[i]; if (row === undefined) break; if ((mem[row.clock] ?? -1) >= row.duration) mem[row.clock] = -1; }
  }
}

/** The rider from the admitted product (its rows and shape-book geometry), owned by `own`. */
export async function loadShepherdRider(product: { readonly json: <T>(name: string) => Promise<T> }, shapes: object, own: (geometry: BufferGeometry) => void): Promise<ShepherdRider> {
  const geometry = new Map(shapeBook(shapes).geometries(RIDER.geometry));
  for (let i = 0; i < 4; i++) { const key = RIDER.geometry[i]; if (key === undefined) break; const part = geometry.get(key); if (part !== undefined) own(part); }
  return new ShepherdRider(await product.json<MountedSpecimenSeatRows>(RIDER.json), geometry);
}
