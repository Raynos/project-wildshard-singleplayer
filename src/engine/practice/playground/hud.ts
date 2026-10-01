import { engineString } from '#engine/strings';
/**
 * The playgrounds' one HUD chip (E307): the playground's short name, the run's time and ↺ (back to the start), then the
 * status (READY · RUNNING · a pad, a lap) and the best. On the phone it is a row of the base HUD's top-left status column
 * (hudSlots — the one way anything joins the phone HUD, E154), under VITALS and the shard's own rows, clear of the toasts
 * that hang under the minimap; on a desktop, top centre. The HUD's language (navy glass, a cyan hairline, monospace
 * capitals); styled by src/engine/ui/styles/playgrounds.css.
 *
 *   const chip = new PlaygroundChip('Grapple', () => restart());
 *   chip.show(true); chip.time(12.34, best); chip.status('RUNNING · P2', 'go')
 */
import '../../ui/styles/playgrounds.css';
import { ROW, hudSlots } from '../../ui/hudSlots';

/** 83.4 s → "01:23.4" */
export function clock(s: number): string {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`;
}

export class PlaygroundChip {
  readonly el: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly bestEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private shownTime = '';
  private shownBest = '';
  private shownStatus = '';

  constructor(name: string, onRestart: () => void) {
    const el = document.createElement('div');
    el.className = 'ws-pg';
    el.innerHTML = engineString('s_718ae7900c13');
    const q = (sel: string): HTMLElement => el.querySelector<HTMLElement>(sel) ?? el;
    q('b').textContent = name;
    this.timeEl = q('.ws-pg-time'); this.bestEl = q('.ws-pg-best'); this.statusEl = q('.ws-pg-status');
    const restart = q('.ws-pg-restart');
    // pointerup as well as click: iOS drops the synthesized click when a tap jitters (Update.ts); kept off the look pad
    let fired = 0;
    const go = (e: Event): void => { e.stopPropagation(); if (performance.now() - fired < 400) return; fired = performance.now(); onRestart(); };
    restart.addEventListener('pointerup', go);
    restart.addEventListener('click', go);
    restart.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    if (hudSlots.touch) { el.dataset['slot'] = 'row'; hudSlots.statusRow(el, ROW.grass + 1, false); } // after the shard's own rows
    else (document.getElementById('hud') ?? document.body).append(el);
    this.el = el;
  }

  show(on: boolean): void { this.el.classList.toggle('show', on); }

  /** the run's time and the best (null: none yet), written only when the shown text changes */
  time(seconds: number, best: number | null): void {
    const t = clock(seconds), b = best === null ? '' : `BEST ${clock(best)}`;
    if (t !== this.shownTime) { this.shownTime = t; this.timeEl.textContent = t; }
    if (b !== this.shownBest) { this.shownBest = b; this.bestEl.textContent = b; }
  }

  status(text: string, tone: 'rest' | 'go' | 'done' = 'rest'): void {
    const key = `${tone}:${text}`;
    if (key === this.shownStatus) return;
    this.shownStatus = key;
    this.statusEl.textContent = text;
    this.el.dataset['tone'] = tone;
  }
}
