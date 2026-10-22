import { STATIC_BOAT } from './staticWorld';

/** Fixed-step presentation binds the original construction-owned bodies and look. */
export function driftwoodMoverOwners(): {
  system: string;
  bindings: readonly [
    { id: string; kind: 'object'; owner: string; moor: { look: string; water: number; cleats: [number, number] } },
    { id: string; kind: 'chain'; owner: string },
  ];
} {
  const [bow, stern] = STATIC_BOAT.cleats;
  if (bow === undefined || stern === undefined) throw new Error('Boat mooring requires both original cleats');
  return { system: 'shard.driftwood.movers', bindings: [
    { id: 'driftwood.boat', kind: 'object', owner: 'boat', moor: {
      look: 'driftwood-kit-moor', water: STATIC_BOAT.spec.waterY, cleats: [bow, stern] } },
    { id: 'driftwood.bridge', kind: 'chain', owner: 'bridge.deck' },
  ] };
}
