/**
 * Select — tap / click a model in the World Explorer (project/archive/2026-09-23-explore-world.md X4; mockups round-3 p09, round-4 g09 / g13;
 * E67: round-6 midway 04): a cyan box, its size in a tag over the box's top, and a glass card standing beside it —
 * name · source file · tris — with OPEN IN MODEL EXPLORER (the turntable), ORBIT (one finger / Alt-drag turns around
 * it) and ✕.
 *
 *   const sel = new Select(explore, world, targets);   // targets: what a tap can hit (catalog entries, batched meshes, animals)
 *   sel.pick(clientX, clientY)   // from TouchFly.onTap or a desktop left click
 *   sel.selectEntry(entry)       // VIEW IN WORLD lands with the model selected
 *   sel.update()                 // every frame: the tag and the card follow the box on screen
 */
import * as THREE from 'three';
import type { World } from '../core/bootstrap';
import type { ContextValue } from '../ui/review';
import { measure, type CatalogEntry } from './catalog';
import type { Explore } from './Explore';

/** something a tap can hit: an object (or a batch mesh) and how it maps to a catalog entry + a box */
export interface SelectTarget {
  object: THREE.Object3D;
  /** the catalog entry this hit opens (by id) */
  entry: string;
  /** the selection box for a hit at `point` (batches: the one member under the tap); default = the object's box */
  boxAt?: (point: THREE.Vector3) => THREE.Box3;
  label?: (point: THREE.Vector3) => string;
}

const html = (tag: string, cls: string, inner = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; e.innerHTML = inner; return e; };

export class Select {
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly helper: THREE.Box3Helper;
  private readonly box = new THREE.Box3();
  private readonly card: HTMLElement;
  private readonly dim: HTMLElement;
  private readonly corner = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private current: { entry: CatalogEntry; label: string } | null = null;
  private down: { x: number; y: number; t: number } | null = null;

  constructor(private readonly explore: Explore, private readonly world: World, private readonly targets: SelectTarget[], private readonly entries: readonly CatalogEntry[]) {
    this.helper = new THREE.Box3Helper(this.box, 0x8fe3ff);
    const m = this.helper.material as THREE.LineBasicMaterial;
    m.depthTest = false; m.transparent = true; m.opacity = 0.9; m.fog = false; m.toneMapped = false;
    this.helper.renderOrder = 999;
    this.helper.visible = false;
    world.game.scene.add(this.helper);
    this.card = html('div', 'ws-x-select', `
      <b></b><small></small>
      <div class="ws-x-select-actions"><button type="button" class="ws-x-open">Open in model explorer</button><button type="button" class="ws-x-orbit">Orbit</button><button type="button" class="ws-x-deselect" aria-label="Deselect">✕</button></div>`);
    this.dim = html('div', 'ws-x-select-dim');
    explore.root.append(this.dim, this.card);
    this.card.querySelector('.ws-x-open')?.addEventListener('click', () => { const c = this.current; if (c) { this.clear(); this.explore.setMode('model', { model: c.entry.id }); } });
    this.card.querySelector('.ws-x-orbit')?.addEventListener('click', () => { this.orbit(); });
    this.card.querySelector('.ws-x-deselect')?.addEventListener('click', () => { this.clear(); });
    // desktop: a left click that did not drag (FreeCam owns right / middle / Alt+left)
    const canvas = world.game.canvas;
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0 && !e.altKey) this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', (e) => {
      const d = this.down; this.down = null;
      if (!d || e.pointerType !== 'mouse' || e.button !== 0) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 400) this.pick(e.clientX, e.clientY);
    });
  }

  get selected(): CatalogEntry | null { return this.current?.entry ?? null; }

  /** the nearest target under a screen point; empty space clears the selection */
  pick(x: number, y: number): void {
    if (this.explore.mode !== 'world') return;
    const { camera } = this.world.game;
    this.ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, camera);
    this.ray.far = 600;
    let best: { t: SelectTarget; point: THREE.Vector3; d: number } | null = null;
    for (const t of this.targets) {
      if (!t.object.visible) continue;
      const hit = this.ray.intersectObject(t.object, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { t, point: hit.point.clone(), d: hit.distance };
    }
    if (!best) { this.clear(); return; }
    const entry = this.entries.find((e) => e.id === best.t.entry);
    if (!entry) { this.clear(); return; }
    this.box.copy(best.t.boxAt ? best.t.boxAt(best.point) : new THREE.Box3().setFromObject(best.t.object));
    this.show(entry, best.t.label?.(best.point) ?? entry.name);
  }

  /** select a catalog entry directly (VIEW IN WORLD) */
  selectEntry(e: CatalogEntry): void {
    const o = e.object();
    if (!o.parent) return;
    this.box.setFromObject(o);
    this.show(e, e.name);
  }

  clear(): void {
    this.current = null;
    this.helper.visible = false;
    this.card.classList.remove('show');
    this.dim.classList.remove('show');
    this.explore.setOrbit(false);
  }

  context(): Record<string, ContextValue> {
    const c = this.current;
    return c ? { selected: c.entry.id, selectedFile: c.entry.file } : {};
  }

  private show(entry: CatalogEntry, label: string): void {
    this.current = { entry, label };
    this.helper.visible = true;
    const size = this.box.getSize(this.tmp);
    const b = this.card.querySelector('b'), small = this.card.querySelector('small');
    this.dim.textContent = `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} m`;
    if (b) b.textContent = label;
    if (small) small.textContent = `${entry.file} · ${(entry.live ? measure(entry.object()).tris : 0) > 0 ? `${measure(entry.object()).tris.toLocaleString()} tris` : 'open to measure'}`;
    this.card.classList.add('show');
    this.dim.classList.add('show');
    this.update();
  }

  private orbit(): void {
    if (!this.current) return;
    this.explore.setOrbit(true, this.box.getCenter(new THREE.Vector3()));
  }

  /**
   * every frame: the box's screen rectangle (its eight corners projected) places the size tag over its top edge and the
   * card beside it — right if it fits, else left, else under it; both hide while the box is behind the camera
   */
  update(): void {
    if (!this.current || this.explore.mode !== 'world') { if (this.current && this.explore.mode !== 'world') this.clear(); return; }
    const { camera } = this.world.game;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
    for (let i = 0; i < 8; i++) {
      const p = this.corner.set(i & 1 ? this.box.max.x : this.box.min.x, i & 2 ? this.box.max.y : this.box.min.y, i & 4 ? this.box.max.z : this.box.min.z).project(camera);
      if (p.z > 1) { behind = true; break; }
      const x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const hide = behind ? 'hidden' : '';
    this.card.style.visibility = hide; this.dim.style.visibility = hide;
    if (behind) return;
    const W = innerWidth, H = innerHeight, pad = 8, top = 70, bottom = 90;
    const clamp = (v: number, lo: number, hi: number): number => Math.round(Math.max(lo, Math.min(hi, v)));
    const dw = this.dim.offsetWidth, dh = this.dim.offsetHeight;
    this.dim.style.transform = `translate(${clamp((x0 + x1) / 2 - dw / 2, pad, W - dw - pad)}px, ${clamp(y0 - dh - 6, top, H - dh - bottom)}px)`;
    const w = this.card.offsetWidth, h = this.card.offsetHeight, mid = (y0 + y1) / 2 - h / 2;
    let cx: number, cy: number;
    if (x1 + 10 + w <= W - pad) { cx = x1 + 10; cy = mid; }
    else if (x0 - 10 - w >= pad) { cx = x0 - 10 - w; cy = mid; }
    else { cx = (x0 + x1) / 2 - w / 2; cy = y1 + 12; }
    this.card.style.transform = `translate(${clamp(cx, pad, W - w - pad)}px, ${clamp(cy, top, H - h - bottom)}px)`;
  }
}
