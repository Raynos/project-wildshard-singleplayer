/**
 * Set Explorer (E306 / E315 M7, docs/plans/MODEL-ARCHITECTURE.md): the Explore pane between single models and the whole
 * world. A set is a named group of placed models — a camp, a market square, a kurgan field (`placeSet`,
 * src/models/sets.ts). It owns no geometry, so it is shown where it stands: the real world, framed from a 3/4 aerial
 * camera round the set's bounds, orbitable, with its members alongside. Jake (E315): "we can explore individual models,
 * we can explore sets or places, groups, decorated scenes inside of the world, and then we can explore the full world."
 *
 *   const sx = new SetExplorer(explore, world, entries);   explore.addPane('sets', sx);
 *   sx.show({ set: 'nalati-grasslands/kurgan-field' })      // straight into a set;  sx.show({}) → the list
 *
 * List: a card per set — an aerial thumbnail the game renders itself (behind the glass the camera visits each set for a
 * few frames and the frame is copied, so the look, the LODs and the culling are the real ones), its models with their
 * copies and pipeline badges, and the set's own triangles and draws in that view.
 * Scene: drag = orbit, pinch / wheel = zoom, idle → it slowly turns; cyan brackets mark the set's bounds, ◎ on a member
 * outlines its copies (amber); a member row opens its model card (✕ / Esc come back here); ‹ › step through the sets;
 * VIEW IN WORLD hands the view to the World Explorer where it stands. The pure parts (framing, facts, measures) are
 * ./setView.ts.
 */
import * as THREE from 'three';
import type { World } from '../core/bootstrap';
import { CHUNK_HALF } from '../core/config';
import type { ContextValue } from '../ui/review';
import { measure, type CatalogEntry } from './catalog';
import type { Explore, ExplorePane } from './Explore';
import { registeredSets } from './registry';
import type { DrawnAs, Pipeline, RegisteredSet } from '../world/registry';
import { boxEdges, copyBoxes, cornerBrackets, drawnRoots, fitOrbit, liftOf, measureDrawn, memberFacts, poseOrbit, setTotals, type MemberFact, type NdcWindow } from './setView';

type View = 'list' | 'set';

const PIPELINE_LABEL: Readonly<Record<Pipeline, string>> = { code: 'CODE', blender: 'BLENDER', trellis: 'TRELLIS', hunyuan: 'HUNYUAN', cc0: 'CC0' };
/** the card's thumbnail: 2 : 1, cut from the middle of the frame */
const THUMB_W = 480, THUMB_H = 240;
/** the 3/4 aerial: ~41° above the horizon */
const PITCH = 0.72;
/** frames the camera holds a set's view before its thumbnail is copied (the cullers, LODs and near-eye layers settle) */
const SHOT_FRAMES = 5;

/** 86 · 5.3k · 1.24 M */
const count = (n: number): string => (n < 1000 ? String(n) : n < 1e6 ? `${(n / 1000).toFixed(n < 1e4 ? 1 : 0)}k` : `${(n / 1e6).toFixed(2)} M`);
const badge = (p: readonly Pipeline[]): string => (p.length === 0 ? '—' : p.map((x) => PIPELINE_LABEL[x]).join('+'));
const esc = (s: string): string => s.replaceAll(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const html = (tag: string, cls: string, inner = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; e.innerHTML = inner; return e; };

/** a set and what the explorer learned about it */
interface SetInfo {
  readonly set: RegisteredSet;
  readonly facts: MemberFact[];
  readonly totals: { models: number; copies: number };
  /** the objects that draw it, each once */
  readonly drawn: THREE.Object3D[];
  /** its own triangles and draws, measured in its thumbnail's view (null until then) */
  inView: { tris: number; calls: number } | null;
  thumb: HTMLCanvasElement | null;
}

export class SetExplorer implements ExplorePane {
  readonly el: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly cards: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly members: HTMLElement;
  private infos: SetInfo[] = [];
  private current: SetInfo | null = null;
  // the orbit round the open set
  private readonly centre = new THREE.Vector3();
  private yaw = 0; private pitch = PITCH; private dist = 100; private fit = 100; private lift = 0;
  private idle = 0;
  private drag: { id: number; x: number; y: number } | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private readonly scratch = new THREE.PerspectiveCamera();
  // the marks: the set's bounds (cyan brackets), one member's copies (amber boxes)
  private readonly marks = new THREE.Group();
  private readonly brackets: THREE.LineSegments;
  private readonly located: THREE.LineSegments;
  private locatedModel: string | null = null;
  // thumbnails: the camera visits each set in turn behind the list's glass
  private shots: SetInfo[] = [];
  private shot: { info: SetInfo; frames: number; asked: boolean; dist: number; yaw: number } | null = null;
  private shotToken = 0;
  // the per-member triangles, measured a model per frame once a set is open
  private tallies: MemberFact[] = [];
  private readonly eachTris = new Map<string, number>();
  private readonly retries = new Map<string, number>();
  private listT = 0;
  private readoutT = 0;

  constructor(private readonly explore: Explore, private readonly world: World, private readonly entries: readonly CatalogEntry[]) {
    this.el = html('div', 'ws-x-sets');
    const shard = world.chunk.displayName;
    this.listEl = html('div', 'ws-x-setlist', `
      <div class="ws-x-setlist-head"><span>Sets · ${esc(shard)}</span><b class="ws-x-setcount"></b></div>
      <p class="ws-x-setlist-blurb">Groups of placed models — a camp, a square, a field. Each opens where it stands in the world.</p>
      <div class="ws-x-setcards"></div>`);
    this.cards = this.listEl.querySelector<HTMLElement>('.ws-x-setcards') ?? this.listEl;
    this.sheet = html('div', 'ws-x-setsheet', `
      <div class="ws-x-sethead"><button class="ws-x-setback" type="button">‹ Sets</button><b class="ws-x-setname"></b><span class="ws-x-setstep"><button class="ws-x-setprev" type="button" aria-label="Previous set">‹</button><button class="ws-x-setnext" type="button" aria-label="Next set">›</button></span><span class="ws-x-setfile"></span></div>
      <div class="ws-x-setstats"><span><i>Models</i><b data-s="models"></b></span><span><i>Copies</i><b data-s="copies"></b></span><span><i>Tris</i><b data-s="tris"></b></span><span><i>Draws</i><b data-s="calls"></b></span></div>
      <div class="ws-x-setframe"></div>
      <div class="ws-x-setmembers"></div>
      <div class="ws-x-setactions"><button class="ws-x-setworld" type="button">View in world</button></div>`);
    this.members = this.sheet.querySelector<HTMLElement>('.ws-x-setmembers') ?? this.sheet;
    this.el.append(this.listEl, this.sheet);
    // index.html swallows touchmove outside [data-scroll]: without the mark the list can't scroll on a phone (E109)
    this.cards.dataset['scroll'] = ''; this.members.dataset['scroll'] = '';
    this.sheet.querySelector('.ws-x-setback')?.addEventListener('click', () => { this.openList(); });
    this.sheet.querySelector('.ws-x-setprev')?.addEventListener('click', () => { this.step(-1); });
    this.sheet.querySelector('.ws-x-setnext')?.addEventListener('click', () => { this.step(1); });
    this.sheet.querySelector('.ws-x-setworld')?.addEventListener('click', () => {
      const c = this.current;
      if (c) this.explore.viewSetInWorld(this.world.game.camera.position.clone(), this.centre.clone(), c.set.name);
    });

    const line = (color: number, opacity: number): THREE.LineSegments => {
      const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
      l.renderOrder = 999; l.frustumCulled = false;
      return l;
    };
    this.brackets = line(0x8fe3ff, 0.95);
    this.located = line(0xffb547, 0.9);
    this.marks.add(this.brackets, this.located);
    this.marks.visible = false;
    world.game.scene.add(this.marks);

    const canvas = world.game.canvas;
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    new ResizeObserver(() => { this.refit(); }).observe(this.sheet);
  }

  /** the shard's sets as the registry has them now (a shard registers its places a task apart during boot) */
  private sync(): void {
    const sets = registeredSets();
    if (sets.length === this.infos.length && sets.every((s, i) => this.infos[i]?.set === s)) return;
    const old = new Map(this.infos.map((i) => [i.set.id, i]));
    this.infos = sets.map((set) => {
      const was = old.get(set.id);
      return was?.set === set ? was : { set, facts: memberFacts(set, this.entries), totals: setTotals(set), drawn: drawnRoots(set), inView: null, thumb: null };
    });
  }

  show(opts: Record<string, string>): void {
    this.el.classList.add('show');
    this.sync();
    const id = opts['set'];
    const info = id !== undefined ? this.infos.find((i) => i.set.id === id) : undefined;
    if (info) this.openSet(info); else this.openList();
  }

  hide(): void {
    this.el.classList.remove('show');
    this.closeSet();
    this.shot = null; this.shotToken++;
    this.marks.visible = false;
  }

  /** E182: ✕ / Esc steps back to the list while a set is open, and hands the step on from the list itself */
  back(): boolean {
    if (this.el.dataset['view'] !== 'set') return false;
    this.openList();
    return true;
  }

  context(): Record<string, ContextValue> {
    const c = this.current;
    if (!c) return { view: 'sets', sets: this.infos.length };
    const p = this.world.game.camera.position;
    return { view: 'set', set: c.set.id, file: c.set.file, orbit: [p.x, p.y, p.z].map((v) => Number(v.toFixed(1))), located: this.locatedModel ?? '' };
  }

  // ── the list ──

  private openList(): void {
    this.closeSet();
    this.el.dataset['view'] = 'list' satisfies View;
    this.renderList();
    this.shots = this.infos.filter((i) => i.thumb === null);
  }

  private renderList(): void {
    const n = this.infos.length;
    const countEl = this.listEl.querySelector('.ws-x-setcount');
    if (countEl) countEl.textContent = `${n} set${n === 1 ? '' : 's'}`;
    this.cards.replaceChildren();
    if (n === 0) {
      this.cards.append(html('div', 'ws-x-setempty', `<b>No sets on ${esc(this.world.chunk.displayName)} yet</b><small>A set names a group of placed models — <code>placeSet</code> in src/models/sets.ts.</small>`));
      return;
    }
    for (const info of this.infos) {
      const { set, totals, facts } = info;
      const chips = facts.map((f) => `<span class="ws-x-setchip"><em>${badge(f.pipeline)}</em>${esc(f.name)}<small>× ${f.copies.toLocaleString()}</small></span>`).join('');
      const card = html('button', 'ws-x-set', `
        <span class="ws-x-set-thumb"><span class="ws-x-set-title"><b>${esc(set.name)}</b><small>${totals.models} model${totals.models === 1 ? '' : 's'} · ${totals.copies.toLocaleString()} copies</small></span><span class="ws-x-set-go">›</span></span>
        <span class="ws-x-set-cost">${this.costLabel(info)}</span>
        <span class="ws-x-setchips">${chips}</span>`);
      (card as HTMLButtonElement).type = 'button';
      card.dataset['id'] = set.id;
      if (info.thumb) card.querySelector('.ws-x-set-thumb')?.prepend(info.thumb);
      card.addEventListener('click', () => { this.openSet(info); });
      this.cards.append(card);
    }
  }

  private costLabel(info: SetInfo): string {
    const v = info.inView;
    return v === null ? 'measuring…' : `${count(v.tris)} tris · ${v.calls} draw${v.calls === 1 ? '' : 's'} in view`;
  }

  // ── a set, where it stands ──

  private openSet(info: SetInfo): void {
    this.closeSet();
    this.shot = null; this.shotToken++; // a thumbnail being shot waits for the next visit to the list
    this.current = info;
    this.el.dataset['view'] = 'set' satisfies View;
    const { set, totals } = info;
    const q = (s: string): HTMLElement | null => this.sheet.querySelector<HTMLElement>(s);
    const name = q('.ws-x-setname'), file = q('.ws-x-setfile'), step = q('.ws-x-setstep');
    if (name) name.textContent = set.name;
    if (file) file.textContent = set.file;
    if (step) step.hidden = this.infos.length < 2;
    this.stat('models', String(totals.models)); this.stat('copies', totals.copies.toLocaleString());
    this.stat('tris', info.inView ? count(info.inView.tris) : '…'); this.stat('calls', info.inView ? String(info.inView.calls) : '…');
    this.renderMembers(info);
    this.mark(set);
    this.locate(null);
    // the view: from the lit side (the camera between the sun and the set, a little off-axis), fitted to the screen above the sheet
    set.bounds.getCenter(this.centre);
    const sun = this.world.game.sky.sunDir;
    this.yaw = Math.atan2(sun.x, sun.z) + 0.55; this.pitch = PITCH; this.idle = 0;
    this.fit = 0;
    this.refit();
    this.dist = this.fit;
    this.tallies = info.facts.filter((f) => !this.eachTris.has(f.model));
    this.readoutT = 0;
  }

  /** the cyan brackets on a set's bounds */
  private mark(set: RegisteredSet): void {
    this.brackets.geometry.dispose();
    this.brackets.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(cornerBrackets(set.bounds), 3));
    this.marks.visible = true;
  }

  private closeSet(): void {
    this.current = null;
    this.marks.visible = false;
    this.locate(null);
    this.drag = null; this.pointers.clear(); this.pinch = 0;
  }

  private stat(k: string, v: string): void { const b = this.sheet.querySelector(`.ws-x-setstats b[data-s="${k}"]`); if (b) b.textContent = v; }

  private renderMembers(info: SetInfo): void {
    this.members.replaceChildren();
    for (const f of info.facts) {
      const row = html('div', 'ws-x-member', `
        <button class="ws-x-locate" type="button" aria-label="Show its copies"><i></i></button>
        <button class="ws-x-member-open" type="button"${f.drawnAs === null ? ' disabled' : ''}><em>${badge(f.pipeline)}</em><b>${esc(f.name)}</b><small>${this.memberLine(f)}</small><span>›</span></button>`);
      row.dataset['model'] = f.model;
      row.querySelector('.ws-x-locate')?.addEventListener('click', () => { this.locate(this.locatedModel === f.model ? null : f.model); });
      row.querySelector('.ws-x-member-open')?.addEventListener('click', () => { const c = this.current; if (c && f.drawnAs !== null) this.explore.openModelFromSet(f.model, c.set.id); });
      this.members.append(row);
    }
  }

  private memberLine(f: MemberFact): string {
    const t = this.eachTris.get(f.model);
    const drawn: DrawnAs | '' = f.drawnAs ?? '';
    return `× ${f.copies.toLocaleString()}${drawn === '' ? ' · not in the catalog' : ` · ${drawn}`}${t === undefined ? '' : ` · ${count(t)} tris each`}`;
  }

  /** ◎: outline one member's copies in amber (null: none) */
  private locate(model: string | null): void {
    this.locatedModel = model;
    this.located.geometry.dispose();
    const c = this.current;
    const boxes = model !== null && c ? copyBoxes(c.set, model) : [];
    this.located.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(boxEdges(boxes), 3));
    this.located.visible = boxes.length > 0;
    this.members.querySelectorAll<HTMLElement>('.ws-x-member').forEach((r) => { r.classList.toggle('on', r.dataset['model'] === model); });
  }

  /** ‹ › : the neighbouring set, wrapping round */
  private step(by: -1 | 1): void {
    const c = this.current;
    if (!c || this.infos.length < 2) return;
    const i = this.infos.indexOf(c);
    const next = this.infos[(i + by + this.infos.length) % this.infos.length];
    if (next) this.openSet(next);
  }

  /** fit the set into the screen above the sheet and under the top bar, from every yaw; the zoom keeps its ratio */
  private refit(): void {
    const c = this.current;
    if (!c || this.el.dataset['view'] !== 'set') return;
    const cam = this.world.game.camera, H = innerHeight;
    const sheetTop = this.sheet.getBoundingClientRect().top, barBottom = document.querySelector('.ws-x-top')?.getBoundingClientRect().bottom ?? 60;
    const top = 1 - (2 * (barBottom + 12)) / H, bottom = sheetTop > 0 ? 1 - (2 * (sheetTop - 10)) / H : -0.9;
    const win: NdcWindow = { x0: -0.86, x1: 0.86, y0: Math.min(bottom, top - 0.2), y1: top };
    this.scratch.fov = cam.fov; this.scratch.aspect = cam.aspect; this.scratch.near = cam.near; this.scratch.far = cam.far; this.scratch.updateProjectionMatrix();
    const k = this.fit > 0 ? this.dist / this.fit : 1;
    this.lift = liftOf(win);
    this.fit = fitOrbit(c.set.bounds, this.scratch, this.pitch, win);
    this.dist = this.fit * k;
  }

  // ── input: drag orbit, wheel / pinch zoom (only while a set is open) ──
  private get inScene(): boolean { return this.current !== null && this.el.classList.contains('show'); }

  private readonly onDown = (e: PointerEvent): void => {
    if (!this.inScene) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    else { this.drag = null; this.pinch = this.spread(); }
    this.idle = 0;
  };

  private spread(): number { const [a, b] = [...this.pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }

  private readonly onMove = (e: PointerEvent): void => {
    if (!this.inScene || !this.pointers.has(e.pointerId)) return;
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
    this.yaw -= dx * 0.006;
    this.pitch = Math.max(0.2, Math.min(1.45, this.pitch + dy * 0.005));
    this.idle = 0;
  };

  private readonly onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.drag?.id === e.pointerId) this.drag = null;
    if (this.pointers.size < 2) this.pinch = 0;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.inScene) return;
    e.preventDefault();
    this.zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12);
    this.idle = 0;
  };

  private zoom(k: number): void { this.dist = Math.max(this.fit * 0.2, Math.min(this.fit * 3, this.dist * k)); }

  // ── every frame ──

  update(dt: number): void {
    const { camera } = this.world.game;
    const c = this.current;
    if (c) {
      this.idle += dt;
      if (this.idle > 2.5 && !this.drag) this.yaw += dt * 0.12; // it turns slowly while you look
      poseOrbit(camera, this.centre, this.yaw, this.pitch, this.dist, this.lift);
      this.tally();
      this.readoutT -= dt;
      if (this.readoutT <= 0) {
        this.readoutT = 0.5;
        const v = measureDrawn(c.drawn), { stats, lastFrame } = this.world.game;
        this.stat('tris', count(v.tris)); this.stat('calls', String(v.calls));
        const f = this.sheet.querySelector('.ws-x-setframe');
        if (f) f.textContent = `The set's own, in view · whole frame ${count(lastFrame.triangles)} tris · ${lastFrame.calls} calls · ${stats.fps} fps`;
      }
      return;
    }
    if (this.shotStep()) return;
    // the list floats over a slow orbit of the shard, like the hub
    this.listT += dt * 0.03;
    const base = this.world.chunk.spawn.y ?? 0;
    camera.position.set(Math.sin(this.listT + 2) * CHUNK_HALF * 0.92, base + CHUNK_HALF * 0.42, Math.cos(this.listT + 2) * -CHUNK_HALF * 0.92);
    camera.lookAt(0, base + 4, 0);
  }

  /** one member's triangles per copy a frame (its specimen built on first need, like the Model Explorer's cards) */
  private tally(): void {
    const f = this.tallies.shift();
    const c = this.current;
    if (!f || !c) return;
    const e = this.entries.find((x) => x.id === f.model);
    if (!e) return;
    const tris = measure(e.object()).tris;
    if (tris === 0) { if ((this.retries.get(f.model) ?? 0) < 600) { this.retries.set(f.model, (this.retries.get(f.model) ?? 0) + 1); this.tallies.push(f); } return; } // (a GLB still loading: again later)
    this.eachTris.set(f.model, e.live && e.drawnAs === 'instanced' && e.copies > 1 ? Math.round(tris / e.copies) : tris);
    const row = [...this.members.querySelectorAll<HTMLElement>('.ws-x-member')].find((r) => r.dataset['model'] === f.model);
    const small = row?.querySelector('.ws-x-member-open small');
    if (small) small.textContent = this.memberLine(f);
  }

  /**
   * The list's thumbnails: the camera holds each set's aerial view for SHOT_FRAMES frames, then the frame the game drew is
   * copied (Game.captureFrame) and cut to the card, and the set's own draws in it measured. True while one is being shot.
   */
  private shotStep(): boolean {
    const { game } = this.world;
    if (!this.shot) {
      const info = this.shots.shift();
      if (!info) return false;
      const cam = game.camera, W = innerWidth, H = innerHeight;
      const band = W / H >= THUMB_W / THUMB_H ? { w: (H * THUMB_W) / THUMB_H, h: H } : { w: W, h: (W * THUMB_H) / THUMB_W };
      this.scratch.fov = cam.fov; this.scratch.aspect = cam.aspect; this.scratch.near = cam.near; this.scratch.far = cam.far; this.scratch.updateProjectionMatrix();
      const win: NdcWindow = { x0: -(band.w / W) * 0.9, x1: (band.w / W) * 0.9, y0: -(band.h / H) * 0.84, y1: (band.h / H) * 0.84 };
      const sun = game.sky.sunDir;
      const yaw = Math.atan2(sun.x, sun.z) + 0.55;
      this.shot = { info, frames: 0, asked: false, dist: fitOrbit(info.set.bounds, this.scratch, PITCH, win, 1, yaw), yaw };
      this.mark(info.set); // its brackets are in the picture: the card shows which ground is the set
    }
    const s = this.shot;
    poseOrbit(game.camera, s.info.set.bounds.getCenter(this.centre), s.yaw, PITCH, s.dist, 0);
    s.frames++;
    if (s.frames >= SHOT_FRAMES && !s.asked) {
      s.asked = true;
      const token = this.shotToken;
      void game.captureFrame(960).then((frame) => { if (token === this.shotToken) this.took(s.info, frame); return frame; });
    }
    return true;
  }

  /** a set's thumbnail frame is in: its card gets the picture, and the set's own draws in that view */
  private took(info: SetInfo, frame: HTMLCanvasElement): void {
    info.inView = measureDrawn(info.drawn); // the frame just drawn from this view: its culling and LODs as they stand
    info.thumb = cut(frame);
    this.shot = null;
    this.marks.visible = false;
    const card = this.cards.querySelector(`.ws-x-set[data-id="${CSS.escape(info.set.id)}"]`);
    if (!card) return;
    card.querySelector('.ws-x-set-thumb')?.prepend(info.thumb);
    const cost = card.querySelector('.ws-x-set-cost');
    if (cost) cost.textContent = this.costLabel(info);
  }
}

/** the middle 2 : 1 band of a frame, over black (Nine Dragon keeps view depth in alpha: its pixels are not opaque, E289) */
function cut(frame: HTMLCanvasElement): HTMLCanvasElement {
  const W = frame.width, H = frame.height;
  const w = W / H >= THUMB_W / THUMB_H ? (H * THUMB_W) / THUMB_H : W, h = (w * THUMB_H) / THUMB_W;
  const c = document.createElement('canvas'); c.width = THUMB_W; c.height = THUMB_H;
  const g = c.getContext('2d');
  if (g) {
    g.drawImage(frame, (W - w) / 2, (H - h) / 2, w, h, 0, 0, THUMB_W, THUMB_H);
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = '#000'; g.fillRect(0, 0, THUMB_W, THUMB_H);
  }
  return c;
}
