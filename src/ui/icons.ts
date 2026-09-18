/**
 * icons — inline SVG silhouettes for the in-game menu (src/ui/Menu.ts): the animals of the achievement rows,
 * the pack items, the two weapons and a few UI glyphs. Everything is `currentColor` so the CSS sets the tint;
 * every glyph is drawn in a 64×64 box from primitives (no artwork files to load).
 *
 *   icon('deer')  → '<svg …>…</svg>'
 */
export type IconId = 'deer' | 'boar' | 'elk' | 'bear' | 'ghost' | 'ironhide' | 'meat' | 'hide' | 'tusk' | 'antlers' | 'bolt' | 'crossbow' | 'rifle' | 'laurel' | 'lock' | 'check' | 'poi' | 'you';

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

const RIFLE = `
  <path d="M4 30 L18 30 L20 26 L44 26 L44 30 L62 30 L62 33 L44 33 L44 36 L30 36 L26 44 L20 44 L22 36 L18 36 L16 40 L6 40 Z"/>
  <rect x="32" y="36" width="7" height="12" rx="1" transform="skewX(-14)"/>
  <rect x="22" y="22" width="20" height="4" rx="1"/>
  <path d="M48 26 L48 22 L50 22 L50 30" ${S} stroke-width="1.5"/>`;

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
  crossbow: CROSSBOW, rifle: RIFLE,
  laurel: LAUREL, lock: LOCK, check: CHECK, poi: POI, you: YOU,
};

export function icon(id: IconId): string {
  const body = GLYPHS[id];
  if (id === 'ghost') return wrap(`<g filter="url(#gm-ghost-glow)">${body}</g><defs><filter id="gm-ghost-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`, 'class="ghost"');
  if (id === 'ironhide') return wrap(`<g transform="translate(-4 -6) scale(1.14)">${body}<path d="M4 46 L-2 52 L5 50 Z" transform="translate(4 -4)"/></g>`);
  return wrap(body);
}
