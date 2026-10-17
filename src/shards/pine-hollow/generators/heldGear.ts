import authored from '../data/heldGear.json' with { type: 'json' };
import packed from '../data/codeParts.json' with { type: 'json' };
import { BOW_PROFILE } from './bowProfile';
import { CROSSBOW_WEAPON_PROFILE } from './crossbowProfile';
import { WEAPON_FINISHES } from './weaponFinishes';
import { FINISH_CARDS } from './finishCards';

/** The roster counts come from native ammunition; metadata and live views never keep a second capacity constant. */
export const HELD_GEAR = { slug: authored.slug, cards: FINISH_CARDS, variantOrder: Object.keys(WEAPON_FINISHES),
  models: authored.models.map(row => ({ ...row, copies: row.copies ?? (row.role === 'bolt' ? CROSSBOW_WEAPON_PROFILE.magazine + CROSSBOW_WEAPON_PROFILE.reserve : BOW_PROFILE.quiver) })) };
/** The existing packed codec supplies owned copies for declarative finish extras. */
export const FINISH_SOURCE = { url: packed.url, rows: packed.rows };
/** Authored table and card orders survive canonical object-key sorting. */
export const HELD_FINISHES = { source: FINISH_SOURCE, order: Object.keys(WEAPON_FINISHES), rows: WEAPON_FINISHES, cards: FINISH_CARDS,
  extras: Object.fromEntries(Object.entries(authored.extras).map(([id, extras]) => [id, extras.map(extra => {
    const geometry = Reflect.get(packed.parts, extra.geometry) as unknown;
    if (typeof geometry !== 'number') throw new Error(`Unknown held finish part: ${extra.geometry}`);
    return { ...extra, geometry };
  })])) };
/** Tool lifetime is content, as its appearance and motion already are. */
export const HELD_TOOL_LIFETIME = authored.tool;
