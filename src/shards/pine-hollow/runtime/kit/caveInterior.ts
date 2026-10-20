import * as THREE from 'three';
import type { CaveRows, NativeView } from '../productSections.generated.d.ts';
import { loadPBR, loadTexture, texUrl } from '@wildshard/engine/core/assets';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { TerrainCut } from '@wildshard/engine/physics/terrain';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { insidePolygon, yawLocal, yawWorld, type YawFrame } from '@wildshard/engine/world/yawFrame';
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import { codePart } from '../world/codeParts';
import { pineView } from '../world/context';
import { pineSetCap } from '../debug/options';

/**
 * A cave cut into the terrain (SHARD-PLATFORM M3, the kit system): one interior baked by a shard's builder, described in
 * its own frame (lx across, lz in, y world height) by a meta file, and a look row for its shaft of light and its drips.
 * From those it answers the world's questions: the physics heightfield's cuts, the drawn terrain's hole, the terrain
 * patch over the cut as a trimesh (the ground above the mouth comes back), the reverb spots, the footprint (no rain
 * inside), the passage's floor; and it draws the shaft (the shard's lent graph look, additive) and the drips near the mouth,
 * fills the walls by day through the shard's fill uniform and hides the sun's depth-less disc under the roof. The
 * static geometry and contacts arrive from Pine's admitted product. This view retains the nearby light/drip animation
 * and the granite texture bindings.
 */

/** The baked interior's meta file: everything in the cave's frame (lx across, lz in, y world height). */
export type CaveMeta = Omit<CaveRows['meta'], 'tris'>;
/** The admitted cave look, also accepting the author's readonly fill tuple. */
export type CaveLookRow = {
  readonly [Key in keyof NativeView['CAVE_LOOK']]: Readonly<NativeView['CAVE_LOOK'][Key]>;
};

// Retain the native crag module's shared live fill across its resident views.
const CAVE_FILL = { value: 1 };

/** A cave cut into the terrain (see the module comment). */
export class CaveInterior {
  readonly meta: CaveMeta;
  /** the shaft and the drips (added by `buildFx`) */
  readonly fx: THREE.Object3D[] = [];
  private readonly frame: YawFrame;
  private readonly look: CaveLookRow;
  private readonly fill: { value: number };
  private shaft: THREE.Mesh | null = null;
  private drips: THREE.Points | null = null;
  private dripState: Float32Array = new Float32Array(0);
  private near = false;
  private under = false;
  private readonly cameraPosition = new THREE.Vector3();
  readonly shell: ColliderDesc[] = [];

  /** Client-only cave presentation; all static geometry and contacts arrive through the admitted product. */
  static async load(): Promise<CaveInterior> {
    const [product, rock, map, normalMap] = await Promise.all([loadFirstPartyProduct('pine-hollow'),
      loadPBR('mossy_rock', 1, pineSetCap(TIER_CONFIG.maxTexture)),
      loadTexture(texUrl('rock_ground', 'diffuse'), true), loadTexture(texUrl('rock_ground', 'nor_gl'))]);
    const data = await product.json<CaveRows>('world/crag-cave.json');
    const view = pineView(), frame = view.BEAR_CAVE;
    const cave = new CaveInterior(data.meta, { x: frame.x, z: frame.z, yaw: frame.rot }, view.CAVE_LOOK, CAVE_FILL);
    cave.shell.push(...readColliderRows([data.shell], { kinds: ['trimesh'], surfaces: ['rock'], requireSurface: true }));
    const lend = (name: string, texture: THREE.Texture): void => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1, 1); texture.needsUpdate = true;
      setLentTexture(view.CRAG_LOOK, name, texture);
    };
    lend('rockMap', rock.map); lend('rockNormal', rock.normalMap); lend('rockArm', rock.armMap);
    lend('gritMap', map); lend('gritNormal', normalMap);
    return cave;
  }

  /** Only the cave's live light and drips remain here; Z2 updates the static batch's culling. */
  presentFrame(t: number, sky: SkyRig): void {
    sky.viewCamera.getWorldPosition(this.cameraPosition);
    this.update(t, this.cameraPosition, sky);
    setLentParam(pineView().CRAG_LOOK, 'caveFill', this.fill.value);
  }

  /** `frame`: its mouth at (x, z), local +Z turned by `yaw` into the rock; `fill`: the walls' material's fill uniform this cave drives by day */
  constructor(meta: CaveMeta, frame: YawFrame, look: CaveLookRow, fill: { value: number }) {
    this.meta = meta;
    this.frame = frame;
    this.look = look;
    this.fill = fill;
  }

  /** world (x, z) → cave-local (lx, lz) */
  local(x: number, z: number): [number, number] { return yawLocal(this.frame, x, z); }

  /** cave-local (lx, lz) → world (x, z) */
  world(lx: number, lz: number): [number, number] { return yawWorld(this.frame, lx, lz); }

  /** the physics heightfield's cuts (world rects): the ground under the passage where the slope runs through it */
  terrainCuts(): TerrainCut[] {
    return this.meta.cuts.map((c) => { const [x, z] = this.world(c.lx, c.lz); return { x, z, hw: c.hw, hd: c.hd, yaw: this.frame.yaw, below: c.below }; });
  }

  /** Immutable native cut facts; the game owns triangle filtering and yields. */
  cutRows(): { frame: YawFrame; cuts: CaveMeta['cuts']; holes: CaveMeta['holes'] } { return { frame: this.frame, cuts: this.meta.cuts, holes: this.meta.holes }; }

  /** the drawn terrain's hole: true for a triangle (world vertices) that reaches into the cave's passage */
  holeTest(): (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => boolean {
    const holes = this.meta.holes;
    return (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      const [alx, alz] = this.local(ax, az), [blx, blz] = this.local(bx, bz), [clx, clz] = this.local(cx, cz);
      const x0 = Math.min(alx, blx, clx), x1 = Math.max(alx, blx, clx), z0 = Math.min(alz, blz, clz), z1 = Math.max(alz, blz, clz);
      const y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy);
      for (const h of holes) {
        if (x1 < h.lx - h.hw || x0 > h.lx + h.hw || z1 < h.lz - h.hd || z0 > h.lz + h.hd || y1 < h.y0 || y0 > h.y1) continue;
        return true;
      }
      return false;
    };
  }

  /** the reverb / bed spots, world */
  spots(): { x: number; z: number; r: number }[] {
    return this.meta.spots.map((s) => { const [x, z] = this.world(s.lx, s.lz); return { x, z, r: s.r }; });
  }

  /** inside the footprint (no rain falls there) */
  inside(x: number, z: number): boolean { const [lx, lz] = this.local(x, z); return insidePolygon(this.meta.inside, lx, lz); }

  /** the passage's floor height at depth `lz` */
  floorAt(lz: number): number | undefined {
    const f = this.meta.floor;
    if (f.length === 0) return undefined;
    for (let i = 0; i + 1 < f.length; i++) {
      const a = f[i], b = f[i + 1];
      if (a && b && lz >= a[0] && lz <= b[0]) return a[1] + (b[1] - a[1]) * ((lz - a[0]) / Math.max(1e-6, b[0] - a[0]));
    }
    return undefined;
  }

  /**
   * The terrain over the cut (its drawn triangles that are not in the hole) as a trimesh: the heightfield under the cut
   * was pushed below the cave's floor, so the ground up there (on the slope above the mouth) comes back as this. Baked
   * offline from the terrain's lattice (../../generators/codeParts.ts `caveRoof`), its vertices relative to the mouth.
   */
  roofPatch(): ColliderDesc[] {
    const g = codePart('cave-roof'), idx = g.getIndex();
    if (idx === null || idx.count === 0) return [];
    return [{ kind: 'trimesh', x: this.frame.x, y: 0, z: this.frame.z, vertices: Float32Array.from(g.getAttribute('position').array), indices: Uint32Array.from(idx.array), surface: this.look.surface }];
  }

  /** Build the shaft and the drips (hidden until the eye is near); they are added to `fx` in that order. */
  buildFx(): void {
    const meta = this.meta, look = this.look;
    const toW = (p: [number, number, number]): THREE.Vector3 => { const [x, z] = this.world(p[0], p[2]); return new THREE.Vector3(x, p[1], z); };
    // the shaft: an open cone from the crack to the floor, additive, brightest at the crack, fading to the floor and toward its rim
    const top = toW(meta.shaft.top), foot = toW(meta.shaft.foot);
    const len = top.distanceTo(foot);
    const geo = new THREE.CylinderGeometry(meta.shaft.r0, meta.shaft.r1, len, look.shaft.radialSegments, look.shaft.heightSegments, true);
    geo.translate(0, -len / 2, 0);
    const shaft = new THREE.Mesh(geo, lentLook(look.shaft.look));
    shaft.position.copy(top);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), foot.clone().sub(top).normalize());
    shaft.renderOrder = look.shaft.renderOrder; shaft.frustumCulled = true; shaft.visible = false;
    shaft.name = 'cave-shaft';
    this.shaft = shaft;
    this.fx.push(shaft);
    // the drips: one Points, each drip falling from the roof on its own clock
    const n = meta.drips.length;
    if (n > 0) {
      const pos = new Float32Array(n * 3);
      this.dripState = new Float32Array(n * 4);
      meta.drips.forEach((d, i) => {
        const [x, z] = this.world(d[0], d[2]);
        this.dripState.set([x, d[1], z, d[3]], i * 4);
        pos.set([x, d[1], z], i * 3);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dl = look.drips;
      const pm = new THREE.PointsMaterial({ color: dl.color, size: dl.size, sizeAttenuation: true, transparent: true, opacity: dl.opacity, depthWrite: false, fog: false });
      const pts = new THREE.Points(g, pm);
      pts.name = 'cave-drips'; pts.visible = false; pts.frustumCulled = false;
      this.drips = pts;
      this.fx.push(pts);
    }
  }

  /** Per frame, the eye at `p`: the sun's disc under the roof, and near the mouth the fill, the shaft and the drips on clock `t`. */
  update(t: number, p: THREE.Vector3, sky: SkyRig): void {
    const look = this.look;
    // the sun's corona sprite draws without a depth test: under the roof the disc goes, corona and all
    const [, lz] = this.local(p.x, p.z);
    const under = this.inside(p.x, p.z) && p.y < (this.floorAt(Math.min(look.under.lzMax, Math.max(look.under.lzMin, lz))) ?? p.y) + look.under.height;
    if (under !== this.under) {
      this.under = under;
      sky.sunDisc.visible = !under; // the corona has no depth test (and the disc is the god rays' source)
    }
    const near = Math.hypot(p.x - this.frame.x, p.z - this.frame.z) < look.near;
    if (near !== this.near) { this.near = near; if (this.shaft) this.shaft.visible = near; if (this.drips) this.drips.visible = near; }
    if (!near) return;
    if (this.shaft) {
      const s = look.shaft;
      // the sky over the crack: bright by day (the lamps are out), a glimmer at night
      const day = 1 - Math.max(0, Math.min(1, sky.lamps));
      this.fill.value = look.fill[0] + look.fill[1] * day;
      setLentParam(s.look, 'intensity', s.gain * day * Math.min(1, s.sunBase + Math.max(0, sky.sunDir.y) * s.sunGain) + s.floor);
    }
    if (this.drips) {
      const pos = this.drips.geometry.getAttribute('position');
      const st = this.dripState, n = st.length / 4, dl = look.drips;
      for (let i = 0; i < n; i++) {
        const top = st[i * 4 + 1] ?? 0, floor = st[i * 4 + 3] ?? 0, h = Math.max(dl.minDrop, top - floor);
        // each drip: forms for a while (hangs at the roof), then falls under gravity to the floor
        const period = dl.period + (i % dl.kinds) * dl.periodStep, ph = (t / period + i * dl.phaseStep) % 1;
        const fall = Math.sqrt((2 * h) / dl.gravity) / period;
        const k = ph < 1 - fall ? 0 : (ph - (1 - fall)) / fall;
        pos.setY(i, top - dl.hang - 0.5 * dl.gravity * (k * fall * period) ** 2 * (k > 0 ? 1 : 0));
      }
      pos.needsUpdate = true;
    }
  }
}
