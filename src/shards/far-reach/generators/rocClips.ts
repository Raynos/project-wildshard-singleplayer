/** Original soaring flex, short beat bursts, eased turn bank and bounded head turn, in evaluation order. */
export const ROC_CLIPS = [
  { bone: 'wingL', channel: 'rotation.z', cases: [
    { when: { alive: true }, sum: [0.1, { of: [{ wave: 't', rate: 0.9 }, 0.06] },
      { of: [{ wave: 't', rate: 3.8 }, 0.45, { bounded: [{ of: [{ wave: 't', rate: 1.05 }] }, -0.85], min: 0, divide: 0.15 }] }] },
    { sum: [0.9] },
  ] },
  { bone: 'wingR', channel: 'rotation.z', cases: [
    { when: { alive: true }, sum: [{ of: [{ bounded: [0.1, { of: [{ wave: 't', rate: 0.9 }, 0.06] },
      { of: [{ wave: 't', rate: 3.8 }, 0.45, { bounded: [{ of: [{ wave: 't', rate: 1.05 }] }, -0.85], min: 0, divide: 0.15 }] }] }, -1] }] },
    { sum: [-0.9] },
  ] },
  { bone: 'tail', channel: 'rotation.x', cases: [
    { when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 1.1 }, 0.15] }] }, { sum: [0] },
  ] },
  { mem: 'rocBank', ease: 3, cases: [{ when: { alive: true }, sum: [{ of: [{ mem: 'rocLean' }] }] }, { sum: [0] }] },
  { bone: 'body', channel: 'rotation.z', cases: [{ sum: [{ of: [{ mem: 'rocBank' }] }] }] },
  { bone: 'head', channel: 'rotation.y', cases: [
    { when: { alive: true }, sum: [{ of: [{ bounded: [{ of: [-1, { mem: 'rocBank' }, 1.8] }], min: -0.6, max: 0.6 }] },
      { of: [{ wave: 't', rate: 0.45 }, 0.12] }] }, { sum: [0] },
  ] },
] as const;
