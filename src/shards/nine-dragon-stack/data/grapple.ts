// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** The shard’s touch-label row, structurally checked by the trusted host. */
interface TouchRelabel { label: string; icon?: string; tone?: 'rest' | 'ready' | 'active'; accent?: string }
/** Nine Dragon’s authored GrappleAimRow row shape. */
export interface GrappleAimRow {
  /** hooks whose sight (and, when stale, landing) are re-tested per frame: a round robin over the course */
  readonly scanPerFrame: number;
  /** a cached landing is re-found once the player has moved this far (m) from where it was found */
  readonly landingStale: number;
  /** the small in-reach markers on screen at once */
  readonly marks: number;
  /** the touch LOCK disc's labels (rest, a hook ready, locked, armed with no hook) and JUMP's (zip, fire) */
  readonly hints: { readonly rest: TouchRelabel; readonly ready: TouchRelabel; readonly locked: TouchRelabel; readonly zip: TouchRelabel; readonly armed: TouchRelabel; readonly fire: TouchRelabel };
  /** the candidate's chip: its class, inline style, words and colours */
  readonly chip: {
    readonly className: string; readonly style: Readonly<Record<string, string>>; readonly candidate: string; readonly lockedTouch: string; readonly lockedDesk: string;
    readonly color: string; readonly lockedColor: string;
  };
  /** an in-reach marker: its class, inline style, glyph and colour */
  readonly mark: { readonly className: string; readonly style: Readonly<Record<string, string>>; readonly glyph: string; readonly color: string };
  /** the toasts: a miss, armed with no hook and a hook locked (touch and desktop words) */
  readonly toasts: { readonly miss: string; readonly armedTouch: string; readonly armedDesk: string; readonly lockedTouch: string; readonly lockedDesk: string };
  /** where the line leaves the hand, in the camera's space (m) */
  readonly muzzle: readonly [number, number, number];
  /** the rope's slack while the claw flies, while it reels back, and on a held line */
  readonly slack: { readonly fire: number; readonly reel: number; readonly hold: number };
  /** the rope's points */
  readonly ropePoints: number;
  /** the claw's and the lock halo's colours (hex) */
  readonly claw: number;
  readonly halo: number;
  /** the flashes' colours (hex): the muzzle, the bite, the dock */
  readonly flashes: { readonly muzzle: number; readonly bite: number; readonly dock: number };
  /** the bite's sparks */
  readonly sparks: number;
  /** the prefix of every mesh name (`<prefix>:filament`, `<prefix>:flying-claw`, …) */
  readonly name: string;
  /** the tool's systems: the input, the rope's fixed step and the frame */
  readonly systems: { readonly input: string; readonly rope: string; readonly update: string };
  /** the debug name the hooks and the phase are exposed under */
  readonly debug: string;
}
// The Fei Zhua's aim, line and zip view as data (SHARD-PLATFORM M3): Nine Dragon's row on the SDK grapple view
// (@wildshard/sdk/tools/grappleAim). E286 (Jake: "I can't seem to use a grappling hook … no dedicated HUD button"; his
// pick: keep the baseline HUD, make LOCK say so): every brass dragon ring in reach wears a small ◇ marker, the one nearest
// the centre the "◇ DRAGON HOOK" chip, and the touch LOCK disc turns GRAPPLE (gold, pulsing), LOCKED with ZIP on JUMP, or
// ARMED with FIRE. grapple/FeiZhua.ts hands the law (grapple/sim.ts) in.

/** the claw on LOCK (a three-talon grapple on its line) and ZIP on JUMP (an arrow along a line) */
const CLAW_ICON = '<path d="M12 2.2v9.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="3.4" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 11.5c-3.9 0-6.6 2.5-6.9 6.6l1.9-1.3M12 11.5c3.9 0 6.6 2.5 6.9 6.6l-1.9-1.3M12 11.5v10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>';
const ZIP_ICON = '<path d="M3.5 20.5 18.5 5.5M11 5h8v8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 14.5l4-4M9.5 21l4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>';
const GOLD = '#ffcf70';

/** the Fei Zhua's presentation: two hooks re-tested a frame, a landing re-found past 1.2 m, eight markers */
export const FEI_ZHUA_AIM: GrappleAimRow = {
  scanPerFrame: 2,
  landingStale: 1.2,
  marks: 8,
  hints: {
    rest: { label: 'Lock', tone: 'rest' },
    ready: { label: 'Grapple', icon: CLAW_ICON, tone: 'ready', accent: GOLD },
    locked: { label: 'Locked', icon: CLAW_ICON, tone: 'active', accent: GOLD },
    zip: { label: 'Zip', icon: ZIP_ICON, tone: 'active', accent: GOLD },
    armed: { label: 'Armed', icon: CLAW_ICON, tone: 'ready', accent: GOLD },
    fire: { label: 'Fire', icon: ZIP_ICON, tone: 'ready', accent: GOLD },
  },
  chip: {
    className: 'ws-dragon-hook',
    style: {
      zIndex: '25', padding: '6px 9px', border: '1px solid #8fe3ff', background: '#0d1b26dd', color: '#8fe3ff',
      font: '700 10px monospace', letterSpacing: '1.5px', whiteSpace: 'nowrap',
    },
    candidate: '◇ DRAGON HOOK', lockedTouch: '◆ LOCKED · ZIP', lockedDesk: '◆ LOCKED · JUMP', color: '#8fe3ff', lockedColor: '#d7a546',
  },
  mark: {
    className: 'ws-dragon-mark',
    style: {
      zIndex: '24', font: '700 15px monospace', lineHeight: '1', color: '#8fe3ff',
      textShadow: '0 0 3px #0d1b26, 0 0 3px #0d1b26, 0 0 9px rgba(143, 227, 255, 0.75)',
    },
    glyph: '◇', color: '#8fe3ff',
  },
  toasts: {
    miss: 'FEI ZHUA MISSED · REELING', armedTouch: 'FEI ZHUA READY · FIRE TO SHOOT', armedDesk: 'FEI ZHUA READY · JUMP TO FIRE',
    lockedTouch: 'DRAGON HOOK LOCKED · ZIP TO FLY', lockedDesk: 'DRAGON HOOK LOCKED · JUMP TO ZIP',
  },
  muzzle: [-0.2, -0.23, -0.55],
  slack: { fire: 1.14, reel: 1.20, hold: 1.005 },
  ropePoints: 24,
  claw: 0xd7a546,
  halo: 0xffcc62,
  flashes: { muzzle: 0xa8f5ff, bite: 0xffc76a, dock: 0xffd891 },
  sparks: 24,
  name: 'fei-zhua',
  systems: { input: 'shard.nd.feizhua.input', rope: 'fei-zhua.rope', update: 'fei-zhua' },
  debug: 'nd.grapple',
};
