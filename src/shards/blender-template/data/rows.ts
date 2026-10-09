import { parseRows } from '@wildshard/sdk/rows';

/** The hall guardian uses the ordinary declared creature/strike recipes. */
export const ROWS = parseRows({
  strikes: [{ id: 'blender.guardian.bump', shape: { kind: 'point', radius: 1.8 }, windup: 0.7, active: 0.15, recover: 0.8,
    cooldown: 1, range: 2, damage: 15, tags: ['creature.greyBlob'], weight: 1, speed: 0 }],
  species: [{ id: 'grey-blob', kind: 'greyBlob', label: 'Hall guardian', aggressive: true, lockable: true,
    dims: { bodyY: 0.65, bodyHalfLen: 0.4, bodyRadius: 0.55, headRadius: 0.3, legLen: 0.6, feet: [], halfWidth: 0.65 },
    variants: [{ id: 'grey', label: 'Hall guardian', rarity: 'common', weight: 1, scale: [1, 1], hp: 60,
      mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 15, relentless: false } }] }],
  weather: [], days: [], compendiums: [],
  looks: [{ id: 'blender.guardian.look', species: 'grey-blob', recipe: 'engine.sphere', material: null,
    parameters: { radius: 0.55, widthSegments: 10, heightSegments: 6, colour: [0.6, 0.6, 0.6] },
    animation: { recipe: 'engine.scale-wave', parameters: { axis: 'y', frequency: 4, amplitude: 0.06, rest: 1, dead: 0.4 } } }],
  loot: [{ id: 'blender.loot', gear: 'purse.coins', finds: null, marks: null, charted: false, chime: 'cue.swap' }],
});
