/**
 * WaterLine — the cheap water-line effect for swimming: a DOM gradient (no render pass) that tints the bottom of the
 * view as the eye nears the surface and washes the whole view teal when it dips under (a plunge off the pier).
 *
 *   const line = new WaterLine();           // Player constructs it; the div sits under #hud so the HUD stays crisp
 *   line.update(eyeAboveSurface);           // metres; +Infinity on dry land. Every frame from Player.update()
 *
 * The underwater look proper (diving) is a separate feature; this only carries the moment the eye crosses the line.
 */
const FADE_FROM = 0.45; // m above the surface where the tint starts …
const FADE_TO = 0.12;   // … and where it is fully on

export class WaterLine {
  private el: HTMLDivElement;
  private lastA = -1; private lastUnder = false;

  constructor() {
    const el = this.el = document.createElement('div');
    el.className = 'ws-waterline';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;will-change:opacity;' +
      'background:linear-gradient(180deg, rgba(20,90,110,0) 42%, rgba(24,110,130,0.22) 62%, rgba(18,80,100,0.5) 100%);';
    const hud = document.getElementById('hud');
    if (hud?.parentNode) hud.parentNode.insertBefore(el, hud); else document.body.appendChild(el);
  }

  update(eyeAbove: number) {
    const under = eyeAbove < 0;
    if (under !== this.lastUnder) {
      this.lastUnder = under;
      this.el.style.background = under
        ? 'linear-gradient(180deg, rgba(14,70,90,0.55) 0%, rgba(10,60,80,0.7) 100%)'
        : 'linear-gradient(180deg, rgba(20,90,110,0) 42%, rgba(24,110,130,0.22) 62%, rgba(18,80,100,0.5) 100%)';
    }
    const a = under ? 1 : eyeAbove >= FADE_FROM ? 0 : Math.min(1, (FADE_FROM - eyeAbove) / (FADE_FROM - FADE_TO));
    if (Math.abs(a - this.lastA) > 0.01) { this.lastA = a; this.el.style.opacity = a.toFixed(2); }
  }
}
