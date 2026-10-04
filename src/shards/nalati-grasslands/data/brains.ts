/** The shipping steppe pack tuning; native prey, strike and taming recipes remain in runtime/. */
export const NALATI_PACK_BRAIN = {
  id: 'nalati.wolf-pack', kind: 'pack', thinkDivisor: 6,
  trotSpeed: 4, runSpeed: 9.5, shadowMinRadius: 30, shadowMaxRadius: 40,
  ringMinRadius: 12, ringMaxRadius: 16, biteRadius: 1.4, sightRadius: 35,
  coneAngle: 70 * (Math.PI / 180), smellRadius: 60, hearing: [4, 8, 16, 30],
  telegraphSeconds: 0.4, dashSeconds: 1.8, breakoffSeconds: 1.1, attackSeconds: 0.42,
  leaderVariant: 'alpha', yipCue: 'wolf_yip', howlCue: 'wolf_howl', snarlCue: 'wolf_snarl', biteCue: 'wolf_bite',
} as const;
