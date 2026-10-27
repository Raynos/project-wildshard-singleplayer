/** G788: the retained grid preparation case reports for one day, with every original assertion. */
export const gridQuarantine = Object.freeze({
  owner: 'sp-x8', openedAt: '2026-10-27T08:20:00Z', expiresAt: '2026-10-28T08:20:00Z',
  failure: '40371580877', sha: '2b11287c5fb143b960b15cf3e37fe17be1ead3c3',
});

/** Only the grid preparation case moves. Expiry restores its blocking execution.
 * @param {string} mode @param {number} [now] */
export function quarantinedGrid(mode, now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error('Invalid quarantine clock');
  return mode === 'grid' && now >= Date.parse(gridQuarantine.openedAt) && now < Date.parse(gridQuarantine.expiresAt);
}
