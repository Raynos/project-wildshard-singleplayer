/**
 * SpeedLines — radial speed streaks at the screen edges while a dash runs (E27, mockup art/hud/round-7-sword-touch/B-lunge.jpg):
 * a dodge shows them lightly, a sword lunge fully. Pure CSS (a repeating conic gradient masked to the edges, styled in
 * game.css `.ws-game-speed`); this only sets `--speed` 0..1 when it changes, so an idle frame writes nothing.
 *
 *   const speed = new SpeedLines();
 *   speed.update(dt, player.dashing, meleeLock.lunging);   // once per frame
 */
export class SpeedLines {
  private readonly el: HTMLElement;
  private level = 0; private shown = -1;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ws-game-speed';
    (document.getElementById('hud') ?? document.body).append(this.el);
  }

  update(dt: number, dashing: boolean, lunging: boolean): void {
    const target = lunging ? 1 : dashing ? 0.55 : 0;
    // snap up on a dash's first frame, ease out after it ends
    this.level = target > this.level ? target : this.level * Math.exp(-dt * 10);
    if (this.level < 0.02) this.level = 0;
    const q = Math.round(this.level * 50) / 50;
    if (q === this.shown) return;
    this.shown = q;
    this.el.style.setProperty('--speed', String(q));
  }
}
