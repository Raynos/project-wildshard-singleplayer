/**
 * The Bag's GEAR and FINDS panels (E314 L5, Jake's picks: board 6 C, a paper doll; board 7 B, a sticker book). One
 * shared implementation for every shard: src/ui/Menu.ts calls these renderers with what the shard has, and a part the
 * shard doesn't have is simply not drawn. Styled by src/ui/styles/gmenu.css (the `ws-gmenu-doll*`, `ws-gmenu-kit*`,
 * `ws-gmenu-finds*` rules).
 *
 *   renderGear(panel, { weapons, skins, loot, onEquip, onWearSkin, onWear })
 *     weapons: the kit (held one first) — the held weapon sits at the figure's hand, the others round it; tap to hold
 *     skins:   the shard's wearable skins — Nalati's SKINS row under the figure; Pine Hollow's FINISHES (every crossbow /
 *              lever-action finish, the unowned ones dim with where they come from; `skinsTitle`, E314 C)
 *     loot:    Driftwood's (src/game/loot/install.ts): sharpening pips on the swords, HEALTH + its heart pips, the charm
 *              slot, the COSMETICS group (captain's hat, sailcloth cape: dim until owned, tap to wear / take off) and the
 *              PURSE. Absent on the other shards.
 *   renderFinds(panel, view)
 *     view: counters (SEA GLASS n/15 · PLACES n/9 · GLYPH SHARDS n/3), the next-charm line, sticker sections (TROPHIES,
 *           TREASURES: found bright, missing dashed "???"), and the 15 sea glass chips — Driftwood's (src/game/loot/finds.ts).
 *           Pine Hollow's is its hunter's journal (src/ui/compendium/finds.ts, E314 C): BEASTS / ELITES / PLACES /
 *           TROPHIES, no glass, an OPEN row on top and every sticker a tap onto its journal page.
 */
import { icon, type IconId } from './icons';
import type { KitEntry, SkinRow } from './Menu';

/** a shard's loot on GEAR (Driftwood); every part optional */
export interface GearLoot {
  /** whetstones owned, 0…2: pips on every sword */
  sharpen?: number;
  /** max health and the sturdy hearts owned (of 2) */
  health?: { max: number; hearts: number };
  /** sea glass charms strung (of 3); `next` = the sea glass count the next one needs */
  charms?: { owned: number; next: number | null };
  cosmetics?: CosmeticSlot[];
  /** the purse */
  coins?: number;
}
export interface CosmeticSlot { id: string; name: string; icon: IconId; owned: boolean; worn: boolean; /** how to get it, while locked */ how: string }

export interface FindsView {
  counters: { label: string; n: number; of: number }[];
  /** "Next charm at 10" — null once every charm is strung */
  next: string | null;
  /** `dense`: four to a row (Pine Hollow's 18 places); an item with an `id` is a button when the view has `onPick` */
  sections: { title: string; dense?: boolean; items: { id?: string; label: string; icon: IconId; found: boolean }[] }[];
  /** the beach's sea glass, one chip per piece (none: no SEA GLASS section) */
  glass: { found: boolean; color: string }[];
  /** a row over the stickers that opens the full book (Pine Hollow's hunter's journal) */
  open?: { title: string; sub: string; onPick: () => void };
  /** a sticker tapped (its journal page) */
  onPick?: (id: string) => void;
  /** the menu's hint line on this tab (default: found = bright · missing = dashed) */
  hint?: string;
}

const el = (cls: string, html = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const ROMAN = ['', 'I', 'II', 'III'];
const pips = (n: number, of: number): string => `<span class="ws-gmenu-pips">${'<i class="on"></i>'.repeat(Math.min(n, of))}${'<i></i>'.repeat(Math.max(0, of - n))}</span>`;

/** the figure the kit is laid out round: a faceted outline; the worn hat / cape are drawn on it */
function figure(hat: boolean, cape: boolean): string {
  return `<svg class="ws-gmenu-figure${hat ? ' hat' : ''}${cape ? ' cape' : ''}" viewBox="0 0 120 250" aria-hidden="true">
    <path class="ws-gmenu-fig-cape" d="M36 60 L84 60 L100 204 L78 198 L60 212 L42 198 L20 204 Z"/>
    <path class="ws-gmenu-fig-body" d="M60 16 C69 16 74 23 74 32 C74 42 68 49 60 49 C52 49 46 42 46 32 C46 23 51 16 60 16 Z
      M54 49 L66 49 L66 56 L82 58 L92 66 L100 118 L106 134 L98 138 L90 122 L84 88 L82 128 L84 136 L80 238 L64 240 L61 146 L59 146 L56 240 L40 238 L36 136 L38 128 L36 88 L30 122 L22 138 L14 134 L20 118 L28 66 L38 58 L54 56 Z"/>
    <path class="ws-gmenu-fig-line" d="M38 118 L82 118 M60 58 L60 116 M42 70 L60 96 L78 70"/>
    <path class="ws-gmenu-fig-hat" d="M47 20 C48 8 72 8 73 20 Z M32 14 C40 22 50 24 60 24 C70 24 80 22 88 14 C86 24 78 30 60 30 C42 30 34 24 32 14 Z"/>
  </svg>`;
}

export interface GearOpts {
  weapons: KitEntry[];
  skins: SkinRow[];
  /** the skins row's heading: SKINS (Nalati), FINISHES (Pine Hollow) */
  skinsTitle?: string;
  loot: GearLoot | null;
  onEquip: (id: string) => void;
  onWearSkin: (id: string) => void;
  onWear: (id: string) => void;
}

export function renderGear(p: HTMLElement, o: GearOpts): void {
  p.replaceChildren();
  const loot = o.loot;
  const held = o.weapons.find((w) => w.equipped) ?? o.weapons[0];
  const carried = o.weapons.filter((w) => w !== held);

  const weaponSlot = (w: KitEntry, side: 'l' | 'r'): HTMLElement => {
    const sword = w.icon === 'sword';
    const sub = sword && loot?.sharpen !== undefined
      ? `<span class="ws-gmenu-kitsub">${loot.sharpen > 0 ? `Sharpened ${ROMAN[loot.sharpen] ?? ''}` : 'Not sharpened'}</span>${pips(loot.sharpen, 2)}`
      : w.ammoLabel ? `<span class="ws-gmenu-kitsub">${esc(w.ammoLabel)} · ${w.ammo} / ${w.magazine}${w.reserve ? ` + ${w.reserve}` : ''}</span>` : '<span class="ws-gmenu-kitsub">Melee</span>';
    const b = el(`ws-gmenu-kit ${side} weapon${w.equipped ? ' held' : ''}`, `
      <i class="ws-gmenu-kiticon">${icon(w.icon)}</i>
      <span class="ws-gmenu-kitname">${esc(w.name)}</span>${sub}
      <span class="ws-gmenu-chip">${w.equipped ? 'Held' : 'Hold'}</span>`, 'button') as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', () => { if (!w.equipped) o.onEquip(w.id); });
    return b;
  };
  const slot = (side: 'l' | 'r', cls: string, ic: IconId, name: string, sub: string, locked = false): HTMLElement =>
    el(`ws-gmenu-kit ${side} ${cls}${locked ? ' locked' : ''}`, `<i class="ws-gmenu-kiticon">${icon(ic)}</i><span class="ws-gmenu-kitname">${esc(name)}</span>${sub}`);

  const doll = el('ws-gmenu-doll');
  const left = el('ws-gmenu-dollcol l'), right = el('ws-gmenu-dollcol r');
  const wornHat = loot?.cosmetics?.some((c) => c.id === 'captain-hat' && c.worn) === true;
  const wornCape = loot?.cosmetics?.some((c) => c.id === 'cape' && c.worn) === true;
  const fig = el('ws-gmenu-dollfig', figure(wornHat, wornCape));
  // the figure's head: max health over it (Driftwood)
  if (loot?.health) {
    const h = loot.health;
    const top = slot('r', 'health', 'heart', `Health ${h.max}`, `<span class="ws-gmenu-kitsub">Sturdy hearts</span>${pips(h.hearts, 2)}`);
    top.classList.remove('r'); top.classList.add('top');
    doll.append(top);
  }
  // left: the weapons you carry (tap to hold); right: the charm at the chest, the held weapon at the hand
  for (const w of carried) left.append(weaponSlot(w, 'l'));
  if (loot?.charms) {
    const c = loot.charms;
    right.append(c.owned > 0
      ? slot('r', 'charm', 'charm', `Sea glass charm ${ROMAN[c.owned] ?? ''}`, pips(c.owned, 3))
      : slot('r', 'charm', 'charm', 'Charm', `<span class="ws-gmenu-kitsub">${c.next !== null ? `${c.next} sea glass` : 'Sea glass'}</span>`, true));
  }
  if (held) right.append(weaponSlot(held, 'r'));
  doll.append(left, fig, right);
  doll.classList.toggle('head', loot?.health !== undefined);
  p.append(doll);

  // cosmetics (Driftwood): the captain's hat, the sailcloth cape — worn / taken off here
  const cos = loot?.cosmetics ?? [];
  if (cos.length > 0) {
    p.append(el('ws-gmenu-label', 'Cosmetics'));
    const row = el('ws-gmenu-kitrow');
    for (const c of cos) {
      const b = el(`ws-gmenu-kit cosmetic${c.owned ? '' : ' locked'}${c.worn ? ' held' : ''}`, `
        <i class="ws-gmenu-kiticon">${icon(c.icon)}</i>
        <span class="ws-gmenu-kitname">${esc(c.name)}</span>
        ${c.owned ? `<span class="ws-gmenu-chip">${c.worn ? 'Worn' : 'Wear'}</span>` : `<span class="ws-gmenu-kitsub">${esc(c.how)}</span>`}`, 'button') as HTMLButtonElement;
      b.type = 'button'; b.disabled = !c.owned;
      b.addEventListener('click', () => { if (c.owned) o.onWear(c.id); });
      row.append(b);
    }
    p.append(row);
  }
  // the shard's wearable skins (Nalati, B15) / finishes (Pine Hollow, E314 C: the unowned ones dim, where they come from)
  if (o.skins.length > 0) {
    p.append(el('ws-gmenu-label', esc(o.skinsTitle ?? 'Skins')));
    const row = el('ws-gmenu-kitrow');
    for (const s of o.skins) {
      const locked = s.locked === true;
      const b = el(`ws-gmenu-kit cosmetic${s.worn ? ' held' : ''}${locked ? ' locked' : ''}`, `
        <i class="ws-gmenu-kiticon">${icon(locked ? 'lock' : s.icon ?? 'laurel')}</i>
        <span class="ws-gmenu-kitname">${esc(s.name)}</span>
        <span class="ws-gmenu-kitsub">${esc(s.blurb)}</span>
        ${locked ? '' : `<span class="ws-gmenu-chip">${s.worn ? 'Worn' : 'Wear'}</span>`}`, 'button') as HTMLButtonElement;
      b.type = 'button'; b.disabled = locked;
      b.addEventListener('click', () => { if (!locked) o.onWearSkin(s.id); });
      row.append(b);
    }
    p.append(row);
  }
  // the purse (Driftwood)
  if (loot?.coins !== undefined) {
    p.append(el('ws-gmenu-purse', `<i class="ws-gmenu-kiticon">${icon('coin')}</i><span class="ws-gmenu-kitname">Purse</span><b class="ws-gmenu-pursenum">${loot.coins}</b>`));
  }
}

export function renderFinds(p: HTMLElement, v: FindsView): void {
  p.replaceChildren();
  if (v.open) {
    const o = v.open;
    const row = el('ws-gmenu-done ws-gmenu-openbook', `<i class="ws-gmenu-done-icon">${icon('book')}</i><div class="ws-gmenu-abody"><div class="ws-gmenu-aname">${esc(o.title)}</div><div class="ws-gmenu-agoal">${esc(o.sub)}</div></div><span class="ws-gmenu-chip">Open</span>`, 'button') as HTMLButtonElement;
    row.type = 'button';
    row.addEventListener('click', () => { o.onPick(); });
    p.append(row);
  }
  const strip = el('ws-gmenu-counters');
  for (const c of v.counters) strip.append(el(`ws-gmenu-counter${c.n >= c.of ? ' full' : ''}`, `<span>${esc(c.label)}</span><b>${c.n} / ${c.of}</b>`));
  p.append(strip);
  if (v.next !== null) p.append(el('ws-gmenu-nextcharm', esc(v.next)));
  for (const s of v.sections) {
    p.append(el('ws-gmenu-label', esc(s.title)));
    const grid = el(`ws-gmenu-stickers${s.dense === true ? ' dense' : ''}`);
    for (const it of s.items) {
      const pick = v.onPick, id = it.id;
      const html = `<i class="ws-gmenu-stickicon">${icon(it.icon)}</i><span>${it.found ? esc(it.label) : '???'}</span>`;
      if (pick !== undefined && id !== undefined) {
        const b = el(`ws-gmenu-sticker tap${it.found ? ' found' : ''}`, html, 'button') as HTMLButtonElement;
        b.type = 'button';
        b.addEventListener('click', () => { pick(id); });
        grid.append(b);
      } else grid.append(el(`ws-gmenu-sticker${it.found ? ' found' : ''}`, html));
    }
    p.append(grid);
  }
  if (v.glass.length === 0) return;
  p.append(el('ws-gmenu-label', 'Sea glass'));
  const chips = el('ws-gmenu-glass');
  for (const g of v.glass) {
    const c = el(`ws-gmenu-glasschip${g.found ? ' found' : ''}`, icon('seaglass'), 'i');
    if (g.found) c.style.color = g.color;
    chips.append(c);
  }
  p.append(chips);
}
