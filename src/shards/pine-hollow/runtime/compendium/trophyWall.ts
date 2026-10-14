import { versionedUrl } from '@wildshard/engine/boot/bytes';
import { declarePanel, type PanelView } from '@wildshard/engine/ui/panel';
import { mountUi, uiScope } from '@wildshard/engine/ui/ownership';
/**
 * The trophy wall (SHARD-PLATFORM M3: the game's, any shard's compendium may hang one; first drawn for a remaster's
 * journal board, the chalk-outline wall).
 * A wall of mount slots from the shard's compendium (`ShardCompendium.trophies`): a slot whose entry is TAKEN shows the
 * animal's own head and shoulders on a wooden shield; the rest show a chalk outline and the name in chalk. Looking at a
 * slot shows a tip under the crosshair ("NOT YET TAKEN" / the name + the joke title) and offers "[E] Examine …", which
 * opens the journal on that entry.
 *
 *   const wall = new TrophyWall({ anchor, state, rows: [3, 4], width: 3, rowY: [1.95, 1.1] });
 *   anchor.add(wall.group); interactables.push(wall.interactable);
 *   game.onUpdate(() => wall.update(camera));   wall.onExamine = (entryId) => journal.open(entryId);
 *   state.onChange → wall.rebuild()             // a new trophy is mounted on the spot
 *
 * `anchor`'s local frame: origin on the wall face at floor level, +x along the wall (the viewer's right), +y up, +z out
 * of the wall into the room. Cheap: ONE merged mesh for every mount + shield (vertex colours, one MeshStandardMaterial)
 * and ONE merged mesh for every chalk decal (a canvas atlas); no lights, nothing per frame but a ray-plane test.
 * Each mount (its shield and the species' head and shoulders, its coat in its vertex colours) is baked offline, posed on
 * the wall (generators/trophyMounts.ts → data/trophyMounts.json + a hash-named geometry pack), fetched only
 * when a slot is taken.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fetchDeflated, GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import mounts from '../../data/trophyMounts.json' with { type: 'json' };
import { loadHandFont } from "@wildshard/game/compendium/Journal";
import type { CompendiumState } from "@wildshard/game/compendium/state";
import type { TrophySlot } from "@wildshard/game/compendium/types";

export interface TrophyWallOptions {
  anchor: THREE.Object3D;
  state: CompendiumState;
  /** slots per row, top row first (their sum = the slot count) */
  rows: readonly number[];
  /** wall width the slots spread over (m) and each row's centre height above the anchor */
  width: number;
  rowY: readonly number[];
  /** draw the look-at tip on the HUD (a declared panel) */
  tip?: boolean;
}

interface Placed { slot: TrophySlot; x: number; y: number; w: number; h: number }

const CELL_W = 256, CELL_H = 320, COLS = 4;
/** how far the eye may be from a slot to read it (m) */
const LOOK_RANGE = 4.2;
/** past this (m) the wall is not drawn */
const CULL = 30;
/** each mount slot's geometry in the baked pack (by entry id) */
const MOUNT_SLOTS: Readonly<Record<string, number>> = mounts.slots;

export class TrophyWall {
  readonly scope = uiScope('trophyWall');
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
  private builds = 0;
  private tip: PanelView | null = null;
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
    if (opts.tip === true) {
      this.tip = declarePanel({ cls: 'ws-cmp-tip' });
      mountUi(this.tip.root, this.scope);
    }
    this.group.name = 'trophy-wall';
    opts.anchor.add(this.group);
    this.rebuild();
    void this.loadChalk();
  }

  private taken(p: Placed): boolean { return this.opts.state.state(p.slot.entry) === 'taken'; }

  /** (re)build the mounts mesh from the taken slots, and the chalk mesh from the rest */
  rebuild(): void {
    void this.mountTaken();
    this.buildChalk();
  }

  /** the taken slots' baked mounts merged into one mesh; the pack is fetched only while a slot is taken, never kept */
  private async mountTaken(): Promise<void> {
    const build = ++this.builds;
    const taken = this.placed.flatMap((p) => { const i = this.taken(p) ? MOUNT_SLOTS[p.slot.entry] : undefined; return i === undefined ? [] : [i]; });
    let parts: THREE.BufferGeometry[] = [];
    if (taken.length > 0) {
      try {
        const pack = new GeometryPack(await fetchDeflated(mounts.url), packedRows(mounts.rows), 'trophy-wall');
        parts = taken.map((i) => pack.geometry(i));
      } catch (error: unknown) { console.error('[trophy-wall] the baked mounts did not load:', error); return; }
    }
    if (build !== this.builds) return; // a newer rebuild won
    if (this.mounts) { this.group.remove(this.mounts); this.mounts.geometry.dispose(); this.mounts = null; }
    if (parts.length === 0) return;
    this.mounts = new THREE.Mesh(mergeGeometries(parts, false), this.mountMat);
    for (const g of parts) g.dispose();
    this.mounts.name = 'trophy-mounts';
    this.group.add(this.mounts);
  }

  /** the outline atlas + the hand font, then the chalk decals */
  private async loadChalk(): Promise<void> {
    const url = this.opts.state.def.skin.chalk?.atlas;
    if (url === undefined) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = versionedUrl(url); // the `?v=` the worker caches it under (E160), as the background download fetched it
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
    tip.flag('', 'show', p !== null);
    if (!p) return;
    const e = this.opts.state.entry(p.slot.entry), st = this.opts.state.state(p.slot.entry);
    const name = st !== 'unknown' && e ? e.name : '???';
    const [top, sub] = st === 'taken' ? [name, p.slot.title] : ['Not yet taken', name];
    tip.fill('', [{ tag: 'span', text: top }, { tag: 'small', text: sub }]);
  }

  /** after a take: re-mount, re-chalk, re-read the tip */
  refresh(): void { this.rebuild(); this.paintTip(); }
}
