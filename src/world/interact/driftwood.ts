/**
 * Driftwood Isle's interactables — the data table (A2 kit, A3 puzzles, A4 collectibles). Pure data: validated by
 * `validateTable` (test/interact.test.ts), built by `Interactables`, read by the quest (src/game/quest/driftwood.ts)
 * through flags. Local frames are the POI modules' (types.ts `Place`): hut door at local −z; wreck x = starboard,
 * z = stern; cave mouth at local −z (the interior is +z); shrine front (the pillars' gap) at local −z; lookout stair
 * toward local −z. `anchor` names are the model agent's exported points (Wreck/Cove/Shrine/Lookout/Hut `anchors`);
 * the x / z beside them are today's fallbacks.
 *
 * The three glyph-shard puzzles (A3):
 *   LOOKOUT — the castaway's chest in the hut holds his flint & steel; climb the lookout and light the beacon →
 *             the shard rises out of the flames onto the platform.
 *   WRECK   — the drowned sailor guards the hold; he drops the hold key; the key opens the grate; below, pump the
 *             bilge THEN work the winch (winch alone jams: it needs the pump on and must be pulled after it) → the
 *             captain's strongbox comes up → the shard. The iron sword is in the hold too (IronSword.ts, D6).
 *   CAVE      — the sluice gate seals the sea cave; two tide plates on the sand in front must be held at once — one
 *             by you, one by the barrel that washed up by the wreck — and the gate latches open → the shard.
 */
import type { InteractTable, PickupDef } from './types';

/** the flag every glyph shard raises (the quest counts them; the altar's sockets fill from them) */
export const SHARD_FLAGS = ['shard:lookout', 'shard:wreck', 'shard:cave'] as const;
export const SEA_GLASS_FLAG = 'glass:';   // + piece id, one per piece

const GLASS: [number, number][] = [
  [-20, -146], [-30, -126], [-27, -92], [-9, -49], [15, -14], [58, 2], [100, 1], [41, 40],
  [67, 63], [-52, -31], [-73, 24], [-89, 71], [-138, -40], [28, 146], [118, -34],
];
const COLORS = ['#7df0d0', '#8fd8ff', '#b7f59a', '#9fb8ff', '#f0f7a0'];

const glass: PickupDef[] = GLASS.map(([x, z], i) => ({
  kind: 'pickup', id: `glass-${i + 1}`, look: 'seaglass', item: 'sea-glass', label: 'Sea glass', touch: true,
  color: COLORS[i % COLORS.length] ?? '#7df0d0', at: { poi: 'world', x, z }, sets: [`${SEA_GLASS_FLAG}${i + 1}`],
}));
export const SEA_GLASS_COUNT = GLASS.length;

export const DRIFTWOOD_INTERACT: InteractTable = {
  external: ['talked:castaway', 'dead:sailor', 'quest:shrine-open', 'dead:captain'],
  rows: [
    // ── the hut: the castaway's sea chest (flint & steel for the beacon, a few coins) ──
    { kind: 'chest', id: 'castaway-chest', look: 'chest', at: { poi: 'hut', anchor: 'hut.hutChest', x: -2.2, z: 1.6, yaw: 0 },
      requires: { all: ['talked:castaway'] }, lockedLabel: 'The castaway\'s sea chest — ask him first',
      loot: [{ flag: 'has:flint', label: 'flint & steel' }, { item: 'doubloon', n: 2 }], toast: 'The castaway\'s sea chest' },

    // ── LOOKOUT: the beacon; the shard appears once it burns ──
    { kind: 'beacon', id: 'beacon', label: 'Light the beacon', at: { poi: 'lookout', anchor: 'lookout.beacon', x: 0.9, z: 0.9 },
      requires: { all: ['has:flint'] }, lockedLabel: 'A beacon of dry driftwood — you need something to light it',
      toast: 'The beacon roars up — every ship for miles can see it' },
    { kind: 'pickup', id: 'shard-lookout', look: 'shard', label: 'the glyph shard', at: { poi: 'lookout', anchor: 'lookout.shard', x: -0.9, z: 0.6 },
      showWhen: { all: ['lit:beacon'] }, sets: ['shard:lookout'], toast: 'Glyph shard — the Lookout' },

    // ── WRECK: the hold (grate + key from the sailor), the pump / winch levers, the strongbox; a barrel on the beach ──
    { kind: 'key', id: 'hold-key', key: 'hold', label: 'the hold key', at: { poi: 'wreck', x: 0.5, z: 2.2, dy: 0.1 },
      showWhen: { all: ['dead:sailor'] }, toast: 'The drowned sailor\'s hold key' },
    { kind: 'door', id: 'hold-grate', look: 'grate', w: 1.4, h: 1.9, lock: 'hold', at: { poi: 'wreck', anchor: 'wreck.holdDoor', x: 0.2, z: 0.6, yaw: Math.PI },
      lockedLabel: 'The hold grate is locked — the drowned sailor has the key', toast: 'The grate grinds open' },
    { kind: 'lever', id: 'hold-pump', label: 'Work the bilge pump', at: { poi: 'wreck', anchor: 'wreck.leverA', x: -1.3, z: 3.0, yaw: Math.PI / 2 },
      requires: { all: ['open:hold-grate'] }, lockedLabel: 'Behind the grate', toast: 'The pump coughs; the bilge water drains' },
    { kind: 'lever', id: 'hold-winch', label: 'Work the cargo winch', at: { poi: 'wreck', anchor: 'wreck.leverB', x: 1.2, z: 3.4, yaw: -Math.PI / 2 },
      requires: { all: ['open:hold-grate', 'lever:hold-pump'] }, lockedLabel: 'The winch is jammed — the hold is still flooded',
      sets: ['winch:up'], toast: 'The winch hauls a strongbox out of the bilge' },
    { kind: 'chest', id: 'strongbox', look: 'strongbox', at: { poi: 'wreck', anchor: 'wreck.strongbox', x: 0.1, z: 4.9, yaw: Math.PI },
      showWhen: { all: ['winch:up'] }, loot: [{ flag: 'shard:wreck', label: 'the glyph shard — the Wreck' }, { item: 'doubloon', n: 3 }],
      toast: 'The captain\'s strongbox' },
    { kind: 'barrel', id: 'tide-barrel', leash: 36, at: { poi: 'world', anchor: 'cave.barrelStart', x: 139, z: 2 } },

    // ── CAVE: the tide plates and the sluice gate ──
    { kind: 'plate', id: 'tide-plate-a', size: 1.3, by: 'any', at: { poi: 'cave', anchor: 'cave.plateA', x: -1.8, z: -12 } },
    { kind: 'plate', id: 'tide-plate-b', size: 1.3, by: 'any', at: { poi: 'cave', anchor: 'cave.plateB', x: 2.8, z: -12 } },
    { kind: 'door', id: 'sluice', look: 'sluice', w: 2.2, h: 2.2, latch: true, at: { poi: 'cave', anchor: 'cave.gate', x: 0, z: -2.3 },
      opensWhen: { all: ['plate:tide-plate-a', 'plate:tide-plate-b'] }, toast: 'The tide gate lifts — the cave drains' },
    { kind: 'pickup', id: 'shard-cave', look: 'shard', label: 'the glyph shard', at: { poi: 'cave', anchor: 'cave.alcove', x: 0, z: -1.2, dy: 0.1 },
      requires: { all: ['open:sluice'] }, lockedLabel: 'Behind the tide gate', sets: ['shard:cave'], toast: 'Glyph shard — the Sea Cave' },

    // ── SHRINE: the altar the three shards are set into (the Captain rises when it is used) ──
    { kind: 'altar', id: 'altar', label: 'Set the glyph shards', fills: [...SHARD_FLAGS], at: { poi: 'shrine', anchor: 'shrine.altar', x: 0, z: -2.4 },
      requires: { all: [...SHARD_FLAGS] }, lockedLabel: 'Three empty sockets — the glyph shards are out on the island',
      sets: ['quest:shrine-set'], toast: 'The shards lock into place — the ring wakes' },

    // ── A4: the dive treasure off the wreck reef, the vista bench on the plateau rim, the sea glass ──
    { kind: 'chest', id: 'reef-treasure', look: 'treasure', at: { poi: 'world', x: 182, z: -30 }, loot: [{ item: 'doubloon', n: 8 }, { flag: 'found:reef-treasure', label: 'a pearl necklace' }],
      toast: 'Sunken treasure!' },
    { kind: 'bench', id: 'vista-bench', label: 'Sit and take in the view', at: { poi: 'world', x: -46, z: -96, yaw: Math.PI }, toast: '' },
    ...glass,
  ],
};
