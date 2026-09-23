import './styles/boss.css';

/**
 * BossBar — the boss system's screen pieces (src/game/Boss.ts drives them), styled by `src/ui/styles/boss.css`
 * (prefix `ws-boss-`). The look is the round-2 boss mockups' (art/nalati-grasslands/round-2/5-bosses/boss-1…4): antique
 * gold on dark, engraved serif capitals — deliberately NOT the cyan Wildshard glass, because a boss owns the screen.
 *
 *   const ui = new BossBar();                                   // mounts into #hud (or <body>)
 *   ui.showBar('THE GOLDEN KING', [0.6, 0.3]);                   // the wide top bar, notches at the phase thresholds
 *   ui.setHp(0.82);  ui.setShield(true);  ui.setPhase(1, 'PHASE II');   // fill (a pale "damage lag" trails it), gold shimmer, caption
 *   ui.hideBar();
 *   ui.showNameCard('THE GOLDEN KING', 'LORD OF THE GREAT KURGAN');     // the intro: letterbox bands + the engraved name card
 *   ui.setSkip(0.4);  ui.hideNameCard();                        // HOLD TO SKIP progress (0..1)
 *   ui.showRetry('THE KING ENDURES', 2);                         // "attempt 2" — fades by itself
 *   ui.showReward('LEGENDARY', 'THE GOLDEN BOW', 'Bow of the Saka King');  ui.hideReward();
 *   ui.fade(true, 250) / ui.fade(false, 350)                    // the black the dungeon doors pass through
 *
 * Everything is pre-built once and toggled with classes (no layout work per frame): `setHp` writes one transform.
 */

const EMBLEM = `<svg viewBox="0 0 64 40" aria-hidden="true"><defs><linearGradient id="bossgold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset="0.5" stop-color="#e7b44a"/><stop offset="1" stop-color="#8a5a16"/></linearGradient></defs>
<path fill="url(#bossgold)" d="M4 21c4-6 10-8 17-7l8-1c3-4 7-7 11-8l4-3-.5 4 5 2 2 4h-4l-2-1c-2 3-4 6-5 9 3 2 8 2 13 0l5 2-6 3c-5 2-10 2-14 1l2 9-3 1-3-9H22l-4 9-3-1 2-9c-5 0-9-2-13-6z"/>
<path fill="url(#bossgold)" d="M40 5c2-3 6-4 9-3-3 0-6 2-7 4zm3 1c3-2 7-2 10 0-3-1-6 0-8 1z"/></svg>`;

export class BossBar {
  readonly root: HTMLElement;
  private bar: HTMLElement; private barName: HTMLElement; private fill: HTMLElement; private lag: HTMLElement; private caption: HTMLElement;
  private notches: HTMLElement;
  private card: HTMLElement; private cardName: HTMLElement; private cardTitle: HTMLElement; private skip: HTMLElement;
  private retry: HTMLElement; private retryTitle: HTMLElement; private retryAttempt: HTMLElement;
  private reward: HTMLElement; private rewardTier: HTMLElement; private rewardName: HTMLElement; private rewardFlavour: HTMLElement;
  private black: HTMLElement;
  private hp = 1; private lagHp = 1; private lagT = 0;
  private retryTimer = 0; private captionTimer = 0;

  constructor(parent: HTMLElement = document.getElementById('hud') ?? document.body) {
    const el = (tag: string, cls: string, html = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
    this.root = el('div', 'ws-boss');
    // ── the bar ──
    this.bar = el('div', 'ws-boss-bar');
    this.barName = el('div', 'ws-boss-bar-name');
    const frame = el('div', 'ws-boss-bar-frame');
    const track = el('div', 'ws-boss-bar-track');
    this.lag = el('div', 'ws-boss-bar-lag');
    this.fill = el('div', 'ws-boss-bar-fill');
    const shimmer = el('div', 'ws-boss-bar-shimmer');
    this.notches = el('div', 'ws-boss-bar-notches');
    track.append(this.lag, this.fill, shimmer, this.notches);
    frame.append(el('span', 'ws-boss-bar-cap l', EMBLEM), track, el('span', 'ws-boss-bar-cap r', EMBLEM));
    this.caption = el('div', 'ws-boss-bar-caption');
    this.bar.append(this.barName, frame, this.caption);
    // ── the name card (+ letterbox) ──
    this.card = el('div', 'ws-boss-card');
    const inner = el('div', 'ws-boss-card-inner');
    this.cardName = el('div', 'ws-boss-card-name');
    this.cardTitle = el('div', 'ws-boss-card-title');
    inner.append(el('div', 'ws-boss-card-emblem', EMBLEM), el('div', 'ws-boss-card-rule'), this.cardName, this.cardTitle);
    this.skip = el('div', 'ws-boss-card-skip', '<i></i>HOLD TO SKIP');
    this.card.append(el('div', 'ws-boss-card-band top'), el('div', 'ws-boss-card-band bottom'), inner, this.skip);
    // ── the retry card ──
    this.retry = el('div', 'ws-boss-retry');
    this.retryTitle = el('div', 'ws-boss-retry-title');
    this.retryAttempt = el('div', 'ws-boss-retry-attempt');
    this.retry.append(this.retryTitle, el('div', 'ws-boss-card-rule'), this.retryAttempt);
    // ── the legendary reward card ──
    this.reward = el('div', 'ws-boss-reward');
    this.rewardTier = el('div', 'ws-boss-reward-tier');
    this.rewardName = el('div', 'ws-boss-reward-name');
    this.rewardFlavour = el('div', 'ws-boss-reward-flavour');
    this.reward.append(el('i', 'ws-boss-reward-gem'), this.rewardTier, this.rewardName, el('div', 'ws-boss-reward-rule'), this.rewardFlavour);
    this.black = el('div', 'ws-boss-fade');
    this.root.append(this.bar, this.card, this.retry, this.reward, this.black);
    parent.append(this.root);
  }

  // ── the bar ──
  showBar(name: string, notchesAt: number[]): void {
    this.barName.textContent = name;
    this.notches.replaceChildren(...notchesAt.map((f) => { const n = document.createElement('i'); n.style.left = `${(f * 100).toFixed(2)}%`; return n; }));
    this.hp = this.lagHp = 1; this.write();
    this.bar.classList.add('show');
  }
  hideBar(): void { this.bar.classList.remove('show', 'shield'); }
  get barShown(): boolean { return this.bar.classList.contains('show'); }
  setHp(frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - this.hp) < 1e-4) return;
    if (f < this.hp) this.lagT = 0.55;                 // the pale lag holds, then drains after the hit
    this.hp = f;
    if (f > this.lagHp) this.lagHp = f;
    this.write();
  }
  setShield(on: boolean): void { this.bar.classList.toggle('shield', on); }
  /** show a caption under the bar ("PHASE II", "ENRAGED") for `seconds` (0 = keep) */
  setPhase(_index: number, caption: string, seconds = 4): void {
    this.caption.textContent = caption;
    this.caption.classList.add('show');
    this.captionTimer = seconds;
    this.bar.classList.remove('flash'); void this.bar.offsetWidth; this.bar.classList.add('flash');
  }
  private write(): void {
    this.fill.style.transform = `scaleX(${this.hp.toFixed(4)})`;
    this.lag.style.transform = `scaleX(${this.lagHp.toFixed(4)})`;
  }

  // ── the name card ──
  showNameCard(name: string, title: string, short = false): void {
    this.cardName.textContent = name; this.cardTitle.textContent = title;
    this.card.classList.toggle('short', short);
    this.setSkip(0);
    this.card.classList.add('show');
  }
  hideNameCard(): void { this.card.classList.remove('show'); }
  setSkip(p: number): void { this.skip.style.setProperty('--p', `${Math.round(Math.max(0, Math.min(1, p)) * 360)}deg`); }

  // ── retry / reward ──
  showRetry(title: string, attempt: number): void {
    this.retryTitle.textContent = title; this.retryAttempt.textContent = `ATTEMPT ${attempt}`;
    this.retry.classList.add('show'); this.retryTimer = 2.6;
  }
  showReward(tier: string, name: string, flavour: string): void {
    this.rewardTier.textContent = tier; this.rewardName.textContent = name; this.rewardFlavour.textContent = flavour;
    this.reward.classList.add('show');
  }
  hideReward(): void { this.reward.classList.remove('show'); }

  fade(on: boolean, ms = 300): void {
    this.black.style.transitionDuration = `${ms}ms`;
    this.black.classList.toggle('show', on);
  }

  update(dt: number): void {
    if (this.lagT > 0) this.lagT -= dt;
    else if (this.lagHp > this.hp) { this.lagHp = Math.max(this.hp, this.lagHp - dt * 0.35); this.lag.style.transform = `scaleX(${this.lagHp.toFixed(4)})`; }
    if (this.retryTimer > 0) { this.retryTimer -= dt; if (this.retryTimer <= 0) this.retry.classList.remove('show'); }
    if (this.captionTimer > 0) { this.captionTimer -= dt; if (this.captionTimer <= 0) this.caption.classList.remove('show'); }
  }
}
