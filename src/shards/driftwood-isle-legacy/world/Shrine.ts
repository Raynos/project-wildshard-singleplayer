/**
 * Shrine — where the Ring Shrine stands, and what moves round it (E306 / E315 M1: the shrine itself is the model
 * src/shards/driftwood-isle/models/shrine.ts; this is the world side). It places the shrine on its knoll in the
 * north-west jungle, turned by SHRINE.rot so its back points at the planet, and runs its effects: the glyphs' pulse,
 * the pool's ripples and the firefly cloud drifting round the platform.
 *
 *   const shrine = new Shrine(sky, { x, z, rot }).place(registry);   // the game (main.ts): piece `shrine`
 *   const shrine = new Shrine(sky, { x, z, rot }).build();           // a dev page: not registered
 *   scene.add(shrine.group); its registry piece.push(...shrine.colliders);
 *   player.platforms.push((x, z) => shrine.floorHeightAt(x, z));    // the stair, the three terraces, the causeway
 *   game.onUpdate((dt) => shrine.update(dt));
 *   shrine.setDusk(k)       // 0 = broad day … 1 = dusk / night: glyph brightness + the firefly cloud (the day clock drives it)
 *
 * `anchors` (world coords, yaw = world facing, 0 = +Z): altar, pool, stairFoot, ring (see the model).
 */
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { SHRINE_RUNE, shrine, shrineLayout, shrineMaterials, shrineOrigin, type ShrineAnchor, type ShrineParams } from '../models/shrine';

export interface ShrineSpec { x: number; z: number; rot: number }

const FIREFLIES = 90;

export class Shrine {
  /** what it draws: the stone + jungle, the pool, the glyphs — and the firefly cloud */
  group!: THREE.Object3D;
  /** the legacy boxes (pedestals, monolith, glyph pillars, standing stones, the stair's cheek walls, the tiers) */
  colliders: Collider[] = [];
  anchors: Record<string, ShrineAnchor> = {};
  private readonly params: ShrineParams;
  /** the site's origin: own space + this = world */
  private readonly o: { x: number; y: number; z: number };
  private lay: ReturnType<typeof shrineLayout> | null = null;
  private descs: ColliderDesc[] = [];
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;
  private baseY = 0;
  private glyphMat!: THREE.MeshBasicMaterial;
  private uniforms!: { uTime: THREE.IUniform<number> };
  private fireflies!: THREE.Points;
  private ffMat!: THREE.PointsMaterial;
  private ffPos = new Float32Array(FIREFLIES * 3);
  private ffSeed = new Float32Array(FIREFLIES * 4);
  private ffAttr!: THREE.BufferAttribute;
  private dusk = 0.35;
  private t = 0;

  constructor(private sky: Sky, private spec: ShrineSpec) {
    // the model is built for its site (where it stands, which way it faces, the terrain there) and handed over in own space
    this.params = { site: { x: spec.x, z: spec.z, rot: spec.rot }, ground: heightAt };
    this.o = shrineOrigin(this.params);
  }

  /** 0 = broad daylight (the fireflies barely show), 1 = dusk / night (the full cloud, the glyphs at their brightest) */
  setDusk(k: number): void { this.dusk = Math.max(0, Math.min(1, k)); }

  /** the game's: placed and registered (piece `shrine`, the catalog's Ring shrine) */
  place(registry: WorldRegistry): this { return this.draw(registry); }

  /** a dev page's: the same shrine, not registered */
  build(): this { return this.draw(null); }

  private draw(registry: WorldRegistry | null): this {
    const { x, y: y0, z } = this.o;
    const ctx = modelContext(this.sky);
    const placed = place(shrine, [{ x, y: y0, z, params: this.params }], { ctx, draw: 'merged', registry,
      piece: { id: 'shrine', floor: (px, pz) => this.floorHeightAt(px, pz), solidFloor: true } });
    this.group = placed.object;
    this.placed = placed;
    this.descs = [...placed.colliders];
    const lay = this.lay = shrineLayout(this.params);
    this.baseY = y0 + lay.baseY;
    for (const c of lay.colliders) this.colliders.push({ ...c, x: c.x + x, z: c.z + z, yTop: c.yTop + y0, yBottom: c.yBottom + y0 });
    for (const [k, a] of Object.entries(lay.anchors)) this.anchors[k] = { x: a.x + x, y: a.y + y0, z: a.z + z, yaw: a.yaw };
    const m = shrineMaterials(ctx);
    this.glyphMat = m.glyphs;
    this.uniforms = m.uniforms;
    this.buildFireflies(new Rng(SEED ^ 0x5418), y0 + lay.terrace);
    return this;
  }

  /** the firefly cloud (an effect, not the model): FIREFLIES points wandering on seeded sine paths round the platform, 0.4–3 m up */
  private buildFireflies(rng: Rng, top: number): void {
    for (let i = 0; i < FIREFLIES; i++) {
      this.ffSeed[i * 4] = rng.range(0, Math.PI * 2);
      this.ffSeed[i * 4 + 1] = rng.range(4, 13);
      this.ffSeed[i * 4 + 2] = rng.range(0.4, 3.4);
      this.ffSeed[i * 4 + 3] = rng.range(0, 100);
    }
    const g = new THREE.BufferGeometry();
    this.ffAttr = new THREE.BufferAttribute(this.ffPos, 3); this.ffAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.ffAttr);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(this.spec.x, top, this.spec.z), 18);
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('[shrine] no 2d canvas context');
    const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
    this.ffMat = new THREE.PointsMaterial({ color: new THREE.Color(0.75, 1.0, 0.55), size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending });
    this.fireflies = new THREE.Points(g, this.ffMat);
    this.fireflies.renderOrder = 4;
    this.group.add(this.fireflies);
    this.update(0);
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    this.uniforms.uTime.value = t;
    const pulse = 0.55 + 0.45 * Math.sin(t * 1.1) * Math.sin(t * 0.37 + 1);
    this.glyphMat.color.copy(SHRINE_RUNE).multiplyScalar(1.6 + 2.6 * pulse * (0.6 + 0.4 * this.dusk));
    const S = this.ffSeed, P = this.ffPos, base = this.baseY;
    for (let i = 0; i < FIREFLIES; i++) {
      const ph = S[i * 4 + 3] ?? 0;
      const a = (S[i * 4] ?? 0) + t * 0.12 * (1 + 0.5 * Math.sin(ph)), r = (S[i * 4 + 1] ?? 0) + 0.6 * Math.sin(t * 0.7 + ph);
      const wob = Math.sin(t * 1.9 + ph * 3) * 0.35;
      P[i * 3] = this.spec.x + Math.cos(a) * r + wob;
      P[i * 3 + 1] = base + (S[i * 4 + 2] ?? 0) + 0.25 * Math.sin(t * 1.3 + ph);
      P[i * 3 + 2] = this.spec.z + Math.sin(a) * r - wob * 0.6;
    }
    this.ffAttr.needsUpdate = true;
    const flick = 0.7 + 0.3 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    this.ffMat.opacity = (0.3 + 0.7 * this.dusk) * flick;
    this.ffMat.size = 0.09 + 0.06 * this.dusk;
  }

  /**
   * PHYSICS P4: the shrine's static collision in world space (the model's own-space colliders, placed): the legacy boxes
   * but the tiers, the three terraces, the stair's treads, the causeway and its front treads. src/engine/physics/pieces.ts turns
   * it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] { return this.descs.slice(); }

  /** the walkable stone under (x, z): the stair (a ramp), the three terraces, the causeway across the pool */
  floorHeightAt(x: number, z: number): number | undefined {
    const y = (this.lay ??= shrineLayout(this.params)).floorHeightAt(x - this.o.x, z - this.o.z);
    return y === undefined ? undefined : y + this.o.y;
  }
}
