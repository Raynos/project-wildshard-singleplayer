/**
 * Model Explorer (project/archive/2026-09-23-explore-world.md X3; mockups round-3 p04 catalog, p03 turntable, p17 close-up): the Explore pane that
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
import { CHUNK_HALF } from '../core/config';
import type { ContextValue } from '../ui/review';
import { CATEGORIES, measure, type CatalogEntry, type Category } from './catalog';
import type { Explore, ExplorePane } from './Explore';
import { BUDGET, CURRENT_TIER, TIERS } from './tiers';
import type { Tier } from '../core/tier';
import type { Animal } from '../entities/Animal';
import { activeClock, type LightPreset, type WorldClock } from '../world/WorldClock';

type View = 'solid' | 'wire' | 'facets' | 'paint' | 'tiers';
const VIEWS: readonly [View, string][] = [['solid', 'Solid'], ['wire', 'Wireframe'], ['facets', 'Facets'], ['paint', 'Paint'], ['tiers', 'Tiers']];
/** the light presets: held on the shard's day clock (src/world/WorldClock.ts — Driftwood's DayNight or Nalati's DayClock) */
const LIGHTS: readonly [string, LightPreset][] = [['Dawn', 'dawn'], ['Noon', 'noon'], ['Dusk', 'dusk'], ['Night', 'night']];
const THUMB_W = 240, THUMB_H = 180;
/** what the creature viewer can play — a gait speed on the treadmill, or an event (stagger, death) */
type Clip = 'idle' | 'walk' | 'trot' | 'charge' | 'hit' | 'die';
const CLIPS: readonly [Clip, string][] = [['idle', 'Idle'], ['walk', 'Walk'], ['trot', 'Trot'], ['charge', 'Charge'], ['hit', 'Hit'], ['die', 'Die']];
const GAIT: Record<Clip, number> = { idle: 0, walk: 1.3, trot: 3.2, charge: 7, hit: 0, die: 0 };

/** a mesh with three's default generics (instanceof narrows to Mesh<any>) */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;
/** 86 tris · 5.3k tris */
const trisLabel = (n: number): string => (n < 1000 ? `${n} tris` : `${(n / 1000).toFixed(1)}k tris`);
const html = (tag: string, cls: string, inner = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; e.innerHTML = inner; return e; };

export class ModelExplorer implements ExplorePane {
  readonly el: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly studio = new THREE.Group();
  private readonly floor: THREE.Group;
  private readonly contact: THREE.Mesh;
  private savedBackground: THREE.Scene['background'] | undefined;
  /** the built-on-view models standing in the studio (one of a batch, the creatures): only the one on show is visible */
  private readonly fresh = new Set<THREE.Object3D>();
  private current: CatalogEntry | null = null;
  private filter: Category | 'all' = 'all';
  private view: View = 'solid';
  private light = -1;
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
  /** creatures (X8): the clip playing on the treadmill, where it is pinned, the skeleton overlay, half speed */
  private clip: Clip = 'idle';
  private readonly pin = new Map<Animal, { x: number; z: number }>();
  private skeleton = false;
  private skelHelper: THREE.SkeletonHelper | null = null;
  private slow = false;
  /** LINEUP (X8): every creature side by side with height lines */
  private lineup: { group: THREE.Group; labels: { a: Animal; el: HTMLElement }[]; ruler: THREE.LineSegments; marks: HTMLElement[]; base: number } | null = null;
  /** DETAIL TIERS: the model built at each tier, side by side on the disc, with a label each */
  private readonly tierBuilds = new Map<string, Map<Tier, THREE.Object3D>>();
  private tierShown: { tier: Tier; o: THREE.Object3D; label: HTMLElement }[] = [];

  constructor(private readonly explore: Explore, private readonly world: World, private readonly entries: CatalogEntry[]) {
    this.el = html('div', 'ws-x-models');
    const chips = CATEGORIES.map((c) => `<button type="button" data-f="${c.id}">${c.label}</button>`).join('');
    this.grid = html('div', 'ws-x-catalog', `<div class="ws-x-filter">${chips}<button type="button" class="ws-x-lineup">Lineup</button></div><div class="ws-x-grid"></div>`);
    this.sheet = html('div', 'ws-x-turntable', `
      <div class="ws-x-views">${VIEWS.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="ws-x-lights">${LIGHTS.map(([l], i) => `<button type="button" data-l="${i}">${l}</button>`).join('')}</div>
      <div class="ws-x-creature">
        <div class="ws-x-clips">${CLIPS.map(([c, l]) => `<button type="button" data-c="${c}">${l}</button>`).join('')}</div>
        <div class="ws-x-creature-row"><span class="ws-x-variants"></span><button type="button" class="ws-x-skel">Skeleton</button><button type="button" class="ws-x-slow">0.5×</button></div>
      </div>
      <div class="ws-x-sheet">
        <div class="ws-x-sheet-head"><button class="ws-x-back" type="button">‹ Catalog</button><b class="ws-x-name"></b><span class="ws-x-file"></span></div>
        <div class="ws-x-stats"><span><i>Tris</i><b data-s="tris"></b></span><span><i>Draw calls</i><b data-s="calls"></b></span><span><i>Build</i><b data-s="build"></b></span></div>
        <div class="ws-x-budget"><span></span><div class="ws-x-budget-bar"><i></i></div></div>
        <div class="ws-x-actions"><button class="ws-x-inworld" type="button">View in world</button></div>
      </div>`);
    this.el.append(this.grid, this.sheet);
    this.grid.querySelectorAll<HTMLElement>('.ws-x-filter button').forEach((b) => { b.addEventListener('click', () => { this.filter = (b.dataset['f'] ?? 'all') as Category | 'all'; this.renderGrid(); }); });
    this.sheet.querySelectorAll<HTMLElement>('.ws-x-views button').forEach((b) => { b.addEventListener('click', () => { this.setView((b.dataset['v'] ?? 'solid') as View); }); });
    this.sheet.querySelectorAll<HTMLElement>('.ws-x-lights button').forEach((b) => { b.addEventListener('click', () => { this.setLight(Number(b.dataset['l'] ?? -1)); }); });
    this.sheet.querySelector('.ws-x-back')?.addEventListener('click', () => { this.openCatalog(); });
    this.grid.querySelector('.ws-x-lineup')?.addEventListener('click', () => { this.openLineup(); });
    this.sheet.querySelectorAll<HTMLElement>('.ws-x-clips button').forEach((b) => { b.addEventListener('click', () => { this.playClip((b.dataset['c'] ?? 'idle') as Clip); }); });
    this.sheet.querySelector('.ws-x-skel')?.addEventListener('click', () => { this.setSkeleton(!this.skeleton); });
    this.sheet.querySelector('.ws-x-slow')?.addEventListener('click', (ev) => { this.slow = !this.slow; (ev.currentTarget as HTMLElement).classList.toggle('on', this.slow); });
    this.sheet.querySelector('.ws-x-inworld')?.addEventListener('click', () => { const e = this.current; if (e) this.explore.viewInWorld(e); });

    // the studio (X11, target art/build-world/round-6-midway/07): a dark floor whose grid fades into the dark, a raised
    // glass disc with a glowing cyan rim (HDR colour → the bloom picks it up), a soft contact shadow; the day sky is
    // swapped for a deep blue gradient while a model is on show (studioBackdrop). Everything unit-sized; frameModel scales it.
    this.floor = new THREE.Group();
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: fadingGrid(), transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    grid.position.y = -0.002;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.03, 0.12, 72), new THREE.MeshStandardMaterial({ color: 0x10283b, metalness: 0.6, roughness: 0.24 }));
    disc.position.y = -0.06; disc.receiveShadow = true;
    world.sky.setupMaterial(disc.material);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.007, 6, 128).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fe3ff).multiplyScalar(1.9), fog: false, toneMapped: false }));
    rim.position.y = 0.002;
    const glow = new THREE.Mesh(new THREE.RingGeometry(1.02, 1.14, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: rimGlow(), transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    glow.position.y = -0.001;
    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false, fog: false, opacity: 0.75 }));
    this.contact.position.y = 0.004;
    this.floor.add(grid, disc, glow, rim);
    this.studio.add(this.contact);
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

  /** the shard's day clock (src/world/WorldClock.ts) when it has one: the light presets hold it */
  private clock(): WorldClock | null { return activeClock(); }

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
      const card = html('button', 'ws-x-model', `<span class="ws-x-model-thumb"></span><b>${e.name}</b><small>${e.live ? trisLabel(measure(e.object()).tris) : 'built on view'}</small>`);
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
    if (!e.live && o.parent !== this.studio) { this.studio.add(o); this.fresh.add(o); }
    this.isolate(o);
    this.frameModel(o);
    this.setView(this.view);
    this.setLight(this.light);
    const a = e.animal;
    this.sheet.classList.toggle('creature', a !== undefined && this.lineup === null);
    this.sheet.classList.toggle('lineup', this.lineup !== null);
    if (a) { this.pin.set(a, { x: a.position.x, z: a.position.z }); this.clip = 'idle'; this.markClip(); this.renderVariants(e); if (this.skeleton) this.setSkeleton(true); }
    this.sheet.classList.toggle('noclock', this.clock() === null);
    const m = measure(o);
    const q = (s: string): HTMLElement | null => this.sheet.querySelector<HTMLElement>(s);
    const name = q('.ws-x-name'), file = q('.ws-x-file');
    if (name) name.textContent = e.name;
    if (file) file.textContent = e.file;
    const set = (k: string, v: string): void => { const el = q(`.ws-x-stats b[data-s="${k}"]`); if (el) el.textContent = v; };
    set('tris', m.tris.toLocaleString()); set('calls', String(m.calls)); set('build', e.live ? 'at boot' : `${e.buildMs.toFixed(1)} ms`);
    this.budget(m.tris, m.calls);
  }

  private closeModel(): void {
    this.closeLineup();
    this.setSkeleton(false, false);
    if (!this.current) { this.unisolate(); return; }
    this.setView('solid', false);
    this.restoreLight();
    this.unisolate();
    this.current = null;
  }

  /** show only `o` (+ the sky, the lights, the studio floor) */
  private isolate(o: THREE.Object3D): void {
    const { scene } = this.world.game;
    const keep = new Set<THREE.Object3D>([this.studio]);
    if (this.savedBackground === undefined) { this.savedBackground = scene.background; scene.background = studioBackdrop(); }
    // every level from the model up to the scene: its siblings go (one cabin out of the homestead group, one jetty
    // out of the pier), the lights stay
    for (let node: THREE.Object3D = o; node.parent; node = node.parent) {
      keep.add(node);
      for (const c of node.parent.children) {
        if (keep.has(c) || c === node) continue;
        if (node.parent === this.studio && !this.fresh.has(c)) continue; // the studio's own children are the stage
        if (!this.hidden.has(c)) this.hidden.set(c, c.visible);
        c.visible = c instanceof THREE.Light;
      }
      if (node.parent === scene) break;
    }
    this.studio.visible = true;
    o.visible = true;
  }

  private unisolate(): void {
    for (const [c, v] of this.hidden) c.visible = v;
    this.hidden.clear();
    this.studio.visible = false;
    if (this.savedBackground !== undefined) { this.world.game.scene.background = this.savedBackground; this.savedBackground = undefined; }
  }

  private frameModel(o: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.z) * 0.5;
    this.floor.position.set(centre.x, box.min.y, centre.z);
    this.floor.scale.setScalar(Math.max(0.8, r * 1.18));
    this.contact.position.set(centre.x, box.min.y + 0.004, centre.z);
    this.contact.scale.set(Math.max(0.4, size.x * 0.62), 1, Math.max(0.4, size.z * 0.62));
    // aim below the centre so the model rides above the bottom sheet
    this.target.copy(centre); this.target.y -= size.y * 0.18;
    const cam = this.world.game.camera;
    const vHalf = Math.tan((cam.fov * Math.PI) / 360), hHalf = vHalf * cam.aspect;
    const fit = Math.max(r / (0.8 * hHalf), (size.y * 0.5) / (0.55 * vHalf)) + r * 0.6; // ≈ 60 % of a portrait screen's width
    this.dist = fit; this.minDist = Math.max(0.6, fit * 0.15); this.maxDist = fit * 3;
    // open on the lit side: the camera sits between the sun and the model, a little off-axis so the form reads
    const sun = this.world.game.sky.sunDir;
    this.yaw = Math.atan2(sun.x, sun.z) + 0.55; this.pitch = 0.3; this.idle = 0;
  }

  /** this model's share of the phone frame budget (≤ 2.0 M tris, ≤ 150 calls — project/archive/2026-09-22-play-perf.md) */
  private budget(tris: number, calls: number): void {
    const b = BUDGET.phone, share = tris / b.tris;
    const bar = this.sheet.querySelector<HTMLElement>('.ws-x-budget i'), text = this.sheet.querySelector('.ws-x-budget span');
    if (bar) bar.style.width = `${Math.min(100, Math.max(1.5, share * 100))}%`;
    if (text) text.textContent = `Phone budget · ${(share * 100).toFixed(share < 0.01 ? 2 : 1)} % of ${b.tris / 1e6} M tris · ${calls} / ${b.calls} calls · on ${CURRENT_TIER}`;
  }

  private setView(v: View, mark = true): void {
    this.clearTiers();
    // undo the previous swap
    for (const [mesh, mat] of this.swapped) mesh.material = mat;
    this.swapped.clear();
    for (const ov of this.overlays) ov.removeFromParent();
    this.overlays.length = 0;
    this.view = v;
    if (mark) this.sheet.querySelectorAll<HTMLElement>('.ws-x-views button').forEach((b) => { b.classList.toggle('on', b.dataset['v'] === v); });
    const e = this.current;
    if (!e || v === 'solid') return;
    if (v === 'tiers') { this.showTiers(e); return; }
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

  // ── creatures (X8): watch clips on a treadmill, variants, skeleton, the lineup ──
  private markClip(): void { this.sheet.querySelectorAll<HTMLElement>('.ws-x-clips button').forEach((b) => { b.classList.toggle('on', b.dataset['c'] === this.clip); }); }

  private playClip(c: Clip): void {
    const e = this.current, a = e?.animal;
    if (!e || !a) return;
    if (!a.alive) { const p = this.pin.get(a); e.rebuild?.(); this.adopt(e, p); } // DIE is undone by a fresh rig
    const live = e.animal;
    if (!live) return;
    const away = new THREE.Vector3().subVectors(live.position, this.world.game.camera.position).setY(0).normalize();
    if (c === 'hit') live.stagger(away, 1);
    else if (c === 'die') live.applyDamage(live.hp + 1, live.position.clone().setY(live.position.y + 0.6), away);
    this.clip = c === 'hit' ? 'idle' : c;
    this.markClip();
  }

  /** a rebuilt rig takes over the old one's pin, the studio and the skeleton */
  private adopt(e: CatalogEntry, p: { x: number; z: number } | undefined): void {
    const a = e.animal;
    if (!a) return;
    if (p) this.pin.set(a, p);
    if (this.skeleton) this.setSkeleton(true);
  }

  private renderVariants(e: CatalogEntry): void {
    const box = this.sheet.querySelector('.ws-x-variants');
    if (!box) return;
    box.replaceChildren();
    for (const v of e.variants ?? []) {
      const b = html('button', '', v.label);
      (b as HTMLButtonElement).type = 'button';
      b.addEventListener('click', () => {
        const p = e.animal ? this.pin.get(e.animal) : undefined;
        e.rebuild?.(v.id); this.adopt(e, p);
        box.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); });
      });
      box.append(b);
    }
    box.firstElementChild?.classList.add('on');
  }

  private setSkeleton(on: boolean, remember = true): void {
    if (remember) { this.skeleton = on; this.sheet.querySelector('.ws-x-skel')?.classList.toggle('on', on); }
    this.skelHelper?.removeFromParent(); this.skelHelper = null;
    const a = this.current?.animal;
    if (!on || !a) return;
    const h = new THREE.SkeletonHelper(a.mesh);
    const m = h.material as THREE.LineBasicMaterial;
    m.depthTest = false; m.transparent = true; m.opacity = 0.95; m.color.set(0x8fe3ff); m.toneMapped = false; m.fog = false;
    h.renderOrder = 999;
    this.studio.add(h);
    this.skelHelper = h;
  }

  /** LINEUP: every creature on one long disc, sorted by height, facing the camera, with 0.5 m height lines */
  private openLineup(): void {
    this.closeModel();
    const creatures = this.entries.filter((e) => e.category === 'creatures');
    const group = new THREE.Group();
    const labels: { a: Animal; el: HTMLElement }[] = [];
    const rows = creatures.map((e) => { e.object(); const a = e.animal; return { e, a, h: a ? new THREE.Box3().setFromObject(a.mesh).getSize(new THREE.Vector3()) : new THREE.Vector3() }; })
      .filter((r): r is { e: CatalogEntry; a: Animal; h: THREE.Vector3 } => r.a !== undefined)
      .sort((p, q) => p.h.y - q.h.y);
    const first = rows[0]?.a;
    if (!first) return;
    const z0 = first.position.z;
    let x = first.position.x, base = Infinity;
    rows.forEach((r, i) => {
      const w = Math.max(r.h.x, r.h.z);
      if (i > 0) x += w * 0.5 + 0.7;
      r.a.place(x, z0, 0.55);
      r.a.sampleTerrain();
      this.pin.set(r.a, { x, z: z0 });
      x += w * 0.5;
      group.add(r.e.object());
      base = Math.min(base, r.a.position.y);
      const m = measure(r.a.mesh);
      const el = html('div', `ws-x-tierlabel ws-x-lineuplabel${i % 2 === 1 ? ' low' : ''}`, `<b>${r.e.name.replace('Coconut ', '').replace('Drowned ', '').replace('Reef ', '')}</b><small>${r.h.y.toFixed(1)} m · ${m.tris.toLocaleString()}</small>`);
      this.sheet.append(el);
      labels.push({ a: r.a, el });
    });
    // height lines every 0.5 m across the row
    const x0 = first.position.x - 1.5, x1 = x + 1.5, pts: number[] = [];
    for (let hgt = 0.5; hgt <= 2.51; hgt += 0.5) pts.push(x0, base + hgt, z0 - 0.8, x1, base + hgt, z0 - 0.8);
    const ruler = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineDashedMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.45, dashSize: 0.18, gapSize: 0.12, fog: false, toneMapped: false }));
    ruler.computeLineDistances();
    group.add(ruler);
    const marks: HTMLElement[] = [];
    for (let hgt = 0.5; hgt <= 2.51; hgt += 0.5) { const el = html('div', 'ws-x-rulemark', `${hgt.toFixed(1)} m`); this.sheet.append(el); marks.push(el); }
    this.studio.add(group);
    const lineup = { group, labels, ruler, marks, base };
    const entry: CatalogEntry = {
      id: 'lineup', name: 'Creature lineup', category: 'creatures', file: 'src/entities/species/', live: false, buildMs: 0,
      object: () => group,
      tick: (dt, t) => { for (const r of rows) r.a.update(dt, t, true); },
    };
    this.openModel(entry); // (openModel closes whatever was open first — the lineup is only registered after it)
    this.lineup = lineup;
    this.sheet.classList.remove('creature'); this.sheet.classList.add('lineup');
    // frame the row itself (skinned bounds are loose): its span across the width, the tallest up the height
    const cam = this.world.game.camera;
    const span = x - first.position.x + 1.2, tall = rows.reduce((m, r) => Math.max(m, r.h.y), 0);
    const vHalf = Math.tan((cam.fov * Math.PI) / 360), hHalf = vHalf * cam.aspect;
    this.target.set((first.position.x + x) / 2, base + tall * 0.35, z0);
    this.dist = Math.max((span * 0.5) / (0.9 * hHalf), (tall * 0.5) / (0.45 * vHalf)) + 1;
    this.minDist = this.dist * 0.3; this.maxDist = this.dist * 3;
    this.floor.position.set(this.target.x, base, z0); this.floor.scale.setScalar(span * 0.62);
    this.yaw = 0.18; this.pitch = 0.14;
  }

  private closeLineup(): void {
    const l = this.lineup;
    if (!l) return;
    this.lineup = null;
    for (const { el } of l.labels) el.remove();
    for (const el of l.marks) el.remove();
    l.ruler.removeFromParent();
    l.group.removeFromParent();
    const kids = l.group.children.slice(); // a copy: add() moves each child out of the array being walked
    for (const c of kids) this.studio.add(c); // the creatures' own groups go back to the studio
  }

  /** DETAIL TIERS: batch members are rebuilt at each tier (withTier) and stood side by side; a live model has one build */
  private showTiers(e: CatalogEntry): void {
    const o = e.object();
    const build = e.buildAt;
    if (!build) { this.explore.toast(`${e.name}: one build for every tier`); return; }
    let byTier = this.tierBuilds.get(e.id);
    if (!byTier) { byTier = new Map(); this.tierBuilds.set(e.id, byTier); }
    const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3());
    const gap = Math.max(size.x, size.z) * 0.55 + 0.4; // centre to centre / 2: the two stand shoulder to shoulder on the disc
    o.visible = false;
    TIERS.forEach((tier, i) => {
      let t = byTier.get(tier);
      if (!t) { t = build(tier); byTier.set(tier, t); }
      const k = (i - (TIERS.length - 1) / 2) * gap * 2; // along the camera's right axis, so the two never stand one behind the other
      t.position.set(Math.cos(this.yaw) * k, 0, -Math.sin(this.yaw) * k); // batch members are built in world space: offset from where the one on show stands
      this.studio.add(t);
      const m = measure(t);
      const label = html('div', 'ws-x-tierlabel', `<b>${tier}</b><small>${m.tris.toLocaleString()} tris</small>`);
      this.sheet.append(label);
      this.tierShown.push({ tier, o: t, label });
    });
    this.dist *= 1.6;
    this.floor.scale.multiplyScalar(1.7);
  }

  private clearTiers(): void {
    if (this.tierShown.length === 0) return;
    for (const t of this.tierShown) { t.o.removeFromParent(); t.label.remove(); }
    this.tierShown = [];
    if (this.current) { this.current.object().visible = true; this.dist /= 1.6; this.floor.scale.divideScalar(1.7); }
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
    const preset = LIGHTS[i]?.[1];
    if (preset !== undefined) this.clock()?.pin(preset);
  }

  private restoreLight(): void {
    this.clock()?.pin(null);
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
      if (this.idle > 2.5 && !this.drag && this.tierShown.length === 0 && this.lineup === null) this.yaw += dt * 0.22; // the turntable turns while you look (not while comparing tiers / the lineup)
      const cp = Math.cos(this.pitch);
      camera.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
      camera.lookAt(this.target);
      const a = e.animal;
      if (a?.alive === true) a.setMotion(a.yaw, GAIT[this.clip]);
      e.tick?.((this.slow ? 0.5 : 1) * dt, performance.now() / 1000);
      // the treadmill: whatever the gait, the animal stays on the disc
      for (const [an, p] of this.pin) { an.position.x = p.x; an.position.z = p.z; an.mesh.position.x = p.x; an.mesh.position.z = p.z; }
      const l = this.lineup;
      if (l) {
        for (const { a: an, el } of l.labels) {
          const b = new THREE.Box3().setFromObject(an.mesh), q = b.getCenter(new THREE.Vector3()); q.y = b.max.y;
          q.project(camera);
          el.style.transform = `translate(${Math.round((q.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-q.y * 0.5 + 0.5) * innerHeight) - 40}px) translateX(-50%)`;
        }
        l.marks.forEach((el, i) => {
          const pos = l.ruler.geometry.getAttribute('position');
          const q = new THREE.Vector3(pos.getX(i * 2 + 1), pos.getY(i * 2 + 1), pos.getZ(i * 2 + 1)).project(camera); // the right-hand end
          el.style.transform = `translate(${Math.min(innerWidth - 44, Math.round((q.x * 0.5 + 0.5) * innerWidth) - 40)}px, ${Math.round((-q.y * 0.5 + 0.5) * innerHeight) - 13}px)`;
        });
      }
      for (const t of this.tierShown) {
        const b = new THREE.Box3().setFromObject(t.o), p = b.getCenter(new THREE.Vector3()); p.y = b.max.y;
        p.project(camera);
        t.label.style.transform = `translate(${Math.round((p.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-p.y * 0.5 + 0.5) * innerHeight) - 34}px) translateX(-50%)`;
      }
      const preset = LIGHTS[this.light]?.[1];
      if (preset !== undefined) this.clock()?.pin(preset); // held while you look
      return;
    }
    // the catalog floats over a slow orbit of the island, like the hub
    this.catalogT += dt * 0.03;
    camera.position.set(Math.sin(this.catalogT + 2) * CHUNK_HALF * 0.92, CHUNK_HALF * 0.42, Math.cos(this.catalogT + 2) * -CHUNK_HALF * 0.92);
    camera.lookAt(0, 4, 0);
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
    if (!e.live && o.parent !== this.studio) { this.studio.add(o); this.fresh.add(o); }
    this.isolate(o);
    this.frameModel(o);
    const cp = Math.cos(this.pitch);
    // the card is a 4:3 centre crop: on a portrait screen it spans the full width (frameModel's width fit holds), on a
    // landscape one the full height — frame on the model's own centre, not the turntable's raised aim
    const bb = new THREE.Box3().setFromObject(o);
    bb.getCenter(this.target);
    const d = this.dist * (cam.aspect < 1 ? 1.08 : 0.8);
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
    if (small && !e.live) small.textContent = trisLabel(measure(o).tris);
  }
}

/** the studio's backdrop: deep blue at the horizon line, near-black above and below (a canvas the renderer stretches to the screen) */
let backdrop: THREE.CanvasTexture | null = null;
function studioBackdrop(): THREE.CanvasTexture {
  if (backdrop) return backdrop;
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  if (g) {
    const v = g.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, '#04080f'); v.addColorStop(0.42, '#0d2236'); v.addColorStop(0.58, '#123049'); v.addColorStop(1, '#03060b');
    g.fillStyle = v; g.fillRect(0, 0, 256, 512);
    // a soft spotlight behind where the model stands (the midway mockup's studio glow)
    const r = g.createRadialGradient(128, 205, 0, 128, 205, 150);
    r.addColorStop(0, 'rgba(110, 190, 240, 0.34)'); r.addColorStop(0.5, 'rgba(70, 140, 200, 0.12)'); r.addColorStop(1, 'rgba(40, 90, 150, 0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 512);
  }
  backdrop = new THREE.CanvasTexture(c); backdrop.colorSpace = THREE.SRGBColorSpace;
  return backdrop;
}

/** a cyan grid on the studio floor that fades out radially into the dark */
function fadingGrid(): THREE.CanvasTexture {
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d');
  if (g) {
    g.strokeStyle = 'rgba(110, 190, 230, 0.35)'; g.lineWidth = 1;
    const step = n / 20;
    g.beginPath();
    for (let i = 0; i <= 20; i++) { const p = Math.round(i * step) + 0.5; g.moveTo(p, 0); g.lineTo(p, n); g.moveTo(0, p); g.lineTo(n, p); }
    g.stroke();
    g.globalCompositeOperation = 'destination-in';
    const r = g.createRadialGradient(n / 2, n / 2, n * 0.08, n / 2, n / 2, n * 0.5);
    r.addColorStop(0, 'rgba(0,0,0,0.8)'); r.addColorStop(0.4, 'rgba(0,0,0,0.25)'); r.addColorStop(0.75, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, n, n);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** a soft halo just outside the disc's rim */
function rimGlow(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 4;
  const g = c.getContext('2d');
  if (g) {
    const v = g.createLinearGradient(0, 0, 256, 0);
    v.addColorStop(0, 'rgba(143, 227, 255, 0.32)'); v.addColorStop(0.35, 'rgba(143, 227, 255, 0.08)'); v.addColorStop(1, 'rgba(143, 227, 255, 0)');
    g.fillStyle = v; g.fillRect(0, 0, 256, 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** a radial dark blob: the soft contact shadow under the model (the sun's CSM shadow lands on the disc too) */
function contactShadow(): THREE.CanvasTexture {
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(0, 4, 10, 0.85)'); r.addColorStop(0.5, 'rgba(0, 4, 10, 0.45)'); r.addColorStop(1, 'rgba(0, 4, 10, 0)');
    g.fillStyle = r; g.fillRect(0, 0, n, n);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
