/** SF27: the shipping circling policy, declared independently of the custom rig and damage recipe. */
export const CRAB_BRAIN = {
  id: 'brain.driftwood.crab', kind: 'skirmisher', awareRadius: 9, shyRadius: 3, disengageRadius: 18, holdRadius: 3.6, attackRadius: 1.9,
  attackDuration: 0.78, attackCooldown: 1.4, alertCooldown: 0.6, fleeSpeed: 3,
  subordinateVariant: 'small', leaderVariant: 'big', noticeCue: 'crab_click',
} as const;
