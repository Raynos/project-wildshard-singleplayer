/**
 * icons — inline SVG silhouettes for the in-game menu (src/ui/Menu.ts): the animals of the achievement rows,
 * the pack items, the weapons and a few UI glyphs. Everything is `currentColor` so the CSS sets the tint;
 * every glyph is drawn in a 64×64 box from primitives (no artwork files to load).
 *
 *   icon('deer')  → '<svg …>…</svg>'
 */
export type IconId = 'deer' | 'boar' | 'elk' | 'bear' | 'ghost' | 'ironhide' | 'meat' | 'hide' | 'tusk' | 'antlers' | 'claw' | 'shell' | 'coconut' | 'coin' | 'seaglass' | 'rope' | 'bolt' | 'crossbow' | 'sword' | 'rifle' | 'lever' | 'longbow' | 'laurel' | 'lock' | 'check' | 'poi' | 'you';

const wrap = (body: string, extra = '') => `<svg viewBox="0 0 64 64" fill="currentColor" stroke="none" ${extra}>${body}</svg>`;
const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

/* ── animals, side view facing left, feet on y≈56 ── */
const legs = (xs: number[], top: number, h: number, w = 3.2) => xs.map((x) => `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="1"/>`).join('');

const DEER = `
  <ellipse cx="37" cy="35" rx="16" ry="8.5"/>
  <path d="M25 31 L20 16 L27 15 L31 30 Z"/>
  <ellipse cx="20" cy="15" rx="6.5" ry="4"/>
  <path d="M15 13 L12 6 L17 11 Z"/>
  <path d="M25 12 L27 7 L29 12 Z"/>
  <path d="M20 12 L17 3 M20 12 L23 2 M17 3 L14 4 M18.5 7 L15 6 M23 2 L26 1 M21.5 6 L25 5" ${S} stroke-width="1.8"/>
  <path d="M52 30 L56 26 L55 31 Z"/>
  ${legs([24, 30, 43, 49], 40, 17)}`;

const ELK = `
  <ellipse cx="38" cy="36" rx="17" ry="9.5"/>
  <path d="M24 32 L18 15 L27 13 L32 30 Z"/>
  <path d="M22 26 L19 34 L26 31 Z"/>
  <ellipse cx="19" cy="14" rx="7" ry="4.5"/>
  <path d="M13 12 L9 6 L15 10 Z"/>
  <path d="M18 11 C12 8 8 3 6 -2 M18 11 C15 5 13 1 14 -3 M18 11 L24 -1 M20 5 L17 2 M22 2 L19 -1 M13 5 L9 4 M11 8 L6 8 M22 4 L25 1" ${S} stroke-width="2.2"/>
  ${legs([23, 30, 45, 52], 42, 17, 3.6)}`;

const BOAR = `
  <path d="M14 34 C12 24 24 20 36 20 C50 20 58 26 57 36 C56 44 48 46 36 46 C24 46 15 44 14 34 Z"/>
  <path d="M15 30 L6 35 L8 42 L16 42 Z"/>
  <path d="M7 40 L3 44 L6 44.5 Z"/>
  <path d="M30 20 L33 16 L36 20 Z M40 20 L43 16 L46 20 Z"/>
  <path d="M8 43.5 C9 46.5 12 47 14 45" ${S} stroke-width="2"/>
  <path d="M57 30 L61 26 L60 33 Z"/>
  ${legs([18, 25, 41, 48], 43, 14, 3.4)}`;

const BEAR = `
  <path d="M8 30 C6 24 10 20 16 20 L20 20 C24 14 34 12 44 14 C54 16 60 24 58 34 C57 42 52 46 44 46 L20 46 C12 46 8 40 8 30 Z"/>
  <path d="M10 22 C6 22 4 26 5 30 C7 33 12 33 14 30 L20 30 L20 36 C16 40 10 38 8 34 Z"/>
  <path d="M4 32 L1 36 L5 36.5 Z"/>
  <circle cx="14" cy="18" r="3.2"/><circle cx="21" cy="15" r="3"/>
  ${legs([16, 24, 40, 48], 44, 13, 5.2)}`;

/* ── items ── */
const MEAT = `
  <path d="M12 34 C10 22 22 14 36 16 C50 18 56 28 52 40 C48 50 32 52 22 48 C14 45 13 40 12 34 Z"/>
  <path d="M22 30 C24 26 30 26 34 30 C38 34 38 40 34 42" ${S} stroke-width="3" opacity="0.45"/>
  <path d="M44 20 L54 10 M50 8 L56 14" ${S} stroke-width="4"/>`;

const HIDE = `
  <path d="M10 14 C16 18 20 16 22 12 L26 20 C30 18 34 18 38 20 L42 12 C44 16 48 18 54 14 C50 22 50 28 52 34 C50 40 52 46 56 52 C50 50 46 50 42 54 L38 46 C34 48 30 48 26 46 L22 54 C18 50 14 50 8 52 C12 46 14 40 12 34 C14 28 14 22 10 14 Z"/>`;

const TUSK = `
  <path d="M14 52 C10 36 18 18 34 10 C40 7 48 8 52 12 C42 14 30 24 26 38 C24 46 20 52 14 52 Z"/>`;

const ANTLERS = `
  <path d="M32 58 L32 30 M32 30 C22 28 14 20 12 8 M32 30 C42 28 50 20 52 8 M22 26 L16 18 M42 26 L48 18 M18 16 L10 14 M46 16 L54 14 M27 29 L24 36 M37 29 L40 36" ${S} stroke-width="3.5"/>`;

/* Driftwood Isle loot: crab claw, reef shell, coconut, doubloon, sea glass, old rope */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

const CLAW = `
  <path d="M6 58 L20 42 L26 48 L10 62 Z"/>
  <ellipse cx="30" cy="37" rx="15" ry="11" transform="rotate(-40 30 37)"/>
  <path d="M26 28 C30 14 42 5 56 5 C50 11 44 18 40 30 Z"/>
  <path d="M40 42 C48 38 56 30 60 18 C62 32 54 44 42 48 Z"/>`;

const SHELL = `
  <path d="M6 36 C8 24 19 18 32 18 C45 18 56 24 58 36 C56 46 46 52 32 52 C18 52 8 46 6 36 Z"/>
  <path d="M8 32 L1 28 L7 38 Z M56 32 L63 28 L57 38 Z M12 24 L8 16 L17 21 Z M52 24 L56 16 L47 21 Z M20 50 L16 58 L25 52 Z M44 50 L48 58 L39 52 Z"/>
  <path d="M25 18 L24 11 M39 18 L40 11" ${S} stroke-width="2.4"/>
  <circle cx="24" cy="10" r="3"/><circle cx="40" cy="10" r="3"/>`;

const COCONUT = `
  <path fill-rule="evenodd" d="${circle(32, 36, 22)} ${circle(25, 28, 3)} ${circle(37, 26, 3)} ${circle(31, 37, 3)}"/>
  <path d="M28 14 L24 6 M32 14 L32 4 M36 14 L40 6" ${S} stroke-width="2.4"/>`;

const COIN = `
  <path fill-rule="evenodd" d="M32 8 C46 7 57 18 56 32 C57 46 46 57 32 56 C18 57 7 46 8 32 C7 18 18 7 32 8 Z ${circle(32, 32, 18)} ${circle(32, 32, 15)} M29 20 H35 V29 H44 V35 H35 V44 H29 V35 H20 V29 H29 Z"/>`;

const SEAGLASS = `
  <path fill-rule="evenodd" d="M8 38 L16 20 L34 12 L50 20 L52 38 L38 50 L18 50 Z M20 24 L30 19 L25 30 Z"/>
  <path d="M42 50 L50 42 L60 46 L58 56 L48 58 Z"/>`;

const ROPE = `
  <path d="M28 32 A4 4 0 0 1 36 32 A8 8 0 0 1 20 32 A12 12 0 0 1 44 32 A16 16 0 0 1 12 32 A20 20 0 0 1 52 32 C52 42 56 50 60 56" ${S} stroke-width="4.2"/>
  <path d="M58 54 L62 60 M60 52 L64 57" ${S} stroke-width="1.8"/>`;

const BOLT = `
  <path d="M8 56 L52 12" ${S} stroke-width="3.5"/>
  <path d="M52 12 L58 6 L54 16 Z"/>
  <path d="M10 46 L18 52 M14 42 L22 48 M6 50 L14 56" ${S} stroke-width="2.5"/>`;

/* ── weapons, side profile ── */
const CROSSBOW = `
  <path d="M6 38 L46 26 L58 26 L58 32 L48 34 L10 44 Z"/>
  <path d="M40 22 C44 8 52 4 60 6 M40 34 C44 48 52 52 60 50" ${S} stroke-width="3.5"/>
  <path d="M60 6 L46 28 L60 50" ${S} stroke-width="1.4"/>
  <path d="M8 44 L6 52 L11 52 L13 44 Z"/>
  <rect x="26" y="26" width="30" height="3" rx="1"/>`;

/* straight arming sword, point up-right like the bolt: pommel · wrapped grip · crossguard · fullered blade */
const SWORD = `
  <g transform="rotate(-45 32 32) translate(32 32) scale(1.12) translate(-32 -32)">
    <circle cx="5" cy="32" r="4.2"/>
    <rect x="8" y="29" width="11" height="6" rx="1.4"/>
    <path d="M18 21 L23.5 23 L23.5 41 L18 43 Z"/>
    <path fill-rule="evenodd" d="M23.5 27.5 L52 27.5 L61.5 32 L52 36.5 L23.5 36.5 Z M27 31 L49 31 L49 33 L27 33 Z"/>
  </g>`;

const RIFLE = `
  <path d="M4 30 L18 30 L20 26 L44 26 L44 30 L62 30 L62 33 L44 33 L44 36 L30 36 L26 44 L20 44 L22 36 L18 36 L16 40 L6 40 Z"/>
  <rect x="32" y="36" width="7" height="12" rx="1" transform="skewX(-14)"/>
  <rect x="22" y="22" width="20" height="4" rx="1"/>
  <path d="M48 26 L48 22 L50 22 L50 30" ${S} stroke-width="1.5"/>`;

/* Pine Hollow's lever-action (PH-C11): a straight-grip stock, the receiver, the barrel over its magazine tube, the loop lever */
const LEVER = `
  <path d="M3 35 L9 30 L21 30 L23 28 L34 28 L34 30 L62 30 L62 32.6 L34 32.6 L34 34.6 L58 34.6 L58 36.8 L34 36.8 L30 38 L21 38 L11 44 L3 44 Z"/>
  <path d="M25 38 C24 46 35 46 33 37.6" ${S} stroke-width="2.4"/>
  <rect x="55" y="27.4" width="1.8" height="3"/>`;
/* the Warden's Longbow (PH-C11): a tall stave, its string, an arrow on it */
const LONGBOW = `
  <path d="M16 5 C42 16 42 48 16 59" ${S} stroke-width="4.2"/>
  <path d="M16 5 L16 59" ${S} stroke-width="1.2"/>
  <path d="M9 32 L55 32" ${S} stroke-width="2.2"/>
  <path d="M53 27.5 L61 32 L53 36.5 Z"/>
  <path d="M10 32 L5 27.5 M10 32 L5 36.5 M14 32 L9 27.5 M14 32 L9 36.5" ${S} stroke-width="1.6"/>`;

/* ── glyphs ── */
const LAUREL = `
  <path d="M18 14 C6 24 8 44 20 54 M46 14 C58 24 56 44 44 54" ${S} stroke-width="2.4"/>
  <path d="M12 26 C8 30 8 34 12 36 C16 32 16 28 12 26 Z M10 36 C6 40 8 46 12 46 C16 42 14 38 10 36 Z M16 46 C14 52 18 56 22 54 C22 50 20 46 16 46 Z M52 26 C56 30 56 34 52 36 C48 32 48 28 52 26 Z M54 36 C58 40 56 46 52 46 C48 42 50 38 54 36 Z M48 46 C50 52 46 56 42 54 C42 50 44 46 48 46 Z"/>
  <path d="M32 18 L36 27 L46 28 L38 34 L41 44 L32 39 L23 44 L26 34 L18 28 L28 27 Z"/>`;

const LOCK = `
  <rect x="16" y="28" width="32" height="26" rx="3"/>
  <path d="M22 28 V20 A10 10 0 0 1 42 20 V28" ${S} stroke-width="5"/>`;

const CHECK = `<path d="M12 34 L26 48 L54 18" ${S} stroke-width="7"/>`;
const POI = `<circle cx="32" cy="32" r="12"/>`;
const YOU = `<path d="M32 8 L50 52 L32 42 L14 52 Z"/>`;

const GLYPHS: Record<IconId, string> = {
  deer: DEER, elk: ELK, boar: BOAR, bear: BEAR,
  ghost: DEER, ironhide: BOAR,
  meat: MEAT, hide: HIDE, tusk: TUSK, antlers: ANTLERS, bolt: BOLT,
  claw: CLAW, shell: SHELL, coconut: COCONUT, coin: COIN, seaglass: SEAGLASS, rope: ROPE,
  crossbow: CROSSBOW, sword: SWORD, rifle: RIFLE, lever: LEVER, longbow: LONGBOW,
  laurel: LAUREL, lock: LOCK, check: CHECK, poi: POI, you: YOU,
};

export function icon(id: IconId): string {
  const body = GLYPHS[id];
  if (id === 'ghost') return wrap(`<g filter="url(#gm-ghost-glow)">${body}</g><defs><filter id="gm-ghost-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`, 'class="ghost"');
  if (id === 'ironhide') return wrap(`<g transform="translate(-4 -6) scale(1.14)">${body}<path d="M4 46 L-2 52 L5 50 Z" transform="translate(4 -4)"/></g>`);
  return wrap(body);
}
