/**
 * Signal Dunes' manifest rows (SHARD-PLATFORM M3: pure data, spread by manifest.ts): its entries and shardfile, identity
 * and card text keys, the platform's dusk / pbr / custom-weapon kit, the hidden boundary, its services, assets, loadout,
 * species and fight, its low-poly creatures, its tiers, loot and audio.
 */
export const SIGNAL_MANIFEST_ROWS = {
  entries: { legacy: true, shardfile: true, public: 'shardfile' }, // G326: public card flipped once boot, walk and parity passed (op-ship38)
  gridShardfile: '/shardfiles/sunscar-dunes/shard.json',
  api: 1, order: 50, status: 'experimental', label: '(+2, −1)',
  accent: 'orchid', // G104: the HUD accent inside its grid cell
  style: 'dusk', kitLook: 'pbr', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'dunes' },
  boundary: { visible: false },
  uses: ['quests', 'coins', 'loot', 'hover'],
  assetGlobs: ['public/assets/sunscar-dunes/**', 'public/assets/lut/sunscar-dunes.bin'],
  loadout: { weapons: ['weapon.sunscar-whip'], tools: ['tool.hoverboard'], start: ['weapon.sunscar-whip', 'tool.hoverboard'], held: 'weapon.sunscar-whip' },
  species: ['duneRay', 'sandSkitterer', 'duneStrider', 'duneMatriarch'], fight: { attackers: 2, telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  loot: { coins: true },
} as const;
