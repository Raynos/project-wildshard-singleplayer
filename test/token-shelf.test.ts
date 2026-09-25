import { describe, expect, it } from 'vitest';
import { tokenShelfGeometry, TOKEN_SHELF_AT } from '../src/pinehollow/quest/tokenShelf';
import { carvedToken } from '../src/world/interact/models';

describe('the token shelf (PH-C8: all eight carved tokens on the ranger\'s mantel)', () => {
  it('is one geometry: the rack + eight of the pickup\'s own tokens, vertex-coloured', () => {
    const g = tokenShelfGeometry(), token = carvedToken(1).getAttribute('position').count;
    const n = g.getAttribute('position').count;
    expect(g.hasAttribute('color')).toBe(true);
    expect(n).toBeGreaterThan(8 * token);
    expect(n - 8 * token).toBeLessThan(400); // the rack: a plank, a rail, a lip, two posts
  });
  it('fits the mantel (1.7 × 0.7 m) and stands on it, under the log wall', () => {
    const g = tokenShelfGeometry();
    g.computeBoundingBox();
    const b = g.boundingBox;
    if (!b) throw new Error('no bounds');
    expect(b.max.x - b.min.x).toBeLessThan(1.7);
    expect(b.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(b.max.y).toBeLessThan(0.3);
    expect(TOKEN_SHELF_AT.z + b.min.z).toBeGreaterThan(-3.5 + 0.112); // in front of the gable's inner log face
    expect(TOKEN_SHELF_AT.z + b.max.z).toBeLessThan(-2.8);            // on the mantel's front edge, not over it
  });
});
