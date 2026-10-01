/**
 * World Explorer's static image comparison. Each target has a capture from the same authored
 * camera. Opening it never flies or moves the live camera. Images are requested only when
 * the picker opens and a pair is selected.
 */
import type { World } from '../core/bootstrap';
import type { Explore } from './Explore';

const pictures = import.meta.glob<string>('./img/mockups/*.jpg', { eager: true, query: '?url', import: 'default' });
const picture = (name: string): string => pictures[`./img/mockups/${name}.jpg`] ?? '';

interface Target { id: string; name: string; live: string; target: string; file: string }
const pair = (id: string, name: string, prefix: string, file: string): Target =>
  ({ id, name, live: picture(`${prefix}-live`), target: picture(`${prefix}-target`), file });

/** The source path in each row is carried into review notes. */
const TARGETS: Readonly<Record<string, readonly Target[]>> = {
  'nalati-grasslands': [
    pair('camp', 'Camp', 'nalati-camp', 'art/nalati-grasslands/round-5-paintover/camp-po-phone.jpg'),
    pair('rail', 'River rail', 'nalati-rail', 'art/nalati-grasslands/round-5-paintover/rail-po-phone.jpg'),
    pair('gully', 'Gully', 'nalati-gully', 'art/nalati-grasslands/round-5-paintover/gully-po-phone.jpg'),
  ],
};

export function hasCompareTargets(world: World): boolean { return (world.game.level.explore?.compare ?? TARGETS[world.chunk.slug] ?? []).length > 0; }

const html = (tag: string, cls: string, inner = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; e.innerHTML = inner; return e; };

export class Compare {
  readonly button: HTMLElement;
  private readonly picker: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly liveImg: HTMLImageElement;
  private readonly targetImg: HTMLImageElement;
  private readonly divider: HTMLElement;
  private readonly targets: readonly Target[];
  private split = 0.5;
  private current: Target | null = null;

  constructor(private readonly explore: Explore, world: World) {
    this.targets = world.game.level.explore?.compare?.map((t) => ({ id: t.id, name: t.label, live: t.live, target: t.image, file: t.target })) ?? TARGETS[world.chunk.slug] ?? [];
    this.button = html('button', 'ws-x-comparebtn', '<svg viewBox="0 0 24 24"><path d="M12 3v18 M4 5h6v14H4z M14 5h6v14h-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span>Compare</span>');
    (this.button as HTMLButtonElement).type = 'button';
    this.picker = html('div', 'ws-x-picker', `<div class="ws-x-picker-head"><b>Compare with the mockup</b><button type="button" class="ws-x-picker-close" aria-label="Close">✕</button></div><div class="ws-x-picker-grid">${this.targets.map((t) => `<button type="button" class="ws-x-target" data-id="${t.id}"><span class="ws-x-target-img"></span><b>${t.name}</b></button>`).join('')}</div>`);
    this.overlay = html('div', 'ws-x-compare', `
      <img class="ws-x-compare-live" alt="In-engine capture" draggable="false">
      <img class="ws-x-compare-target" alt="Target mockup" draggable="false">
      <div class="ws-x-divider" role="slider" tabindex="0" aria-label="Image comparison split" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><i></i></div>
      <div class="ws-x-compare-head"><b></b><button type="button" class="ws-x-compare-close" aria-label="Close comparison">✕</button></div>
      <span class="ws-x-side ws-x-side-l">In engine</span><span class="ws-x-side ws-x-side-r">Mockup</span>`);
    this.liveImg = this.overlay.querySelector<HTMLImageElement>('.ws-x-compare-live') ?? document.createElement('img');
    this.targetImg = this.overlay.querySelector<HTMLImageElement>('.ws-x-compare-target') ?? document.createElement('img');
    this.divider = this.overlay.querySelector<HTMLElement>('.ws-x-divider') ?? this.overlay;
    this.button.addEventListener('click', () => { this.togglePicker(); });
    this.picker.querySelector('.ws-x-picker-close')?.addEventListener('click', () => { this.picker.classList.remove('show'); });
    this.picker.querySelectorAll<HTMLElement>('.ws-x-target').forEach((b) => { b.addEventListener('click', () => { const t = this.targets.find((x) => x.id === b.dataset['id']); if (t) this.show(t); }); });
    this.overlay.querySelector('.ws-x-compare-close')?.addEventListener('click', () => { this.close(); });
    this.divider.addEventListener('pointerdown', (e) => { this.divider.setPointerCapture(e.pointerId); this.splitAt(e.clientX); e.preventDefault(); });
    this.divider.addEventListener('pointermove', (e) => { if (this.divider.hasPointerCapture(e.pointerId)) this.splitAt(e.clientX); });
    this.divider.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      this.split = Math.min(0.98, Math.max(0.02, this.split + (e.key === 'ArrowLeft' ? -0.05 : 0.05)));
      this.apply(); e.preventDefault();
    });
    explore.root.append(this.button, this.picker, this.overlay);
  }

  get isOpen(): boolean { return this.overlay.classList.contains('show'); }

  private togglePicker(): void {
    if (!this.picker.classList.contains('show')) {
      this.picker.querySelectorAll<HTMLElement>('.ws-x-target').forEach((b) => {
        const t = this.targets.find((x) => x.id === b.dataset['id']);
        const slot = b.querySelector<HTMLElement>('.ws-x-target-img');
        if (t && slot) slot.style.backgroundImage = `url('${t.target}')`;
      });
    }
    this.picker.classList.toggle('show');
  }

  private show(t: Target): void {
    this.current = t;
    this.picker.classList.remove('show');
    this.liveImg.src = t.live;
    this.targetImg.src = t.target;
    const name = this.overlay.querySelector('.ws-x-compare-head b');
    if (name) name.textContent = t.name;
    this.overlay.classList.add('show');
    this.explore.setCompareOpen(true);
    this.apply();
  }

  close(): void {
    this.overlay.classList.remove('show'); this.picker.classList.remove('show'); this.current = null;
    this.explore.setCompareOpen(false);
    this.liveImg.removeAttribute('src'); this.targetImg.removeAttribute('src');
  }

  private splitAt(clientX: number): void {
    const bounds = this.overlay.getBoundingClientRect();
    this.split = Math.min(0.98, Math.max(0.02, (clientX - bounds.left) / bounds.width));
    this.apply();
  }

  private apply(): void {
    const pct = `${(this.split * 100).toFixed(2)}%`;
    this.targetImg.style.clipPath = `inset(0 0 0 ${pct})`;
    this.divider.style.left = pct;
    this.divider.setAttribute('aria-valuenow', String(Math.round(this.split * 100)));
  }

  context(): Record<string, string> { return this.current ? { compare: this.current.id, mockup: this.current.file } : {}; }
}
