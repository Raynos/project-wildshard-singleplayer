import type { BufferGeometry, Material, Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { MountedSpecimenSeatRows } from '@wildshard/format/mountedSpecimenRows';
import { inlineFixedDraw } from '../models/fixedDraws';
import { playClips, type ClipCtx } from '../plugin/animation';
import { createClientScene } from '../plugin/ui';

/** The profile admits at most 16 gestures; a riding session presents at most 8 cue kinds a frame. */
const GESTURES = 16, SIGNALS = 8;
/** A mount the figure sits on: its skeleton (the declared joint) and its speed. */
interface Mount { readonly mesh: { readonly skeleton: { getBoneByName: (name: string) => Object3D | undefined } }; readonly speed: number }

/** The figure's private scene drawn from the rows' inline shapes, its port material made from the row's lent look (or none:
 *  the scene's own standard materials); `own` takes each decoded geometry and the made material. The live seat and the
 *  cold mounted specimen build the same view. Client-only presentation (G603 L10: the riding host's rider on a mount). */
export function seatedFigureView(row: MountedSpecimenSeatRows, own: (resource: BufferGeometry | Material) => void = () => undefined): ReturnType<typeof createClientScene> {
  const geometry = new Map(row.shapes.map(shape => [shape.key, inlineFixedDraw({ slot: shape.key, channels: [], inline: shape.data, baked: shape.geometry })] as const));
  for (const part of geometry.values()) own(part);
  const materials = new Map<string, Material>();
  if (row.material !== undefined) {
    const material = painterlyMaterial(null, { rim: row.material.rim, bands: row.material.bands });
    own(material); materials.set(row.material.id, material);
  }
  return createClientScene(row.figure, { geometry, materials });
}

/** A figure seated on a mount's declared joint (G530 O1), leaning on its eased clips with the mount's speed and playing
 *  each gesture when the riding session presents its cue kind. It reads the session once a frame and decides nothing. */
export class SeatedFigure {
  readonly root: Object3D;
  private readonly frame: ClipCtx;
  private seat: Mount | null = null;
  constructor(private readonly row: MountedSpecimenSeatRows, scope: Scope) {
    const view = seatedFigureView(row, resource => { scope.own(resource); });
    scope.onDispose(() => { view.dispose(); });
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
  /** Once a frame: this frame's cue kinds, then the seated mount's speed. */
  update(dt: number, signals: readonly string[], speed = this.seat?.speed ?? 0): void {
    const frame = this.frame, mem = frame.mem;
    for (let s = 0; s < SIGNALS; s++) {
      const kind = signals[s]; if (kind === undefined) break;
      for (let i = 0; i < GESTURES; i++) { const row = this.row.gestures[i]; if (row === undefined) break; if (row.cue === kind) mem[row.clock] = 0; }
    }
    frame.dt = dt; frame.t += dt; frame.speed = speed; mem[this.row.speed] = speed;
    for (let i = 0; i < GESTURES; i++) { const row = this.row.gestures[i]; if (row === undefined) break; if ((mem[row.clock] ?? -1) >= 0) mem[row.clock] = (mem[row.clock] ?? 0) + dt; }
    playClips(this.row.clips, frame);
    for (let i = 0; i < GESTURES; i++) { const row = this.row.gestures[i]; if (row === undefined) break; if ((mem[row.clock] ?? -1) >= row.duration) mem[row.clock] = -1; }
  }
}
