/**
 * Compare — in-engine vs the target mockup (EXPLORE-WORLD.md X9; mockup round-3 p06): COMPARE (world mode) opens a
 * picker of the Driftwood first-person target mockups; picking one flies the god-mode camera to that mockup's viewpoint
 * and lays the mockup over the live frame. SLIDE drags a divider (live frame left, mockup right), FADE cross-fades
 * with a slider, SWAP flips which side is which; ✕ closes. The camera stays free the whole time, so you can line the
 * shot up by hand; ✎ files the live frame (the overlay is DOM, not in the capture).
 *
 *   const cmp = new Compare(explore, world);   cmp.open();   cmp.close();
 *
 * The images are small copies of art/driftwood-fp-*.png (HUD bar cropped) bundled in the lazy Explore chunk —
 * art/ itself never reaches the Vercel build — and download only when the picker is shown.
 */
import * as THREE from 'three';
import type { World } from '../core/bootstrap';
import { heightAt } from '../world/Heightfield';
import type { Explore } from './Explore';
import spawnArt from './img/mockups/spawn.jpg';
import lookoutArt from './img/mockups/lookout.jpg';
import wreckArt from './img/mockups/wreck.jpg';
import shrineArt from './img/mockups/shrine.jpg';

interface Target { id: string; name: string; img: string; file: string; from: [number, number, number]; look: [number, number, number] }

/** per shard: its target mockups and their viewpoints (x, height above the ground / sea, z → looking at x, height, z) */
const TARGETS: Readonly<Record<string, readonly Target[]>> = { 'driftwood-isle': [
  { id: 'spawn', name: 'Spawn · the pier', img: spawnArt, file: 'art/driftwood-fp-spawn.png', from: [0, 2.9, -232], look: [0, 4, -120] },
  { id: 'lookout', name: 'Lookout', img: lookoutArt, file: 'art/driftwood-fp-poi-1-lookout.png', from: [64, 1.7, 62], look: [94, 12, 94] },
  { id: 'wreck', name: 'Wreck cove', img: wreckArt, file: 'art/driftwood-fp-poi-2-wreck-cove.png', from: [126, 1.8, -14], look: [153, 3, 2] },
  { id: 'shrine', name: 'Ring shrine', img: shrineArt, file: 'art/driftwood-fp-poi-3-shrine.png', from: [-80, 1.7, 86], look: [-98, 6, 108] },
] };

/** does this shard have mockups to compare against? (Explore shows COMPARE only then) */
export function hasCompareTargets(slug: string): boolean { return (TARGETS[slug] ?? []).length > 0; }

type Mode = 'slide' | 'fade';

const html = (tag: string, cls: string, inner = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; e.innerHTML = inner; return e; };

export class Compare {
  readonly button: HTMLElement;
  private readonly picker: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly divider: HTMLElement;
  private readonly fade: HTMLInputElement;
  private mode: Mode = 'slide';
  private split = 0.5;
  private swapped = false;
  private current: Target | null = null;
  private readonly targets: readonly Target[];

  constructor(private readonly explore: Explore, private readonly world: World) {
    this.targets = TARGETS[world.chunk.slug] ?? [];
    this.button = html('button', 'ws-x-comparebtn', '<svg viewBox="0 0 24 24"><path d="M12 3v18 M4 5h6v14H4z M14 5h6v14h-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span>Compare</span>');
    (this.button as HTMLButtonElement).type = 'button';
    this.picker = html('div', 'ws-x-picker', `<div class="ws-x-picker-head"><b>Compare with the mockup</b><button type="button" class="ws-x-picker-close" aria-label="Close">✕</button></div><div class="ws-x-picker-grid">${this.targets.map((t) => `<button type="button" class="ws-x-target" data-id="${t.id}"><span class="ws-x-target-img"></span><b>${t.name}</b></button>`).join('')}</div>`);
    this.overlay = html('div', 'ws-x-compare', `
      <img alt="">
      <div class="ws-x-divider"><i></i></div>
      <span class="ws-x-side ws-x-side-l">In engine</span><span class="ws-x-side ws-x-side-r">Mockup</span>
      <div class="ws-x-compare-bar"><b></b><button type="button" data-m="slide">Slide</button><button type="button" data-m="fade">Fade</button><button type="button" class="ws-x-swap">Swap</button><input type="range" min="0" max="100" value="50" aria-label="Mockup opacity"><button type="button" class="ws-x-compare-close" aria-label="Close compare">✕</button></div>`);
    this.img = this.overlay.querySelector('img') ?? document.createElement('img');
    this.divider = this.overlay.querySelector<HTMLElement>('.ws-x-divider') ?? this.overlay;
    this.fade = this.overlay.querySelector<HTMLInputElement>('input') ?? document.createElement('input');
    this.button.addEventListener('click', () => { this.togglePicker(); });
    this.picker.querySelector('.ws-x-picker-close')?.addEventListener('click', () => { this.picker.classList.remove('show'); });
    this.picker.querySelectorAll<HTMLElement>('.ws-x-target').forEach((b) => { b.addEventListener('click', () => { const t = this.targets.find((x) => x.id === b.dataset['id']); if (t) this.show(t); }); });
    this.overlay.querySelectorAll<HTMLElement>('.ws-x-compare-bar button[data-m]').forEach((b) => { b.addEventListener('click', () => { this.setMode(b.dataset['m'] === 'fade' ? 'fade' : 'slide'); }); });
    this.overlay.querySelector('.ws-x-swap')?.addEventListener('click', () => { this.swapped = !this.swapped; this.apply(); });
    this.overlay.querySelector('.ws-x-compare-close')?.addEventListener('click', () => { this.close(); });
    this.fade.addEventListener('input', () => { this.apply(); });
    // drag the divider (pointer capture on the handle; the canvas keeps every other touch)
    let dragging = false;
    this.divider.addEventListener('pointerdown', (e) => { dragging = true; this.divider.setPointerCapture(e.pointerId); e.preventDefault(); });
    this.divider.addEventListener('pointermove', (e) => { if (!dragging) return; this.split = Math.min(0.98, Math.max(0.02, e.clientX / innerWidth)); this.apply(); });
    const stop = (): void => { dragging = false; };
    this.divider.addEventListener('pointerup', stop); this.divider.addEventListener('pointercancel', stop);
    explore.root.append(this.button, this.picker, this.overlay);
  }

  get isOpen(): boolean { return this.overlay.classList.contains('show'); }

  private togglePicker(): void {
    if (!this.picker.classList.contains('show')) {
      // the thumbnails load now, not at boot
      this.picker.querySelectorAll<HTMLElement>('.ws-x-target').forEach((b) => { const t = this.targets.find((x) => x.id === b.dataset['id']); const slot = b.querySelector<HTMLElement>('.ws-x-target-img'); if (t && slot) slot.style.backgroundImage = `url('${t.img}')`; });
    }
    this.picker.classList.toggle('show');
  }

  private show(t: Target): void {
    this.current = t;
    this.picker.classList.remove('show');
    const at = (x: number, h: number, z: number): THREE.Vector3 => new THREE.Vector3(x, Math.max(heightAt(x, z), this.world.chunk.ocean?.level ?? -Infinity) + h, z);
    this.explore.flyTo(at(...t.from), at(...t.look));
    this.img.src = t.img;
    const name = this.overlay.querySelector('.ws-x-compare-bar b');
    if (name) name.textContent = t.name;
    this.overlay.classList.add('show');
    this.apply();
  }

  close(): void { this.overlay.classList.remove('show'); this.picker.classList.remove('show'); this.current = null; }

  private setMode(m: Mode): void { this.mode = m; this.apply(); }

  private apply(): void {
    this.overlay.dataset['mode'] = this.mode;
    this.overlay.querySelectorAll<HTMLElement>('.ws-x-compare-bar button[data-m]').forEach((b) => { b.classList.toggle('on', b.dataset['m'] === this.mode); });
    this.overlay.classList.toggle('swapped', this.swapped);
    if (this.mode === 'fade') {
      this.img.style.clipPath = 'none';
      this.img.style.opacity = String(Number(this.fade.value) / 100);
      return;
    }
    this.img.style.opacity = '1';
    const pct = `${(this.split * 100).toFixed(2)}%`;
    // slide: the mockup covers one side of the divider (right by default, left when swapped)
    this.img.style.clipPath = this.swapped ? `inset(0 calc(100% - ${pct}) 0 0)` : `inset(0 0 0 ${pct})`;
    this.divider.style.left = pct;
  }

  context(): Record<string, string> { return this.current ? { compare: this.current.id, mockup: this.current.file } : {}; }
}
