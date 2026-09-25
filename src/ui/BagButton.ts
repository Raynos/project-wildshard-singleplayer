/**
 * BagButton — the INVENTORY button that squares out the minimap's top-right corner (E124, the user: "a button that squares out
 * the minimap … top and right straight edge, and on the minimap the button has like a reverse moon edge").
 *
 *   new BagButton(minimap.root, () => menu.open('inventory'));   // main.ts; ?bagbtn=0 builds none (and keeps the one menu)
 *
 * One SVG inside `.ws-minimap`, so it follows the minimap's size, place, intro fade and hide. Its box starts at the circle's
 * centre and runs up and right; the drawing is in units where the minimap's radius is 100:
 *   - the piece: straight top and right edges at SIDE (just past the rim's tick tips at ~111), a concave edge on the circle
 *     of radius CUT around the centre (a crescent cut-out that hugs the tick ring with a ~3 px gap), glass fill + a
 *     cyan hairline on all three edges, a brighter bracket on the outer corner;
 *   - the backpack glyph tucked into the outer corner, where the piece is widest;
 *   - an invisible hit shape: the piece grown by HIT_OUT outward (up and right, into the screen margin) and a little
 *     inward, so the target is ≥ 44 px across on a phone while a tap on the map itself still opens the MAP tab.
 * Styled by src/ui/styles/minimap.css (prefix ws-minimap-). Pressed = `.down` (the minimap's pointerdown preventDefault
 * would swallow :active on iOS).
 */

/** the straight edges (the square's half side), the concave cut's radius, the hit area's outward reach — minimap radius = 100 */
const SIDE = 113, CUT = 116, HIT_OUT = 26, HIT_IN = 8;
const f = (n: number): string => n.toFixed(2);

/** the piece's outline: top edge from the cut's tip to the corner, down the right edge, back along the cut */
function piecePath(side: number, cut: number): string {
  const tip = Math.sqrt(cut * cut - side * side); // where the cut meets each straight edge, from the centre line
  // the centre is (0, SIDE) in the SVG; the cut runs from the right tip back to the top tip, counter-clockwise on screen
  return `M${f(tip)} ${f(SIDE - side)} L${f(side)} ${f(SIDE - side)} L${f(side)} ${f(SIDE - tip)} A${f(cut)} ${f(cut)} 0 0 0 ${f(tip)} ${f(SIDE - side)} Z`;
}

/** the hit shape: out to the grown corner, in along the axes to just inside the cut */
function hitPath(): string {
  const r = CUT - HIT_IN, o = SIDE + HIT_OUT, top = SIDE - o;
  const a0 = Math.asin(Math.min(1, 40 / r)); // start the inner arc 40 units off each axis — the N label and the E tick stay the map's
  const x0 = r * Math.sin(a0), y0 = SIDE - r * Math.cos(a0), x1 = r * Math.cos(a0), y1 = SIDE - r * Math.sin(a0);
  return `M${f(x0)} ${f(top)} L${f(o)} ${f(top)} L${f(o)} ${f(y1)} L${f(x1)} ${f(y1)} A${f(r)} ${f(r)} 0 0 0 ${f(x0)} ${f(y0)} Z`;
}

/** the backpack, drawn in a 64-unit box (it spans x 12–52, y 8–56): a small grab loop, a domed body (not the padlock's
 *  box + big shackle), the curved flap seam, a front pocket */
const PACK = `
  <path class="ws-minimap-bag-loop" d="M28 18 V13 A4 4 0 0 1 36 13 V18"/>
  <path class="ws-minimap-bag-body" d="M17 56 Q12 56 12 51 V33 C12 23 20 17 32 17 C44 17 52 23 52 33 V51 Q52 56 47 56 Z"/>
  <path class="ws-minimap-bag-seam" d="M12 34 C21 39 43 39 52 34"/>
  <rect class="ws-minimap-bag-seam" x="21" y="43" width="22" height="9" rx="2.5"/>`;
/** the glyph sits in the corner, PAD in from both straight edges, GLYPH tall — the most the piece holds before its
 *  lower-left corner meets the cut (the widest part of the piece is the corner, ~23 px deep on a phone) */
const PAD = 4.5, GLYPH = 26;

export class BagButton {
  readonly root: HTMLButtonElement;

  constructor(minimap: HTMLElement, onTap: () => void) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ws-minimap-bag';
    b.setAttribute('aria-label', 'Inventory');
    b.title = 'Inventory';
    const k = GLYPH / 48, tx = SIDE - PAD - k * 52, ty = PAD - k * 8; // glyph units → piece units, its top-right on the pad
    const box = SIDE + HIT_OUT;
    const bracket = 16;
    b.innerHTML = `<svg viewBox="0 ${f(SIDE - box)} ${f(box)} ${f(box)}" aria-hidden="true">
      <path class="ws-minimap-bag-hit" d="${hitPath()}"/>
      <path class="ws-minimap-bag-piece" d="${piecePath(SIDE, CUT)}"/>
      <path class="ws-minimap-bag-corner" d="M${f(SIDE - bracket)} 0 H${f(SIDE)} V${f(bracket)}"/>
      <g class="ws-minimap-bag-icon" transform="translate(${f(tx)} ${f(ty)}) scale(${f(k)})">${PACK}</g>
    </svg>`;
    // the minimap is itself a button (Map.bindMinimap: pointerdown swallowed, pointerup opens MAP): stop ours before it
    const up = () => { b.classList.remove('down'); };
    b.addEventListener('pointerdown', () => { b.classList.add('down'); });
    b.addEventListener('pointerup', (e) => { e.stopPropagation(); up(); onTap(); });
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('click', (e) => { e.stopPropagation(); if (e.detail === 0) onTap(); }); // keyboard (Enter / Space) only
    this.root = b;
    minimap.classList.add('bag'); // the phone steps the circle in so the square clears the screen edge (minimap.css)
    minimap.append(b);
  }
}
