/** The authored Captain encounter identity, phases, wake and completion policy; native clocks stay trusted. */
export const CAPTAIN_DEF = {
  id: 'boss.captain', name: 'boss.captain.name',
  arena: { at: 'shrine.pool', r: 22 }, wake: { flag: 'used:altar' },
  intro: null, seal: false, checkpoint: false, bar: 'boss',
  phases: [
    { at: 1, strikes: ['strike.captain.swing'] },
    { at: 0.66, strikes: ['strike.captain.swing', 'strike.captain.burst'] },
    { at: 0.33, strikes: ['strike.captain.swing', 'strike.captain.second-cut', 'strike.captain.burst'] },
  ],
  reward: null, persist: { deadFlag: 'dead:captain' }, capExempt: true,
};
/** Identical page and native boss-bar admission parameters. */
export const CAPTAIN_PRESENTATION = { name: 'The Drowned Captain', riseAbove: 0.5, cuts: [0.66, 0.33] };
