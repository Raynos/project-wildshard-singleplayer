/**
 * Flutter — every piece of cloth on the Nalati POIs in ONE mesh (one draw call): the ribbons on the camp's pole,
 * pennants on the yurt crowns, the cloth strips tied at the Wind Cairn, the prayer-strip lines. Each strip is a
 * ribbon of quads the 'nalati-cloth' look graph (data/painterlyGraphs.json: the POI's painterly paint) streams downwind
 * and ripples on the GPU from per-vertex strip rows; stronger wind lifts it, calm lets it hang. Both faces are emitted
 * (reversed winding, the graph flips the back face's normal), so the one-sided graph draws it from either side.
 *
 *   const flutter = new Flutter();
 *   flutter.streamer(v3(x, y, z), 2.8, 0.12, '#d63a2a');                  // ribbon from a point
 *   flutter.flag(v3(x, yTop, z), 0.7, 1.1, '#c8432b', { taper: 1 });      // pennant on a pole (edge down from yTop)
 *   flutter.strip(v3(x, y, z), 0.45, 0.07, '#f4f1ea');                    // strip tied to a line: hangs, flutters
 *   scene.add(flutter.build(sky));  game.onUpdate((dt) => flutter.update(dt));
 *   flutter.setWind(dirX, dirZ, strength01)   // else it follows the shared painterly wind (setPainterlyLook({ wind }))
 */
import * as THREE from 'three';
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';

const LOOK = 'nalati-cloth', SEG_PER_M = 5;
/** per strip: anchor + phase, attached edge + across width (> 0: it turns to stay across the wind), length / droop / taper */
interface Strip { readonly a: readonly number[]; readonly s: readonly number[]; readonly p: readonly number[]; readonly seg: number; readonly colour: THREE.Color }

export class Flutter {
  mesh: THREE.Mesh | null = null;
  private readonly strips: Strip[] = [];
  private t = 0;
  private readonly wind: [number, number, number] = [-0.92, -0.38, 0.7];
  /** follow the shard-wide painterly wind (`setPainterlyLook({ wind })`) until `setWind` is called */
  private followShared = true;
  private nVerts = 0;
  private readonly bounds = new THREE.Box3();
  private readonly shade: number[] = [0, 0, 0];
  private readonly rim: number[] = [0, 0, 0];

  /** a ribbon streaming from a single point (the attached edge is `w` wide, horizontal, across the wind) */
  streamer(a: THREE.Vector3, len: number, w: number, color: THREE.ColorRepresentation, o: { droop?: number; taper?: number } = {}): void {
    this.push(a, [0, 0, w], len, color, o.droop ?? 0.45, o.taper ?? 0.35, w);
  }

  /** a flag / pennant: the attached edge runs from `top` down `h` metres, the cloth extends `len` downwind */
  flag(top: THREE.Vector3, h: number, len: number, color: THREE.ColorRepresentation, o: { droop?: number; taper?: number } = {}): void {
    this.push(top, [0, -h, 0], len, color, o.droop ?? 0.25, o.taper ?? 0, 0);
  }

  /** a short strip tied to a line: hangs, lifts and flutters */
  strip(a: THREE.Vector3, len: number, w: number, color: THREE.ColorRepresentation): void {
    this.push(a, [w, 0, 0], len, color, 0.8, 0.2, w);
  }

  private push(a: THREE.Vector3, s: readonly [number, number, number], len: number, color: THREE.ColorRepresentation, droop: number, taper: number, across: number): void {
    const phase = (a.x * 1.7 + a.z * 2.3 + this.strips.length * 0.61) % (Math.PI * 2);
    this.strips.push({ a: [a.x, a.y, a.z, phase], s: [...s, across], p: [len, droop, taper], seg: Math.max(2, Math.min(14, Math.round(len * SEG_PER_M))), colour: new THREE.Color(color) });
    this.bounds.expandByPoint(a);
  }

  get count(): number { return this.strips.length; }

  build(_sky?: Sky): THREE.Mesh {
    // per strip: (seg + 1) × 2 vertices per face, two faces; positions come from the graph
    const index: number[] = [], A: number[] = [], S: number[] = [], P: number[] = [], F: number[] = [], col: number[] = [];
    let maxLen = 0;
    for (const s of this.strips) {
      const rows = s.seg + 1, v0 = A.length / 4;
      for (let i = 0; i < s.seg; i++) {
        const a = v0 + i * 2, a2 = a + rows * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3, a2, a2 + 1, a2 + 2, a2 + 1, a2 + 3, a2 + 2);   // front, back (reversed)
      }
      for (const face of [1, -1]) for (let i = 0; i < rows; i++) for (let j = 0; j < 2; j++) {
        const shade = 0.92 + 0.08 * (1 - i / rows);
        A.push(...s.a); S.push(...s.s); P.push(...s.p, i / s.seg); F.push(j, face); col.push(s.colour.r * shade, s.colour.g * shade, s.colour.b * shade);
      }
      maxLen = Math.max(maxLen, (s.p[0] ?? 0) + Math.hypot(s.s[0] ?? 0, s.s[1] ?? 0, s.s[2] ?? 0) + (s.s[3] ?? 0));
    }
    this.nVerts = A.length / 4;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.nVerts * 3), 3));
    for (const [name, data, width] of [['aClothA', A, 4], ['aClothS', S, 4], ['aClothP', P, 4], ['aClothF', F, 2], ['color', col, 3]] as const) geo.setAttribute(name, new THREE.Float32BufferAttribute(data, width));
    geo.setIndex(index);
    const sphere = new THREE.Sphere(); this.bounds.getBoundingSphere(sphere); sphere.radius += maxLen;
    geo.boundingSphere = sphere;
    this.mesh = new THREE.Mesh(geo, lentLook(LOOK));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = true;
    this.update(0);
    return this.mesh;
  }

  /** wind direction (x, z; normalised here) and strength 0 (calm) … 1 (gale) */
  setWind(x: number, z: number, strength: number): void {
    this.followShared = false;
    const l = Math.hypot(x, z) || 1;
    this.wind[0] = x / l; this.wind[1] = z / l; this.wind[2] = Math.max(0, Math.min(1.5, strength));
  }

  update(dt: number): void {
    if (!this.mesh) return;
    this.t += dt;
    const u = painterlyUniforms;
    if (this.followShared) { const w = u.uPWind.value; this.wind[0] = w.x; this.wind[1] = w.y; this.wind[2] = Math.min(1.2, w.z * 0.7); }
    // the painterly family's live look (the hour's shade and rim, the storm's wet) on the graph's copy of it
    setLentParam(LOOK, 'clothWind', this.wind); setLentParam(LOOK, 'clothTime', this.t);
    setLentParam(LOOK, 'shade', u.uPShade.value.toArray(this.shade)); setLentParam(LOOK, 'rim', u.uPRimColor.value.toArray(this.rim));
    setLentParam(LOOK, 'warm', u.uPWarm.value); setLentParam(LOOK, 'floor', u.uPFloor.value); setLentParam(LOOK, 'wet', u.uPWet.value);
  }

  get vertexCount(): number { return this.nVerts; }
}
