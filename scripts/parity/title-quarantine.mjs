/** G758: retain both original Nine PNG assertions in a reporting job for at most 24 hours. */
export const titleQuarantine = Object.freeze({
  owner: 'sp-x1', openedAt: '2026-10-27T03:30:00Z', expiresAt: '2026-10-28T03:30:00Z',
  failures: Object.freeze(['40346975383', '40355584392']),
});

/** Only the repeated Nine title PNG flake moves; gameplay and all other pictures still block.
 * At expiry the ordinary title assertion automatically blocks again, even without a follow-up edit.
 * @param {string} shard @param {string} mode @param {number} [now] */
export function quarantinedTitle(shard, mode, now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error('Invalid quarantine clock');
  return shard === 'nine-dragon-stack' && (mode === 'standalone' || mode === 'public-policy') &&
    now >= Date.parse(titleQuarantine.openedAt) && now < Date.parse(titleQuarantine.expiresAt);
}
