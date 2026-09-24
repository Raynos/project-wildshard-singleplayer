/**
 * The trophy wall (PINE-HOLLOW-REMASTER PH-C4, board B4 wall = C: art/pine-hollow/round-4-journal-ui/C-wall-chalk-outlines.jpg).
 * A wall of mount slots from the shard's compendium (`ShardCompendium.trophies`): a slot whose entry is TAKEN shows the
 * animal's own head and shoulders on a wooden shield; the rest show a chalk outline and the name in chalk. Looking at a
 * slot shows a tip under the crosshair ("NOT YET TAKEN" / the name + the joke title) and offers "[E] Examine …", which
 * opens the journal on that entry.
 *
 *   const wall = new TrophyWall({ anchor, state, factory, rows: [3, 4], width: 3, rowY: [1.95, 1.1] });
 *   anchor.add(wall.group); interactables.push(wall.interactable);
 *   game.onUpdate(() => wall.update(camera));   wall.onExamine = (entryId) => journal.open(entryId);
 *   state.onChange → wall.rebuild()             // a new trophy is mounted on the spot
 *
 * `anchor`'s local frame: origin on the wall face at floor level, +x along the wall (the viewer's right), +y up, +z out
 * of the wall into the room. Cheap: ONE merged mesh for every mount + shield (vertex colours, one MeshStandardMaterial)
 * and ONE merged mesh for every chalk decal (a canvas atlas); no lights, nothing per frame but a ray-plane test.
 * The mount geometry is the species' bind-pose model clipped at the neck (AnimalFactory.model): the generated hull where
 * the animal is one (Pine Hollow PH-M1, pineCreatures.ts — its coat atlas sampled into the vertex colours, so the wall
 * stays one mesh), else the procedural model's own paint.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AnimalFactory } from '../entities/AnimalFactory';
import type { CompendiumState } from '../ui/compendium/state';
import type { TrophySlot } from '../ui/compendium/types';
import { loadHandFont } from '../ui/compendium/Journal';

export interface TrophyWallOptions {
  anchor: THREE.Object3D;
  state: CompendiumState;
  factory: AnimalFactory;
  /** slots per row, top row first (their sum = the slot count) */
  rows: readonly number[];
  /** wall width the slots spread over (m) and each row's centre height above the anchor */
  width: number;
  rowY: readonly number[];
  /** the HUD root for the look-at tip */
  hud?: HTMLElement;
}

interface Placed { slot: TrophySlot; x: number; y: number; w: number; h: number }

const CELL_W = 256, CELL_H = 320, COLS = 4;
/** how far the eye may be from a slot to read it (m) */
const LOOK_RANGE = 4.2;
/** past this (m) the wall is not drawn */
const CULL = 30;
/** the live fur multiplies its vertex paint by a grey strand texture (AnimalFactory); the mount has no texture, so it darkens the paint by about as much */
const FUR_TONE = 0.3;
const WOOD = new THREE.Color(0x6e4a2c), WOOD_DARK = new THREE.Color(0x3a2616);

/** a shield plaque: arched top, straight sides, pointed bottom, extruded, bevelled (y up, facing +z, centred) */
function shieldGeometry(w: number, h: number): THREE.BufferGeometry {
  const s = new THREE.Shape(), hw = w / 2, hh = h / 2;
  // a hunting plaque: a shallow arched top, straight sides, then down to a soft point
  s.moveTo(0, -hh);
  s.quadraticCurveTo(hw * 0.95, -hh * 0.62, hw, -hh * 0.05);
  s.lineTo(hw, hh * 0.72);
  s.quadraticCurveTo(hw * 0.5, hh * 0.78, 0, hh);
  s.quadraticCurveTo(-hw * 0.5, hh * 0.78, -hw, hh * 0.72);
  s.lineTo(-hw, -hh * 0.05);
  s.quadraticCurveTo(-hw * 0.95, -hh * 0.62, 0, -hh);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 2, curveSegments: 10 });
  g.deleteAttribute('uv');
  const pos = g.getAttribute('position'), col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // darker on the bevel and the back, a faint grain across the face
    const face = pos.getZ(i) > 0.04 ? 1 : 0.6;
    c.copy(WOOD_DARK).lerp(WOOD, face * (0.8 + 0.2 * Math.sin(pos.getY(i) * 60 + pos.getX(i) * 7)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g.toNonIndexed();
}

/** a texture's pixels (downscaled to ≤ 512²), to sample a generated hull's coat per vertex; null when unreadable */
function texturePixels(map: THREE.Texture): { data: Uint8ClampedArray; w: number; h: number; flipY: boolean } | null {
  const img = map.image as (CanvasImageSource & { width: number; height: number }) | null;
  if (!img || typeof document === 'undefined' || !(img.width > 0)) return null;
  const k = Math.min(1, 512 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0, w, h);
  return { data: g.getImageData(0, 0, w, h).data, w, h, flipY: map.flipY };
}

/** the head and shoulders of a (kind, variant) model: its bind-pose triangles in front of the neck's base, above the chest */
function mountGeometry(factory: AnimalFactory, kind: string, variant: string): THREE.BufferGeometry | null {
  const model = factory.model(kind, variant);
  // a generated hull (PH-M1): white vertex colours under a photo atlas — the atlas, sampled at each vertex, is its paint
  const atlas = model.hull !== undefined && model.fur.map ? texturePixels(model.fur.map) : null;
  const uv = atlas ? model.geometry.getAttribute('uv') : null, col = model.geometry.getAttribute('color');
  const sc = new THREE.Color();
  const paint = (v: number): [number, number, number] => {
    if (atlas && uv) {
      const u = uv.getX(v) - Math.floor(uv.getX(v)), t = uv.getY(v) - Math.floor(uv.getY(v));
      const x = Math.min(atlas.w - 1, Math.floor(u * atlas.w)), y = Math.min(atlas.h - 1, Math.floor((atlas.flipY ? 1 - t : t) * atlas.h));
      const o = (y * atlas.w + x) * 4;
      sc.setRGB((atlas.data[o] ?? 0) / 255, (atlas.data[o + 1] ?? 0) / 255, (atlas.data[o + 2] ?? 0) / 255, THREE.SRGBColorSpace);
      return [sc.r, sc.g, sc.b];
    }
    return [col.getX(v) * FUR_TONE, col.getY(v) * FUR_TONE, col.getZ(v) * FUR_TONE];
  };
  const neck = model.bones.find((b) => b.name === 'neck1')?.pos, body = model.bones.find((b) => b.name === 'body')?.pos;
  if (!neck || !body) return null;
  const src = model.geometry;
  const pos = src.getAttribute('position'), nrm = src.getAttribute('normal');
  const idx = src.getIndex();
  const cutZ = neck[2] - 0.06, cutY = body[1] - 0.04;
  const P: number[] = [], N: number[] = [], C: number[] = [];
  const tri = (a: number, b: number, c: number): void => {
    const zc = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3, yc = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    if (zc < cutZ || yc < cutY) return;
    for (const v of [a, b, c]) {
      P.push(pos.getX(v) - neck[0], pos.getY(v) - neck[1], pos.getZ(v) - cutZ);
      N.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
      C.push(...paint(v));
    }
  };
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i + 2 < n; i += 3) {
    if (idx) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)); else tri(i, i + 1, i + 2);
  }
  if (P.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
}

export class TrophyWall {
  readonly group = new THREE.Group();
  /** one prompt for the whole wall: it moves to the slot you look at ("[E] Examine Old Ironhide"), radius 0 otherwise */
  readonly interactable: { position: THREE.Vector3; radius: number; label: string; onInteract: () => void };
  onExamine?: (entryId: string) => void;
  private placed: Placed[] = [];
  private mounts: THREE.Mesh | null = null;
  private chalk: THREE.Mesh | null = null;
  private readonly mountMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.35 });
  private chalkMat: THREE.MeshStandardMaterial | null = null;
  private chalkImg: HTMLImageElement | null = null;
  private looked: Placed | null = null;
  private tip: HTMLElement | null = null;
  private readonly ray = new THREE.Ray();
  private readonly inv = new THREE.Matrix4();
  private readonly tmp = new THREE.Vector3();
  private readonly hit = new THREE.Vector3();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  constructor(private opts: TrophyWallOptions) {
    const slots = opts.state.def.trophies ?? [];
    let k = 0;
    opts.rows.forEach((count, r) => {
      const w = opts.width / count, y = opts.rowY[r] ?? 1.5, h = r === 0 ? 0.95 : 0.8;
      for (let i = 0; i < count; i++) {
        const slot = slots[k++];
        if (slot) this.placed.push({ slot, x: -opts.width / 2 + w * (i + 0.5), y, w, h });
      }
    });
    this.interactable = { position: new THREE.Vector3(0, -1e4, 0), radius: 0, label: 'Examine', onInteract: () => { if (this.looked) this.onExamine?.(this.looked.slot.entry); } };
    if (opts.hud) {
      this.tip = document.createElement('div');
      this.tip.className = 'ws-cmp-tip';
      opts.hud.append(this.tip);
    }
    this.group.name = 'trophy-wall';
    opts.anchor.add(this.group);
    this.rebuild();
    void this.loadChalk();
  }

  private taken(p: Placed): boolean { return this.opts.state.state(p.slot.entry) === 'taken'; }

  /** (re)build the mounts mesh from the taken slots, and the chalk mesh from the rest */
  rebuild(): void {
    const parts: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
    for (const p of this.placed) {
      if (!this.taken(p) || !p.slot.mount) continue;
      const shield = shieldGeometry(Math.min(0.62, p.w * 0.78), Math.min(0.7, p.h * 0.8));
      shield.translate(p.x, p.y - 0.06, 0.005);
      parts.push(shield);
      const head = mountGeometry(this.opts.factory, p.slot.mount.kind, p.slot.mount.variant);
      if (!head) continue;
      head.computeBoundingBox();
      const bb = head.boundingBox;
      if (!bb) continue;
      const k = Math.min((p.w * 0.72) / Math.max(0.01, bb.max.x - bb.min.x), (p.h * 0.9) / Math.max(0.01, bb.max.y - bb.min.y), 1.1);
      const yaw = (p.x < 0 ? 1 : -1) * 0.5; // turned toward the room's middle: a mount reads in three-quarter view
      m.compose(t.set(p.x, p.y - 0.05, 0.05), q.setFromEuler(new THREE.Euler(-0.08, yaw, 0)), s.setScalar(k));
      head.applyMatrix4(m);
      head.deleteAttribute('uv');
      parts.push(head);
    }
    if (this.mounts) { this.group.remove(this.mounts); this.mounts.geometry.dispose(); this.mounts = null; }
    if (parts.length > 0) {
      const merged = mergeGeometries(parts.map((g) => { for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'color') g.deleteAttribute(a); return g; }), false);
      for (const g of parts) g.dispose();
      this.mounts = new THREE.Mesh(merged, this.mountMat);
      this.mounts.name = 'trophy-mounts';
      this.group.add(this.mounts);
    }
    this.buildChalk();
  }

  /** the outline atlas + the hand font, then the chalk decals */
  private async loadChalk(): Promise<void> {
    const url = this.opts.state.def.skin.chalk?.atlas;
    if (url === undefined) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    try { await Promise.all([img.decode(), loadHandFont()]); } catch { return; }
    this.chalkImg = img;
    this.buildChalk();
  }

  /** a canvas atlas, one cell per slot (outline + chalk name), white chalk as alpha; planes for the untaken slots */
  private buildChalk(): void {
    const img = this.chalkImg, cells = this.opts.state.def.skin.chalk?.cells;
    if (!img || !cells) return;
    if (this.chalk) { this.group.remove(this.chalk); this.chalk.geometry.dispose(); this.chalk = null; }
    const rows = Math.ceil(this.placed.length / COLS);
    const canvas = document.createElement('canvas');
    canvas.width = CELL_W * COLS; canvas.height = CELL_H * rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const planes: THREE.BufferGeometry[] = [];
    this.placed.forEach((p, i) => {
      if (this.taken(p)) return;
      const cx = (i % COLS) * CELL_W, cy = Math.floor(i / COLS) * CELL_H;
      const c = cells[p.slot.outline];
      if (c) ctx.drawImage(img, c.x * img.naturalWidth, c.y * img.naturalHeight, c.w * img.naturalWidth, c.h * img.naturalHeight, cx + 8, cy + 4, CELL_W - 16, CELL_W - 16);
      const e = this.opts.state.entry(p.slot.entry);
      const named = this.opts.state.state(p.slot.entry) !== 'unknown';
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 44px "WS Hand", "Bradley Hand", cursive';
      ctx.fillText(named && e ? e.name.replace(/^The /, '') : '???', cx + CELL_W / 2, cy + CELL_W + 26, CELL_W - 12);
      // a plane the slot's size, its UVs on this cell (canvas y runs down, UV v up)
      const w = Math.min(p.w * 0.96, p.h * 0.8), h = w * (CELL_H / CELL_W);
      const g = new THREE.PlaneGeometry(w, h);
      const uv = g.getAttribute('uv');
      const u0 = cx / canvas.width, u1 = (cx + CELL_W) / canvas.width, v1 = 1 - cy / canvas.height, v0 = 1 - (cy + CELL_H) / canvas.height;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) > 0.5 ? u1 : u0, uv.getY(k) > 0.5 ? v1 : v0);
      g.translate(p.x, p.y + 0.02 - (h - w) / 2 * 0.9, 0.012);
      planes.push(g);
    });
    // white chalk: luminance → alpha
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height), d = data.data;
    for (let k = 0; k < d.length; k += 4) { const l = Math.max(d[k] ?? 0, d[k + 1] ?? 0, d[k + 2] ?? 0); d[k] = 214; d[k + 1] = 206; d[k + 2] = 190; d[k + 3] = l; }
    ctx.putImageData(data, 0, 0);
    if (planes.length === 0) return;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (this.chalkMat) { this.chalkMat.map?.dispose(); this.chalkMat.map = tex; this.chalkMat.needsUpdate = false; }
    else this.chalkMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, metalness: 0, opacity: 0.62, polygonOffset: true, polygonOffsetFactor: -2 });
    this.chalk = new THREE.Mesh(mergeGeometries(planes, false), this.chalkMat);
    for (const g of planes) g.dispose();
    this.chalk.name = 'trophy-chalk';
    this.chalk.renderOrder = 1;
    this.group.add(this.chalk);
  }

  /** the slot under the crosshair (a ray from the eye against the wall plane), its tip and its prompt */
  update(camera: THREE.Camera): void {
    camera.getWorldPosition(this.tmp);
    this.inv.copy(this.group.matrixWorld).invert();
    const eye = this.tmp.applyMatrix4(this.inv);
    this.group.visible = eye.lengthSq() < CULL * CULL; // a wall inside a cabin: nothing to draw from outside its clearing
    let found: Placed | null = null;
    // only from the room side, within reading range
    if (eye.z > 0.2 && eye.z < LOOK_RANGE && Math.abs(eye.x) < this.opts.width) {
      this.ray.origin.copy(eye);
      camera.getWorldDirection(this.ray.direction).transformDirection(this.inv);
      if (this.ray.direction.z < -0.1 && this.ray.intersectPlane(this.plane, this.hit)) {
        for (const p of this.placed) if (Math.abs(this.hit.x - p.x) < p.w / 2 && Math.abs(this.hit.y - p.y) < p.h / 2 + 0.05) { found = p; break; }
      }
    }
    if (found !== this.looked) {
      this.looked = found;
      this.paintTip();
    }
    if (found) {
      // the prompt rides just ahead of the eye along the look ray: the pick is by distance, so a slot you look at wins over
      // a pickup lying nearer the wall (the AR-15 on this cabin's floor)
      camera.getWorldPosition(this.interactable.position).addScaledVector(camera.getWorldDirection(this.tmp), 0.3);
      this.interactable.radius = 1;
      const e = this.opts.state.entry(found.slot.entry), named = this.opts.state.state(found.slot.entry) !== 'unknown';
      this.interactable.label = `Examine ${named && e ? e.name : '???'}`;
    } else { this.interactable.radius = 0; this.interactable.position.set(0, -1e4, 0); }
  }

  /** the tip: NOT YET TAKEN + the name, or the name + the joke title */
  private paintTip(): void {
    const tip = this.tip;
    if (!tip) return;
    const p = this.looked;
    tip.classList.toggle('show', p !== null);
    if (!p) return;
    const e = this.opts.state.entry(p.slot.entry), st = this.opts.state.state(p.slot.entry);
    const name = st !== 'unknown' && e ? e.name : '???';
    tip.replaceChildren();
    const top = document.createElement('span'), sub = document.createElement('small');
    if (st === 'taken') { top.textContent = name; sub.textContent = p.slot.title; } else { top.textContent = 'Not yet taken'; sub.textContent = name; }
    tip.append(top, sub);
  }

  /** after a take: re-mount, re-chalk, re-read the tip */
  refresh(): void { this.rebuild(); this.paintTip(); }
}
