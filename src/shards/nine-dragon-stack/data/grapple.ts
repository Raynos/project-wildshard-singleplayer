// The Fei Zhua's aim, line and zip view as data (SHARD-PLATFORM M3): Nine Dragon's row on the SDK grapple view
// (@wildshard/sdk/tools/grappleAim). E286 (Jake: "I can't seem to use a grappling hook … no dedicated HUD button"; his
// pick: keep the baseline HUD, make LOCK say so): every brass dragon ring in reach wears a small ◇ marker, the one nearest
// the centre the "◇ DRAGON HOOK" chip, and the touch LOCK disc turns GRAPPLE (gold, pulsing), LOCKED with ZIP on JUMP, or
// ARMED with FIRE. grapple/FeiZhua.ts hands the law (grapple/sim.ts) in.
import type { GrappleAimRow } from '@wildshard/sdk/tools/grappleAim';

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
