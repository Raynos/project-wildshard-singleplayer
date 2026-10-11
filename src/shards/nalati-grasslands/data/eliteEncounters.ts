import { EAGLE_ROCK, CRAG_CAVE } from '../world/layout';
import { KOKBORI_DEN, QARA_CAIRN, ARGYMAQ_PASTURE } from '../layout';

/** Existing legendary stallion kind, preserved for the native spawn and saved identities. */
export const ARGYMAQ = 'argymaq';

// ─────────────────────────────── the defs ───────────────────────────────

// the lairs (layout v2, src/shards/nalati-grasslands/layout.ts): Kokbori's den on the rocky NE rim above the kurgan field, Qara
// Batyr's burial cairn on the bowl's south rim, Argymaq's high pasture on a bench of the Crags (+52)

const ELITE_ROWS = {
  aqbars: {
    id: 'aqbars', name: 'Aqbars the Pale', epithet: 'Irbis of the Crags', lair: { x: CRAG_CAVE.x, z: CRAG_CAVE.z, r: 14 },
    awareR: 60, engageR: 25, leashR: 90, rule: 'always', respawnMin: 20, signature: 'POUNCE', phase2: 'ENRAGED',
    drop: { skin: 'irbis-sabre', skinName: 'IRBIS', weapon: 'sabre', blurb: 'pale frost steel, rosette damascus, a snow-leopard grip' },
  },
  kokbori: {
    id: 'kokbori', name: 'Kokbori', epithet: 'Mother of the Pack', lair: { x: KOKBORI_DEN.x, z: KOKBORI_DEN.z, r: 16 },
    awareR: 80, engageR: 50, leashR: 120, rule: 'dusk', respawnMin: 20, signature: 'PACK HOWL', phase2: 'THE PACK FALLS BACK',
    drop: { skin: 'sky-wolf-bow', skinName: 'SKY-WOLF', weapon: 'bow', blurb: 'blue-grey horn limbs, wolf-fang nocks, a silver string' },
  },
  qyran: {
    id: 'qyran', name: 'Qyran the Storm-Wing', epithet: 'Berkut of the High Wind', lair: { x: EAGLE_ROCK.x, z: EAGLE_ROCK.z, r: 20 },
    awareR: 110, engageR: 75, leashR: 150, rule: 'storm', respawnMin: 20, signature: 'STOOP', phase2: 'INTO THE STORM',
    drop: { skin: 'storm-wing-arrows', skinName: 'STORM-WING', weapon: 'arrow', blurb: 'golden fletching, a gold streak behind every arrow' },
  },
  'qara-batyr': {
    id: 'qara-batyr', name: 'Qara Batyr the Unburied', epithet: 'Captain of the Night Riders', lair: { x: QARA_CAIRN.x, z: QARA_CAIRN.z, r: 18 },
    awareR: 90, engageR: 60, leashR: 150, rule: 'night', respawnMin: 20, signature: 'DEATH CHARGE', phase2: 'THE DEAD RIDE',
    drop: { skin: 'night-rider-mount', skinName: 'NIGHT RIDER', weapon: 'mount', blurb: 'black barding, a spectral mane that glows at night' },
  },
  argymaq: {
    id: 'argymaq', name: 'Argymaq the Unbroken', epithet: 'Stallion of the High Crags', lair: { x: ARGYMAQ_PASTURE.x, z: ARGYMAQ_PASTURE.z, r: 22 },
    awareR: 80, engageR: 40, leashR: 100, rule: 'always', respawnMin: 20, once: true, signature: 'TRAMPLE', phase2: 'HE RUNS',
    // no skin: the horse himself is the prize (docs/design/nalati/elites-and-bosses.md, and Jake's Bag pick C — FINDS says
    // "Your horse"). The id used to be 'argymaq', which no skin list has, so it was silently dropped (E314)
    drop: { skin: null, skinName: 'ARGYMAQ', weapon: 'horse', blurb: 'the best horse in Nalati' },
  },
} as const;


/** The five shipping elite encounter/reward rows, consumed by the existing elite owner. */
export const NALATI_ELITE_DEFS: Record<string, (typeof ELITE_ROWS)[keyof typeof ELITE_ROWS] & { once?: boolean }> = ELITE_ROWS;

/** Each elite's body as its script spawns it at boot (combat/elites.ts `spawn`): kind and variant. Qara Batyr rides the ghost riders' captain. */
export const NALATI_ELITE_ANIMALS: Readonly<Record<string, { readonly kind: string; readonly variant: string }>> = {
  aqbars: { kind: 'leopard', variant: 'aqbars' }, kokbori: { kind: 'kokbori', variant: 'kokbori' }, qyran: { kind: 'eagle', variant: 'qyran' },
  'qara-batyr': { kind: 'ghost-horse', variant: 'captain' }, [ARGYMAQ]: { kind: ARGYMAQ, variant: 'stallion' },
};
