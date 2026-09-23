import * as THREE from 'three';
import './styles/elite.css';

/**
 * EliteBar — the named-elite screen pieces (src/game/Elite.ts drives them), styled by `src/ui/styles/elite.css` (prefix
 * `ws-elite-`; the boss bar's antique gold, lighter — elites live in the world, bosses own the screen). Mockups:
 * art/nalati-grasslands/round-2/4-named-elites/*.png.
 *
 *   const ui = new EliteBar();                               // mounts into #hud
 *   ui.show('Aqbars the Pale', 'Irbis of the Crags');  ui.hide();
 *   ui.set(frac, 'head' | 'pinned', headWorld, camera, shimmer, broken)   // every frame: OVER THE HEAD until the fight
 *                                                            // starts (clamped to the screen edge with an arrow when off it),
 *                                                            // then PINNED top-centre (the user's rule); 50 % tick; grey BROKEN
 *   ui.caption('POUNCE')                                     // the signature's name / ENRAGED / BROKEN under the bar
 *   ui.banner(name, epithet)                                 // "NAMED ELITE NEARBY" — slim glass, gold edges, ~4.5 s
 *   ui.chevron(worldPoint | null, camera)                    // a gold chevron at the screen edge toward a threat (Qyran's stoop)
 *   ui.skulls(list, playerPos)                               // gold / grey skulls over the minimap (its north-up ±110 m view)
 *   ui.update(dt)
 */

export interface SkullMark { x: number; z: number; shown: boolean; dead: boolean; engaged: boolean; countdown: number }

const SKULL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C7 2 3.5 5.6 3.5 10.2c0 2.6 1.1 4.6 2.9 5.9V19c0 .9.7 1.6 1.6 1.6h.9v-2.2h1.4v2.2h3.4v-2.2h1.4v2.2h.9c.9 0 1.6-.7 1.6-1.6v-2.9c1.8-1.3 2.9-3.3 2.9-5.9C20.5 5.6 17 2 12 2zm-3.6 11.6a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zm7.2 0a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM12 16.2l-1.2-2.1h2.4z"/></svg>`;
const MINI_R = 110;   // the minimap's view radius (m) — src/ui/Minimap.ts VIEW_RADIUS
const _v = new THREE.Vector3();

export class EliteBar {
  readonly root: HTMLElement;
  private bar: HTMLElement; private name: HTMLElement; private epithet: HTMLElement; private fill: HTMLElement; private lag: HTMLElement;
  private cap: HTMLElement; private arrow: HTMLElement;
  private ban: HTMLElement; private banName: HTMLElement;
  private chev: HTMLElement;
  private skullLayer: HTMLElement | null = null; private skullEls: HTMLElement[] = [];
  private frac = 1; private lagFrac = 1; private lagT = 0; private capT = 0; private banT = 0;
  private mode: 'head' | 'pinned' = 'head';

  constructor(parent: HTMLElement = document.getElementById('hud') ?? document.body) {
    const el = (tag: string, cls: string, html = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
    this.root = el('div', 'ws-elite');
    this.bar = el('div', 'ws-elite-bar');
    this.name = el('div', 'ws-elite-name'); this.epithet = el('div', 'ws-elite-epithet');
    const frame = el('div', 'ws-elite-frame');
    const track = el('div', 'ws-elite-track');
    this.lag = el('div', 'ws-elite-lag'); this.fill = el('div', 'ws-elite-fill');
    track.append(this.lag, this.fill, el('i', 'ws-elite-tick'), el('div', 'ws-elite-shimmer'));
    frame.append(el('span', 'ws-elite-skull', SKULL), track);
    this.cap = el('div', 'ws-elite-caption');
    this.arrow = el('i', 'ws-elite-arrow');
    this.bar.append(this.name, this.epithet, frame, this.cap, this.arrow);
    this.ban = el('div', 'ws-elite-banner');
    this.banName = el('div', 'ws-elite-banner-name');
    const banText = el('div', 'ws-elite-banner-text');
    banText.append(el('div', 'ws-elite-banner-kicker', 'NAMED ELITE NEARBY'), this.banName);
    this.ban.append(el('span', 'ws-elite-skull', SKULL), banText);
    this.chev = el('i', 'ws-elite-chevron');
    this.root.append(this.bar, this.ban, this.chev);
    parent.append(this.root);
  }

  show(name: string, epithet: string): void {
    this.name.textContent = name; this.epithet.textContent = epithet;
    this.frac = this.lagFrac = 1; this.write();
    this.bar.classList.remove('broken');
    this.bar.classList.add('show');
  }
  hide(): void { this.bar.classList.remove('show', 'pinned', 'offscreen', 'beat', 'broken'); this.mode = 'head'; }

  set(frac: number, mode: 'head' | 'pinned', head: THREE.Vector3 | null, camera: THREE.PerspectiveCamera, beat: boolean, broken = false): void {
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - this.frac) > 1e-4) { if (f < this.frac) this.lagT = 0.5; this.frac = f; if (f > this.lagFrac) this.lagFrac = f; this.write(); }
    if (mode !== this.mode) { this.mode = mode; this.bar.classList.toggle('pinned', mode === 'pinned'); if (mode === 'pinned') this.ban.classList.remove('show'); }
    this.bar.classList.toggle('beat', beat);
    this.bar.classList.toggle('broken', broken);
    if (mode === 'pinned' || head === null) { this.bar.style.transform = ''; this.bar.classList.remove('offscreen'); return; }
    // over its head: project; off screen → clamp to the edge, the arrow points at it
    _v.copy(head).project(camera);
    const w = innerWidth, h = innerHeight;
    const behind = _v.z > 1;
    let x = (_v.x * 0.5 + 0.5) * w, y = (-_v.y * 0.5 + 0.5) * h;
    if (behind) { x = w - x; y = h - y; }
    const m = 70, inside = !behind && x > m && x < w - m && y > m && y < h - m;
    let ang = 0;
    if (!inside) {
      const cx = w / 2, cy = h / 2, dx = x - cx, dy = y - cy;
      const k = Math.min((w / 2 - m) / Math.max(1e-3, Math.abs(dx)), (h / 2 - m) / Math.max(1e-3, Math.abs(dy)));
      x = cx + dx * Math.min(1, k); y = cy + dy * Math.min(1, k);
      if (behind && Math.abs(dx) < 1 && Math.abs(dy) < 1) y = h - m;
      ang = Math.atan2(dy, dx);
    }
    this.bar.classList.toggle('offscreen', !inside);
    this.arrow.style.transform = `rotate(${ang.toFixed(3)}rad)`;
    this.bar.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }
  private write(): void { this.fill.style.transform = `scaleX(${this.frac.toFixed(4)})`; this.lag.style.transform = `scaleX(${this.lagFrac.toFixed(4)})`; }

  caption(text: string, seconds = 2.6): void {
    this.cap.textContent = text; this.cap.classList.add('show'); this.capT = seconds;
  }
  banner(name: string, epithet: string): void {
    this.banName.textContent = `${name.toUpperCase()} · ${epithet.toUpperCase()}`;
    // another elite's bar already pinned (two lairs close together): the banner drops below it instead of over it
    this.ban.classList.toggle('below', this.mode === 'pinned' && this.bar.classList.contains('show'));
    this.ban.classList.add('show'); this.banT = 4.5;
  }

  /** a gold chevron on the screen edge toward `world` (null hides it) */
  chevron(world: THREE.Vector3 | null, camera: THREE.PerspectiveCamera): void {
    if (world === null) { this.chev.classList.remove('show'); return; }
    _v.copy(world).project(camera);
    let dx = _v.x, dy = -_v.y;
    if (_v.z > 1) { dx = -dx; dy = -dy; }
    const onScreen = _v.z <= 1 && Math.abs(_v.x) < 0.85 && Math.abs(_v.y) < 0.85;
    if (onScreen) { this.chev.classList.remove('show'); return; }
    const w = innerWidth, h = innerHeight, m = 46;
    const k = Math.min((w / 2 - m) / Math.max(1e-3, Math.abs(dx * w / 2)), (h / 2 - m) / Math.max(1e-3, Math.abs(dy * h / 2)));
    const x = w / 2 + dx * w / 2 * k, y = h / 2 + dy * h / 2 * k;
    this.chev.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${Math.atan2(dy * h, dx * w).toFixed(3)}rad)`;
    this.chev.classList.add('show');
  }

  /** the lairs' skulls over the minimap (north up, −X east, ±110 m) — drawn into the minimap's own box */
  skulls(list: SkullMark[], player: THREE.Vector3): void {
    if (this.skullLayer === null) {
      const mini = document.querySelector('.ws-minimap');
      if (!(mini instanceof HTMLElement)) return;
      this.skullLayer = document.createElement('div'); this.skullLayer.className = 'ws-elite-skulls';
      mini.append(this.skullLayer);
    }
    const layer = this.skullLayer;
    while (this.skullEls.length < list.length) { const e = document.createElement('i'); e.className = 'ws-elite-mapskull'; e.innerHTML = SKULL; layer.append(e); this.skullEls.push(e); }
    const r = layer.clientWidth / 2;
    for (let i = 0; i < list.length; i++) {
      const s = list[i], e = this.skullEls[i];
      if (!s || !e) continue;
      const dx = -(s.x - player.x) / MINI_R * r, dy = -(s.z - player.z) / MINI_R * r;
      const on = s.shown && r > 0 && Math.hypot(dx, dy) < r - 9;
      e.classList.toggle('show', on);
      if (!on) continue;
      e.style.transform = `translate(${(r + dx).toFixed(1)}px, ${(r + dy).toFixed(1)}px)`;
      e.classList.toggle('dead', s.dead); e.classList.toggle('engaged', s.engaged);
      e.style.setProperty('--cd', `${Math.round((1 - s.countdown) * 360)}deg`);
    }
  }

  update(dt: number): void {
    if (this.lagT > 0) this.lagT -= dt;
    else if (this.lagFrac > this.frac) { this.lagFrac = Math.max(this.frac, this.lagFrac - dt * 0.4); this.lag.style.transform = `scaleX(${this.lagFrac.toFixed(4)})`; }
    if (this.capT > 0) { this.capT -= dt; if (this.capT <= 0) this.cap.classList.remove('show'); }
    if (this.banT > 0) { this.banT -= dt; if (this.banT <= 0) this.ban.classList.remove('show'); }
  }
}
