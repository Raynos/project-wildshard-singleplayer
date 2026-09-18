/**
 * TEMPORARY debug pill (next to the frame meter, top-right). The game is a home-screen PWA, so
 * knobs live here instead of URL params and persist in localStorage. Delete this file and its
 * `new Debug()` line when the black-screen / LPM investigation is over.
 *
 *   loop     rAF | timer(16 ms)      Game.start reads `dbg.loop` each frame (live switch)
 *   tier     phone | desktop         src/core/tier.ts reads `dbg.tier` at boot (needs reload)
 *   meter    on | off                the frame meter
 *   rdbg     on | off                the resume debug modal
 *   dpr      auto | 1 | 1.25 | 1.5   render scale on the phone (reload)
 *   aa       auto | on | off        SMAA (reload)
 *   keep     on | off                silent looping <audio> (does iOS keep an audio-playing PWA warm across a switch?)
 *   reload                           cache-busting reload (same as the build pill)
 */
export interface DebugFlags { loop: 'raf' | 'timer'; tier: 'auto' | 'phone' | 'desktop'; meter: boolean; rdbg: boolean; keepalive: boolean; dpr: 'auto' | '1' | '1.25' | '1.5'; aa: 'auto' | 'on' | 'off' }
const KEY = 'ws.debug';
const DEFAULTS: DebugFlags = { loop: 'raf', tier: 'auto', meter: true, rdbg: true, keepalive: false, dpr: 'auto', aa: 'auto' };

export function readDebugFlags(): DebugFlags {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DebugFlags>) }; } catch { return { ...DEFAULTS }; }
}
export const dbg: DebugFlags = readDebugFlags();
function save() { try { localStorage.setItem(KEY, JSON.stringify(dbg)); } catch { /* private mode */ } }

export class Debug {
  private panel?: HTMLElement;
  constructor(private onChange: (f: DebugFlags) => void) {
    const pill = document.createElement('button');
    pill.type = 'button'; pill.textContent = 'DBG';
    Object.assign(pill.style, { position: 'fixed', right: '12px', top: 'max(22px, calc(env(safe-area-inset-top, 0px) - 4px))', zIndex: '9998', padding: '3px 7px', font: '700 9px/1 Rajdhani, sans-serif', letterSpacing: '0.2em', color: '#ff7a6b', background: 'rgba(6,10,18,0.7)', border: '1px solid #ff7a6b', pointerEvents: 'auto' } as CSSStyleDeclaration);
    pill.onclick = () => (this.panel ? this.close() : this.open());
    document.body.appendChild(pill);
  }
  private close() { this.panel?.remove(); this.panel = undefined; }
  private open() {
    const p = document.createElement('div');
    Object.assign(p.style, { position: 'fixed', right: '12px', top: 'calc(40px + env(safe-area-inset-top, 0px))', zIndex: '9998', background: 'rgba(6,10,18,0.96)', border: '1px solid #ff7a6b', color: '#fff', font: '12px/1.6 JetBrains Mono, Menlo, monospace', padding: '10px 12px', pointerEvents: 'auto', minWidth: '220px' } as CSSStyleDeclaration);
    const row = (label: string, options: string[], current: string, set: (v: string) => void, note = '') => {
      const r = document.createElement('div'); r.style.margin = '4px 0';
      r.append(Object.assign(document.createElement('span'), { textContent: `${label.padEnd(6)} ` }));
      for (const o of options) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = o;
        Object.assign(b.style, { margin: '0 3px', padding: '6px 10px', font: '700 12px Rajdhani, sans-serif', letterSpacing: '0.1em', background: o === current ? '#8fe3ff' : 'rgba(255,255,255,0.08)', color: o === current ? '#000' : '#fff', border: '1px solid rgba(143,227,255,0.4)' } as CSSStyleDeclaration);
        b.onclick = () => { set(o); save(); this.onChange(dbg); this.close(); this.open(); };
        r.appendChild(b);
      }
      if (note) r.append(Object.assign(document.createElement('span'), { textContent: ` ${note}`, style: 'color:#8fa;opacity:.7;font-size:10px' }));
      p.appendChild(r);
    };
    row('loop', ['raf', 'timer'], dbg.loop, (v) => { dbg.loop = v as DebugFlags['loop']; });
    row('tier', ['auto', 'phone', 'desktop'], dbg.tier, (v) => { dbg.tier = v as DebugFlags['tier']; }, 'reload');
    row('dpr', ['auto', '1', '1.25', '1.5'], dbg.dpr, (v) => { dbg.dpr = v as DebugFlags['dpr']; }, 'reload · sharpness vs fps');
    row('aa', ['auto', 'on', 'off'], dbg.aa, (v) => { dbg.aa = v as DebugFlags['aa']; }, 'reload · SMAA');
    row('meter', ['on', 'off'], dbg.meter ? 'on' : 'off', (v) => { dbg.meter = v === 'on'; });
    row('rdbg', ['on', 'off'], dbg.rdbg ? 'on' : 'off', (v) => { dbg.rdbg = v === 'on'; });
    row('keep', ['on', 'off'], dbg.keepalive ? 'on' : 'off', (v) => { dbg.keepalive = v === 'on'; }, 'silent audio: iOS keeps us warm?');
    const reload = document.createElement('button'); reload.type = 'button'; reload.textContent = 'RELOAD';
    Object.assign(reload.style, { display: 'block', marginTop: '8px', padding: '8px 14px', font: '700 13px Rajdhani, sans-serif', letterSpacing: '0.2em', background: '#ff7a6b', color: '#000', border: '0' } as CSSStyleDeclaration);
    reload.onclick = () => { const u = new URL(location.href); u.searchParams.set('v', Date.now().toString(36)); location.replace(u.toString()); };
    p.appendChild(reload);
    document.body.appendChild(p);
    this.panel = p;
  }
}
