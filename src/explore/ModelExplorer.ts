/**
 * Model Explorer (EXPLORE-WORLD.md X3; mockups round-3 p04 catalog, p03 turntable, p17 close-up): the Explore pane that
 * puts one model at a time on a turntable — isolated IN the live scene (same renderer, lights, day/night, post chain),
 * so what you inspect is exactly what the game draws.
 *
 *   const me = new ModelExplorer(explore, world, entries);   explore.addPane('model', me);
 *   me.show({ model: 'hut' })  // straight onto a turntable;  me.show({}) → the catalog
 *
 * Catalog: a filterable grid; every card's thumbnail is rendered through the game's own composer, one per two frames
 * (so thumbnails show the real look, AO and grade included). Turntable: drag = orbit (idle → it slowly turns), wheel /
 * pinch = zoom; SOLID · WIREFRAME · FACETS · PAINT; DAWN · NOON · DUSK · NIGHT pin the day/night clock; the sheet shows
 * the source file, triangles, draw calls; VIEW IN WORLD hands the model to the World Explorer.
 */
import * as THREE from 'three';
import type { World } from '../core/bootstrap';
import type { ContextValue } from '../ui/review';
import { CATEGORIES, measure, type CatalogEntry, type Category } from './catalog';
import type { Explore, ExplorePane } from './Explore';

type View = 'solid' | 'wire' | 'facets' | 'paint';
const VIEWS: readonly [View, string][] = [['solid', 'Solid'], ['wire', 'Wireframe'], ['facets', 'Facets'], ['paint', 'Paint']];
/** day/night phases (src/world/DayNight.ts: the day is [0, 20/24) sunrise → sunset, then the night) */
const LIGHTS: readonly [string, number][] = [['Dawn', 0.03], ['Noon', 0.42], ['Dusk', 0.8], ['Night', 0.92]];
const THUMB_W = 240, THUMB_H = 180;

/** a mesh with three's default generics (instanceof narrows to Mesh<any>) */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;
const html = (tag: string, cls: string, inner = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; e.innerHTML = inner; return e; };

export class ModelExplorer implements ExplorePane {
  readonly el: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly studio = new THREE.Group();
  private readonly floor: THREE.Group;
  private current: CatalogEntry | null = null;
  private filter: Category | 'all' = 'all';
  private view: View = 'solid';
  private light = -1;
  private savedPhase: number | null = null;
  private readonly hidden = new Map<THREE.Object3D, boolean>();
  private readonly swapped = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private readonly overlays: THREE.Object3D[] = [];
  private readonly thumbs = new Map<string, HTMLCanvasElement>();
  private thumbQueue: CatalogEntry[] = [];
  private frame = 0;
  // orbit
  private readonly target = new THREE.Vector3();
  private yaw = 0.7; private pitch = 0.32; private dist = 12; private minDist = 2; private maxDist = 60;
  private idle = 0;
  private drag: { id: number; x: number; y: number } | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private catalogT = 0;
  private wireMat: THREE.MeshBasicMaterial | null = null;
  private readonly paintMats = new Map<THREE.Material, THREE.MeshBasicMaterial>();

  constructor(private readonly explore: Explore, private readonly world: World, private readonly entries: CatalogEntry[]) {
    this.el = html('div', 'ws-x-models');
    const chips = CATEGORIES.map((c) => `<button type="button" data-f="${c.id}">${c.label}</button>`).join('');
    this.grid = html('div', 'ws-x-catalog', `<div class="ws-x-filter">${chips}</div><div class="ws-x-grid"></div>`);
    this.sheet = html('div', 'ws-x-turntable', `
      <div class="ws-x-views">${VIEWS.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="ws-x-lights">${LIGHTS.map(([l], i) => `<button type="button" data-l="${i}">${l}</button>`).join('')}</div>
      <div class="ws-x-sheet">
        <div class="ws-x-sheet-head"><button class="ws-x-back" type="button">‹ Catalog</button><b class="ws-x-name"></b><span class="ws-x-file"></span></div>
        <div class="ws-x-stats"></div>
        <div class="ws-x-actions"><button class="ws-x-inworld" type="button">View in world</button></div>
      </div>`);
    this.el.append(this.grid, this.sheet);
    this.grid.querySelectorAll<HTMLElement>('.ws-x-filter button').forEach((b) => { b.addEventListener('click', () => { this.filter = (b.dataset['f'] ?? 'all') as Category | 'all'; this.renderGrid(); }); });
    this.sheet.querySelectorAll<HTMLElement>('.ws-x-views button').forEach((b) => { b.addEventListener('click', () => { this.setView((b.dataset['v'] ?? 'solid') as View); }); });
    this.sheet.querySelectorAll<HTMLElement>('.ws-x-lights button').forEach((b) => { b.addEventListener('click', () => { this.setLight(Number(b.dataset['l'] ?? -1)); }); });
    this.sheet.querySelector('.ws-x-back')?.addEventListener('click', () => { this.openCatalog(); });
    this.sheet.querySelector('.ws-x-inworld')?.addEventListener('click', () => { const e = this.current; if (e) this.explore.viewInWorld(e); });

    // the turntable floor: a dark glass disc, a cyan rim and a faint grid, sized to the model
    this.floor = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0b1622, transparent: true, opacity: 0.88, depthWrite: false, fog: false }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.0, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.9, fog: false, toneMapped: false }));
    const grid = new THREE.GridHelper(2, 16, 0x2a5a70, 0x1a3444); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.5;
    rim.position.y = 0.004; grid.position.y = 0.002;
    this.floor.add(disc, rim, grid);
    this.studio.add(this.floor);
    this.studio.visible = false;
    world.game.scene.add(this.studio);

    const canvas = world.game.canvas;
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.renderGrid();
  }

  get entryList(): readonly CatalogEntry[] { return this.entries; }

  /** the low-poly shard's day/night clock (src/world/DayNight.ts, the remaster's L7) when this build has it: the light presets pin its phase */
  private clock(): { phase: number } | null {
    const sky: object = this.world.game.sky;
    if (!('dayNight' in sky)) return null;
    const dn = sky.dayNight;
    return typeof dn === 'object' && dn !== null && 'phase' in dn && typeof dn.phase === 'number' ? dn as { phase: number } : null;
  }

  show(opts: Record<string, string>): void {
    this.el.classList.add('show');
    const id = opts['model'];
    const e = id !== undefined ? this.entries.find((x) => x.id === id) : undefined;
    if (e) this.openModel(e); else this.openCatalog();
  }

  hide(): void {
    this.el.classList.remove('show');
    this.closeModel();
  }

  context(): Record<string, ContextValue> {
    const e = this.current;
    if (!e) return { view: 'catalog' };
    const m = measure(e.object());
    return { model: e.id, file: e.file, view: this.view, light: this.light >= 0 ? LIGHTS[this.light]?.[0] ?? '' : 'live', tris: m.tris, modelCalls: m.calls };
  }

  // ── catalog ──
  private openCatalog(): void {
    this.closeModel();
    this.el.dataset['view'] = 'catalog';
    this.renderGrid();
    this.thumbQueue = this.entries.filter((e) => !this.thumbs.has(e.id));
  }

  private renderGrid(): void {
    this.grid.querySelectorAll<HTMLElement>('.ws-x-filter button').forEach((b) => { b.classList.toggle('on', b.dataset['f'] === this.filter); });
    const box = this.grid.querySelector('.ws-x-grid');
    if (!box) return;
    box.replaceChildren();
    for (const e of this.entries) {
      if (this.filter !== 'all' && e.category !== this.filter) continue;
      const card = html('button', 'ws-x-model', `<span class="ws-x-model-thumb"></span><b>${e.name}</b><small>${e.live ? `${(measure(e.object()).tris / 1000).toFixed(1)}k tris` : 'built on view'}</small>`);
      (card as HTMLButtonElement).type = 'button';
      const thumb = this.thumbs.get(e.id);
      if (thumb) card.querySelector('.ws-x-model-thumb')?.append(thumb);
      card.addEventListener('click', () => { this.openModel(e); });
      card.dataset['id'] = e.id;
      box.append(card);
    }
  }

  // ── turntable ──
  private openModel(e: CatalogEntry): void {
    this.closeModel();
    this.current = e;
    this.el.dataset['view'] = 'model';
    const o = e.object();
    if (!e.live && o.parent !== this.studio) this.studio.add(o);
    this.isolate(o);
    this.frameModel(o);
    this.setView(this.view);
    this.setLight(this.light);
    this.sheet.classList.toggle('noclock', this.clock() === null);
    const m = measure(o);
    const q = (s: string): HTMLElement | null => this.sheet.querySelector<HTMLElement>(s);
    const name = q('.ws-x-name'), file = q('.ws-x-file'), stats = q('.ws-x-stats');
    if (name) name.textContent = e.name;
    if (file) file.textContent = e.file;
    if (stats) stats.textContent = `TRIS ${m.tris.toLocaleString()} · DRAW CALLS ${m.calls} · ${e.live ? 'built at boot' : `BUILD ${e.buildMs.toFixed(1)} ms`}`;
  }

  private closeModel(): void {
    if (!this.current) { this.unisolate(); return; }
    this.setView('solid', false);
    this.restoreLight();
    this.unisolate();
    this.current = null;
  }

  /** show only `o` (+ the sky, the lights, the studio floor) */
  private isolate(o: THREE.Object3D): void {
    const { scene, sky } = this.world.game;
    const keep = new Set<THREE.Object3D>([this.studio, sky.clouds, sky.sunDisc, sky.planet]);
    if (sky.stylized) keep.add(sky.stylized.dome);
    let root: THREE.Object3D = o;
    while (root.parent && root.parent !== scene) root = root.parent;
    keep.add(root);
    for (const c of scene.children) {
      if (!this.hidden.has(c)) this.hidden.set(c, c.visible);
      c.visible = keep.has(c) || c instanceof THREE.Light;
    }
    this.studio.visible = true;
    o.visible = true;
  }

  private unisolate(): void {
    for (const [c, v] of this.hidden) c.visible = v;
    this.hidden.clear();
    this.studio.visible = false;
  }

  private frameModel(o: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.z) * 0.5;
    this.floor.position.set(centre.x, box.min.y, centre.z);
    this.floor.scale.setScalar(Math.max(1.5, r * 1.35));
    this.target.copy(centre);
    const cam = this.world.game.camera;
    const fit = box.getBoundingSphere(new THREE.Sphere()).radius / Math.sin((cam.fov * Math.PI) / 360) * (cam.aspect < 1 ? 1.25 / Math.max(0.5, cam.aspect) : 1.05);
    this.dist = fit; this.minDist = Math.max(0.6, fit * 0.12); this.maxDist = fit * 3;
    // open on the lit side: the camera sits between the sun and the model, a little off-axis so the form reads
    const sun = this.world.game.sky.sunDir;
    this.yaw = Math.atan2(sun.x, sun.z) + 0.55; this.pitch = 0.3; this.idle = 0;
  }

  private setView(v: View, mark = true): void {
    // undo the previous swap
    for (const [mesh, mat] of this.swapped) mesh.material = mat;
    this.swapped.clear();
    for (const ov of this.overlays) ov.removeFromParent();
    this.overlays.length = 0;
    this.view = v;
    if (mark) this.sheet.querySelectorAll<HTMLElement>('.ws-x-views button').forEach((b) => { b.classList.toggle('on', b.dataset['v'] === v); });
    const e = this.current;
    if (!e || v === 'solid') return;
    e.object().traverse((c) => {
      if (!isMesh(c)) return;
      const mat = c.material;
      if (v === 'wire') { this.swapped.set(c, mat); c.material = this.wire(); }
      else if (v === 'paint') { this.swapped.set(c, mat); c.material = Array.isArray(mat) ? mat.map((m) => this.paint(m)) : this.paint(mat); }
      else if (!(c instanceof THREE.SkinnedMesh)) { // facets: the solid model + its triangle edges on top
        const lines = new THREE.LineSegments(new THREE.WireframeGeometry(c.geometry), new THREE.LineBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.35, fog: false, toneMapped: false }));
        lines.matrixAutoUpdate = false; lines.matrix.identity();
        c.add(lines); this.overlays.push(lines);
      }
    });
  }

  private wire(): THREE.MeshBasicMaterial { return (this.wireMat ??= new THREE.MeshBasicMaterial({ color: 0xbfefff, wireframe: true, fog: false, toneMapped: false })); }

  /** the model's own colours, unlit: what the vertex paint + baked AO look like without the sun */
  private paint(m: THREE.Material): THREE.MeshBasicMaterial {
    let p = this.paintMats.get(m);
    if (!p) {
      const src = m as THREE.MeshStandardMaterial;
      p = new THREE.MeshBasicMaterial({ vertexColors: src.vertexColors, color: src.color instanceof THREE.Color ? src.color : 0xffffff, map: src.map ?? null, side: src.side, fog: false });
      this.paintMats.set(m, p);
    }
    return p;
  }

  private setLight(i: number): void {
    this.light = i;
    this.sheet.querySelectorAll<HTMLElement>('.ws-x-lights button').forEach((b) => { b.classList.toggle('on', Number(b.dataset['l']) === i); });
    const dn = this.clock();
    if (!dn || i < 0) return;
    this.savedPhase ??= dn.phase;
    dn.phase = LIGHTS[i]?.[1] ?? dn.phase;
  }

  private restoreLight(): void {
    const dn = this.clock();
    if (dn && this.savedPhase !== null) dn.phase = this.savedPhase;
    this.savedPhase = null;
    this.light = -1;
  }

  // ── input: drag orbit, wheel / pinch zoom (only while a model is on the turntable) ──
  private get onTurntable(): boolean { return this.current !== null && this.el.classList.contains('show'); }

  private readonly onDown = (e: PointerEvent): void => {
    if (!this.onTurntable) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    else { this.drag = null; this.pinch = this.spread(); }
    this.idle = 0;
  };

  private spread(): number { const [a, b] = [...this.pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }

  private readonly onMove = (e: PointerEvent): void => {
    if (!this.onTurntable || !this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size >= 2) {
      const s = this.spread();
      if (this.pinch > 0 && s > 0) this.zoom(this.pinch / s);
      this.pinch = s;
      return;
    }
    if (!this.drag || this.drag.id !== e.pointerId) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    this.yaw -= dx * 0.008;
    this.pitch = Math.max(-0.15, Math.min(1.45, this.pitch + dy * 0.006));
    this.idle = 0;
  };

  private readonly onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.drag?.id === e.pointerId) this.drag = null;
    if (this.pointers.size < 2) this.pinch = 0;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.onTurntable) return;
    e.preventDefault();
    this.zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12);
    this.idle = 0;
  };

  private zoom(k: number): void { this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist * k)); }

  update(dt: number): void {
    const { camera } = this.world.game;
    const e = this.current;
    if (e) {
      this.idle += dt;
      if (this.idle > 2.5 && !this.drag) this.yaw += dt * 0.22; // the turntable turns while you look
      const cp = Math.cos(this.pitch);
      camera.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
      camera.lookAt(this.target);
      e.tick?.(dt, performance.now() / 1000);
      const dn = this.clock();
      if (dn && this.light >= 0) dn.phase = LIGHTS[this.light]?.[1] ?? dn.phase; // pinned while you look
      return;
    }
    // the catalog floats over a slow orbit of the island, like the hub
    this.catalogT += dt * 0.03;
    camera.position.set(Math.sin(this.catalogT + 2) * 230, 105, 12 + Math.cos(this.catalogT + 2) * -230);
    camera.lookAt(0, 4, 12);
    this.frame++;
    if (this.thumbQueue.length > 0 && this.frame % 2 === 0) this.thumbnail();
  }

  /** render one catalog card through the game's composer: isolate, frame, draw, copy the canvas, put everything back */
  private thumbnail(): void {
    const e = this.thumbQueue.shift();
    if (!e) return;
    const { game } = this.world;
    const cam = game.camera;
    const pos = cam.position.clone(), quat = cam.quaternion.clone();
    const o = e.object();
    if (!e.live && o.parent !== this.studio) this.studio.add(o);
    this.isolate(o);
    this.frameModel(o);
    const cp = Math.cos(this.pitch);
    const d = this.dist * (cam.aspect < 1 ? 0.5 : 0.68); // the thumbnail is a centre crop of the frame: frame tighter
    cam.position.set(this.target.x + Math.sin(this.yaw) * cp * d, this.target.y + Math.sin(this.pitch) * d, this.target.z + Math.cos(this.yaw) * cp * d);
    cam.lookAt(this.target);
    game.composer.render(0);
    const c = document.createElement('canvas'); c.width = THUMB_W; c.height = THUMB_H;
    const src = game.canvas, k = Math.min(src.width / THUMB_W, src.height / THUMB_H);
    const sw = THUMB_W * k, sh = THUMB_H * k;
    c.getContext('2d')?.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, THUMB_W, THUMB_H);
    this.thumbs.set(e.id, c);
    this.unisolate();
    if (!e.live) o.removeFromParent();
    cam.position.copy(pos); cam.quaternion.copy(quat);
    const slot = this.grid.querySelector(`.ws-x-model[data-id="${e.id}"] .ws-x-model-thumb`);
    if (slot && !slot.firstChild) slot.append(c);
    const small = this.grid.querySelector(`.ws-x-model[data-id="${e.id}"] small`);
    if (small && !e.live) small.textContent = `${(measure(o).tris / 1000).toFixed(1)}k tris`;
  }
}
