import * as v from 'valibot';
import { GrassPresentationSchema, type GrassPresentationRows } from '@wildshard/format/fieldPresentation';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';

import { TIER } from '@wildshard/engine/core/tier';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { renderCount } from '@wildshard/engine/render/frameCounter';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { wind } from '@wildshard/engine/world/steppeWind';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { trample, TrampleTrail } from '@wildshard/game/systems/looks/trample';


import type { StaticCaptureUniforms } from './staticCapture';

import { loadSpecimenTexture } from '@wildshard/game/models/specimenCatalogue';

import { unzlibSync } from 'fflate';
import { parseSceneBuffers } from '@wildshard/format/sceneBuffers';
import { createSceneBuffers } from '@wildshard/game/shardfile/sceneBuffers';
import { resourceScope } from '@wildshard/engine/app/resources';

import { lentLook, setLentParam, setLentTexture } from '../shardfile/lentLooks';

const MAX_TILES = 256;
type InstancedBufferGeometry = THREE.InstancedBufferGeometry;
const decode = (encoded: string): Uint8Array<ArrayBuffer> => unzlibSync(Uint8Array.from(atob(encoded), value => value.codePointAt(0) ?? 0));
/** Admit the declared instanced drawing buffers. */
function geometries(encoded: string, look: string): InstancedBufferGeometry[] {
  const input: unknown = JSON.parse(new TextDecoder().decode(decode(encoded)));
  return createSceneBuffers(parseSceneBuffers(input), lentLook(look), resourceScope()).children.map(child => {
    if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.InstancedBufferGeometry)) throw new Error('Grass draw requires instanced geometry');
    for (const name of ['aTile', 'aHole']) { const attribute = child.geometry.getAttribute(name); if (attribute instanceof THREE.BufferAttribute) attribute.setUsage(THREE.DynamicDrawUsage); }
    return child.geometry;
  });
}

interface Ring { T: number; G: number; mesh: THREE.Mesh; geo: InstancedBufferGeometry; half: number }

/** Client-only camera-ring presentation over admitted height, mask and draw buffers. No shard callbacks enter this owner. */
export class GrassPresentationProfile {
  private heightTex: THREE.DataTexture | null = null;
  /** O18: held weakly. A strong set, with its removal registered on the ambient owner (the page level after an await),
   *  kept every retired region's grass, its maps and buffers, for the page's life. */
  private readonly instances = new Set<WeakRef<GrassPresentation>>();
  track(instance: GrassPresentation): void { this.instances.add(new WeakRef(instance)); }
  readonly input: GrassPresentationRows;
  constructor(input: unknown) { this.input = v.parse(GrassPresentationSchema,input); this.uniforms.uGrassGain.value = this.input.view.gain; }
readonly uniforms = {
  uSunView: { value: new THREE.Vector3(0, 0.4, 1).normalize() },
  uHemiSky: { value: new THREE.Color(0.4, 0.46, 0.62) },
  uHemiGround: { value: new THREE.Color(0.3, 0.3, 0.16) },
  uHemiI: { value: 0.4 },
  uGrassGain: { value: 1 },
  /** the grass's own saturation (1 by day; the hour / storm pull it down — `grassMood`) */
  uGrassSat: { value: 1 },
  /** …and its tint (white by day; moonlit blue at night, slate in the storm) */
  uGrassTint: { value: new THREE.Color(1, 1, 1) },
  uTime: { value: 0 },
};

mood(night: number, dusk: number, overcast: number): void {
  const g = this.input.view.gain * (1-this.input.view.gainFalloff[0]*dusk) * (1-this.input.view.gainFalloff[1]*night) * (1-this.input.view.gainFalloff[2]*overcast);
  this.uniforms.uGrassGain.value = g;
  this.uniforms.uGrassSat.value = (1-this.input.view.saturationFalloff[0]*dusk) * (1-this.input.view.saturationFalloff[1]*night) * (1-this.input.view.saturationFalloff[2]*overcast);
  const tint = this.input.view.tintNight.map((value,index) => 1+value*night+(this.input.view.tintStorm[index]??0)*overcast);
  this.uniforms.uGrassTint.value.setRGB(tint[0]??1,tint[1]??1,tint[2]??1);
}


  heightTexture(): THREE.DataTexture {
    if (this.heightTex !== null) return this.heightTex;
    const bytes = decode(this.input.height), data = new Uint16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2), n = this.input.view.heightSize;
    const texture = new THREE.DataTexture(data,n,n,THREE.RedFormat,THREE.HalfFloatType);
    texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true;
    this.heightTex = cacheUntilDisposed(texture, () => { if (this.heightTex === texture) this.heightTex = null; }); return texture;
  }
  reseed(): void {
    for (const ref of this.instances) { const instance = ref.deref(); if (instance === undefined) this.instances.delete(ref); else instance.reseed(); }
  }
}

const _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _box = new THREE.Box3(), _origin = new THREE.Vector3();

export class GrassPresentation {
  readonly group = new THREE.Group();
  private readonly maps: { tHeight: THREE.DataTexture; tMask: THREE.DataTexture; tField: THREE.DataTexture; tGround: THREE.DataTexture };
  private readonly maskData: Uint8Array;
  private rings: Ring[] = [];
  private flowers: Ring | null = null;
  private cards: { readonly geo: THREE.InstancedBufferGeometry; readonly tiles: number; readonly origin: THREE.Vector2 } | null = null;
  private readonly trail = new TrampleTrail(trample, 30);
  private baking = 0;
  /** live tunables */
  readonly params = { playerRadius: 0 };

  constructor(private readonly profile: GrassPresentationProfile, private readonly sky: Sky, private readonly forest: Forest, private readonly bakeUniforms: StaticCaptureUniforms, private readonly atlas: Parameters<typeof loadSpecimenTexture>[0]) {
    this.params.playerRadius = profile.input.view.playerRadius;
    const grassRows = profile.input, { heightSize: HN, lattice: LAT, half: CHUNK_HALF } = grassRows.view, LN = Math.ceil(CHUNK_HALF * 2 / LAT) + 1;
    profile.track(this);
    const tHeight = profile.heightTexture();
    const fd = decode(grassRows.field), gd = decode(grassRows.ground);
    const tField = new THREE.DataTexture(fd, LN, LN, THREE.RGBAFormat); tField.magFilter = tField.minFilter = THREE.LinearFilter; tField.needsUpdate = true;
    const tGround = new THREE.DataTexture(gd, LN, LN, THREE.RGBAFormat); tGround.magFilter = tGround.minFilter = THREE.LinearFilter; tGround.needsUpdate = true;
    this.maskData = new Uint8Array(HN * HN * 4).fill(255);
    const tMask = new THREE.DataTexture(this.maskData, HN, HN, THREE.RGBAFormat); tMask.magFilter = tMask.minFilter = THREE.LinearFilter; tMask.needsUpdate = true;
    this.maps = { tHeight, tMask, tField, tGround };
  }

  build(): this {
    const grassRows = this.profile.input, { heightSize: HN, heightOrigin: H_ORG, lattice: LAT, half: CHUNK_HALF, looks: LOOKS } = grassRows.view, [BLADES,HEADS,CLUMPS] = LOOKS, rows = grassRows[TIER], RINGS = rows.rings, FLOWERS = rows.flowers, NEAR = rows.near, LN = Math.ceil(CHUNK_HALF * 2 / LAT) + 1;
    const m = this.maps;
    for (const id of LOOKS) {
      setLentTexture(id, 'tHeight', m.tHeight); setLentTexture(id, 'tMask', m.tMask); setLentTexture(id, 'tField', m.tField);
      setLentParam(id, 'heightXf', [H_ORG, H_ORG, 1 / HN, HN]); setLentParam(id, 'fieldXf', [-CHUNK_HALF, -CHUNK_HALF, 1 / LAT, LN]);
    }
    setLentTexture(BLADES, 'tGround', m.tGround); // the roots sink into the painted ground (the blades only)
    setLentTexture(BLADES, 'tTrample', trample.texture); setLentTexture(CLUMPS, 'tTrample', trample.texture);
    const draw = (id: string, geo: InstancedBufferGeometry, name: string): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, lentLook(id));
      mesh.frustumCulled = false; mesh.name = name;
      mesh.onBeforeRender = (renderer, _s, camera) => { this.place(renderer, camera); };
      this.group.add(mesh);
      return mesh;
    };
    const blades = geometries(rows.scenes.blades, BLADES);
    RINGS.forEach((cfg, ri) => {
      const half = (cfg.G * cfg.T) / 2;
      const geo = blades[ri]; if (geo === undefined) throw new Error('Grass ring missing');
      this.rings.push({ T: cfg.T, G: cfg.G, mesh: draw(BLADES, geo, `grass-v2-ring${ri}`), geo, half });
    });
    {
      const cfg = FLOWERS, half = (cfg.G * cfg.T) / 2;
      const geo = geometries(rows.scenes.flowers, HEADS)[0]; if (geo === undefined) throw new Error('Grass flowers missing');
      this.flowers = { T: cfg.T, G: cfg.G, mesh: draw(HEADS, geo, 'grass-v2-flowers'), geo, half };
    }
    // the near field: the painted card atlas as clumps of 3 crossed quads (not camera-facing: they hold up walked round),
    // on the same field, mask, wind and trample as the blades, cut at the atlas's alpha; the atlas swapped in when it lands
    const per = rows.per, geo = geometries(rows.scenes.cards, CLUMPS)[0];
    if (geo === undefined) throw new Error('Grass cards missing');
    setLentParam(CLUMPS, 'cardNear', [NEAR[0], NEAR[1], per]);
    draw(CLUMPS, geo, 'grass-v2-cards');
    this.cards = { geo, tiles: geo.instanceCount, origin: new THREE.Vector2() };
    void (async (): Promise<void> => {
      try { const atlas = await loadSpecimenTexture(this.atlas); atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping; setLentTexture(CLUMPS, 'tCards', atlas); } catch (e: unknown) { console.warn('[grass v2] no card atlas', e); }
    })();
    void this.bakeMask();
    return this;
  }

  /** the dressing landed (`reseedGrassV2`): bake the fine mask again with its cover */
  reseed(): void { void this.bakeMask(); }

  /**
   * tMask at 1 m: R = the cut-outs (road bed, yurt floor, the exact painted splat, 1 − dressing cover, spruce trunks),
   * G = the verge (0 = capped at the grazed 0.22 m, 1 = the full field). A few rows per task.
   */
  private async bakeMask(): Promise<void> {
    const { heightSize: HN, heightOrigin: H_ORG } = this.profile.input.view;
    const run = ++this.baking;
    await macrotask(); // not inside the caller's task (SF67: the first rows were the grass step's)
    if (run !== this.baking) return;
    const d = decode(this.profile.input.mask);
    // spruce trunks: no blades inside a trunk
    for (const t of this.forest.trees) {
      const r = t.r;
      const i0 = Math.floor(t.x - H_ORG - r - 0.5), j0 = Math.floor(t.z - H_ORG - r - 0.5);
      for (let j = j0; j <= j0 + Math.ceil(2 * r + 1); j++) for (let i = i0; i <= i0 + Math.ceil(2 * r + 1); i++) {
        if (i < 0 || j < 0 || i >= HN || j >= HN) continue;
        if (Math.hypot(H_ORG + i + 0.5 - t.x, H_ORG + j + 0.5 - t.z) < r + 0.35) d[(j * HN + i) * 4] = 0;
      }
    }
    if (run !== this.baking) return;
    this.maskData.set(d);
    this.maps.tMask.needsUpdate = true;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    const LOOKS = this.profile.input.view.looks, [BLADES,HEADS,CLUMPS] = LOOKS;
    // the player parts the grass and leaves a trail; the wind and the trample advance
    this.trail.push(dt, playerPos, this.params.playerRadius);
    wind.update(dt);
    painterlyUniforms.uPWind.value.set(wind.dirX, wind.dirZ, wind.speed / 5);
    trample.update(dt, playerPos);
    this.profile.uniforms.uTime.value += dt;
    // the hemisphere the fill comes from (the rig + the look retune it every frame)
    const hemi = this.sky.hemi;
    this.profile.uniforms.uHemiSky.value.copy(hemi.color); this.profile.uniforms.uHemiGround.value.copy(hemi.groundColor); this.profile.uniforms.uHemiI.value = hemi.intensity;
    // the looks' params: the key, the hemisphere and the mood; the wind, the trample and its live movers; the static bake
    const u = this.profile.uniforms, w = wind.uniforms, t = trample.uniforms, b = this.bakeUniforms;
    const sunDir = painterlyUniforms.uPSunDir.value.toArray(), sunRef = painterlyUniforms.uPSunRef.value.toArray();
    const be = b.uBakeMatrix.value.elements, cols = [0, 1, 2, 3].map((k) => be.slice(k * 4, k * 4 + 4));
    for (const id of LOOKS) {
      setLentParam(id, 'sunDir', sunDir); setLentParam(id, 'sunRef', sunRef);
      setLentParam(id, 'hemiSky', u.uHemiSky.value.toArray()); setLentParam(id, 'hemiGround', u.uHemiGround.value.toArray());
      setLentParam(id, 'mood', [u.uHemiI.value, u.uGrassGain.value, u.uGrassSat.value]); setLentParam(id, 'tint', u.uGrassTint.value.toArray());
      cols.forEach((c, k) => { setLentParam(id, `bakeM${k}`, c); });
      setLentParam(id, 'bakeInfo', b.uBakeInfo.value.toArray()); setLentParam(id, 'contactXf', b.uContactXf.value.toArray());
      if (b.tBakeShadow.value) setLentTexture(id, 'tBakeShadow', b.tBakeShadow.value);
      if (b.tBakeContact.value) setLentTexture(id, 'tBakeContact', b.tBakeContact.value);
    }
    setLentParam(HEADS, 'time', u.uTime.value);
    for (const id of [BLADES, CLUMPS]) {
      setLentParam(id, 'sunView', u.uSunView.value.toArray());
      setLentParam(id, 'wind', [w.uWindDir.value.x, w.uWindDir.value.y, w.uWindTravel.value, w.uWindTime.value]);
      setLentParam(id, 'windAux', [w.uWindSpeed.value, w.uWindGustiness.value]);
      setLentParam(id, 'trampleWin', t.uTrampleWin.value.toArray());
      for (let k = 0; k < 4; k++) setLentParam(id, `mover${k}`, k < t.uMoverCount.value ? (t.uMovers.value[k]?.toArray() ?? [0, 0, 0, 0]) : [0, 0, 0, 0]);
    }
  }

  private placedFrame = -1;
  /**
   * As the frame renders (the camera is final — the first of the four draws calls it, once per render): snap the rings
   * to the camera, cull their tiles against its frustum, fill the tile lists and the instance counts.
   */
  private place(renderer: Renderer, camera: THREE.Camera): void {
    const { half: CHUNK_HALF, cardsHeight, ringHeight } = this.profile.input.view, CARDS = this.profile.input[TIER].cards, CLUMPS = this.profile.input.view.looks[2];
    const frame = renderCount(renderer); // the engine's render count (SF59: node draws bump three's)
    if (frame === this.placedFrame) return;
    this.placedFrame = frame;
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    // the tiles are in the grass's own frame: a grid cell draws it at its offset (zero standalone), the camera is the page's
    const o = _origin.setFromMatrixPosition(this.group.matrixWorld);
    const cx = camera.position.x - o.x, cz = camera.position.z - o.z;
    // seen from high up the fine rings are wasted (their blades are sub-pixel): a ring stands down once the camera is
    // higher above the ground than the ring reaches, and the next ring fills its square
    const above = camera.position.y - o.y - heightAt(Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, cx)), Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, cz)));
    let prev: { cx: number; cz: number; half: number } | null = null;
    this.rings.forEach((R, i) => {
      if (i < this.rings.length - 1 && above > R.half * ringHeight) { R.geo.instanceCount = 0; return; }
      prev = this.fill(R, cx, cz, prev);
    });
    if (this.flowers) this.fill(this.flowers, cx, cz, null);
    if (this.cards) {
      this.cards.geo.instanceCount = above > cardsHeight ? 0 : this.cards.tiles;
      const o2 = this.cards.origin.set(Math.floor(cx / CARDS.T) * CARDS.T, Math.floor(cz / CARDS.T) * CARDS.T);
      setLentParam(CLUMPS, 'cardField', [o2.x, o2.y, CARDS.T, CARDS.s]);
    }
  }

  private fill(R: Ring, camX: number, camZ: number, prev: { cx: number; cz: number; half: number } | null): { cx: number; cz: number; half: number } {
    const CHUNK_HALF = this.profile.input.view.half;
    const { T, G } = R;
    const ox = Math.round(camX / T) * T - (G / 2) * T, oz = Math.round(camZ / T) * T - (G / 2) * T;
    const tileAttr = R.geo.getAttribute('aTile'), holeAttr = R.geo.getAttribute('aHole');
    if (!(tileAttr instanceof THREE.InstancedBufferAttribute) || !(holeAttr instanceof THREE.InstancedBufferAttribute)) return { cx: 0, cz: 0, half: 0 };
    const data = tileAttr.array, hole = holeAttr.array;
    let n = 0;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const x0 = ox + i * T, z0 = oz + j * T;
      if (prev && x0 >= prev.cx - prev.half && x0 + T <= prev.cx + prev.half && z0 >= prev.cz - prev.half && z0 + T <= prev.cz + prev.half) continue;
      if (x0 + T < -CHUNK_HALF || z0 + T < -CHUNK_HALF || x0 > CHUNK_HALF || z0 > CHUNK_HALF) continue;
      const y = heightAt(Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, x0 + T / 2)), Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, z0 + T / 2)));
      _box.min.set(x0, y - T * 0.35 - 2, z0); _box.max.set(x0 + T, y + T * 0.35 + 2, z0 + T);
      _box.translate(_origin); // the frustum is the page's
      if (!_frustum.intersectsBox(_box)) continue;
      if (n >= MAX_TILES) break;
      data[n * 2] = x0; data[n * 2 + 1] = z0;
      if (prev) { hole[n * 4] = prev.cx; hole[n * 4 + 1] = prev.cz; hole[n * 4 + 2] = prev.half; hole[n * 4 + 3] = 1; } else hole[n * 4 + 3] = 0;
      n++;
    }
    tileAttr.needsUpdate = true; holeAttr.needsUpdate = true;
    R.geo.instanceCount = n;
    return { cx: ox + (G / 2) * T, cz: oz + (G / 2) * T, half: (G / 2) * T };
  }
}
