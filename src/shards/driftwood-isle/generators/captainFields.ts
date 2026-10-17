/** Declared retained-actor fields, needed for source admission before output assembly. */
export const CAPTAIN_FIELDS = ['st', 'rise', 'phase', 'awake', 'init', 'cd', 'subt', 'combo', 'burst-x', 'burst-z', 'pool-x', 'pool-z', 'arena'].map((name, i) => ({
  id: i + 1, name, type: 'f64' as const, privacy: 'public' as const, default: name === 'arena' ? 22 : name === 'phase' ? 1 : 0,
  min: ['st','rise','phase','awake','init','combo','cd','subt','arena'].includes(name)?0:-250, max:name==='rise'||name==='awake'||name==='init'||name==='combo'?1:name==='st'?5:name==='phase'?3:10000,
}));
