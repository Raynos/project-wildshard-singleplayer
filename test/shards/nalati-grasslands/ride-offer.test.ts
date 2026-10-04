// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { hudSlots } from '../../../src/engine/ui/hudSlots';
import { Mount } from '../../../src/shards/nalati-grasslands/ride/Mount';
import { RideHUD, type TamingView } from '../../../src/shards/nalati-grasslands/ride/RideHUD';
import { fakeWorld } from '../../fake/world';
import { damageTarget } from '../../fake/legacyActor';

const view: TamingView = { trust: null, alert: 0, ear: null, round: null, balance: 0, danger: false, offer: true };
const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

function fixture() {
  const slots = hudSlots.snapshot();
  const root = document.createElement('div'); root.id = 'hud'; document.body.append(root);
  const world = fakeWorld(), mount = new Mount({ player: world.player, forest: world.forest });
  const hud = new RideHUD(mount, new THREE.PerspectiveCamera());
  cleanups.push(() => { hud.scope.dispose(); root.remove(); hudSlots.restore(slots); });
  const offer = hud.inputVerbs()['verb.2'];
  if (offer === undefined || typeof offer === 'string') throw new Error('Missing OFFER verb');
  return { hud, mount, offer };
}

describe('OFFER availability', () => {
  it('is hidden when contextual verbs paint synchronously before the first HUD update', () => {
    const { hud, offer } = fixture();
    expect(offer.action).toBe('ride.offer');
    expect(offer.show?.()).toBe(false);
    expect(offer.element?.classList.contains('show')).toBe(false);
    hud.update(null);
    expect(offer.show?.()).toBe(false);
  });

  it('follows the taming offer, hides while mounted, and clears a held offer when availability ends', () => {
    const { hud, mount, offer } = fixture();
    hud.update(null);
    hud.update(view);
    expect(offer.show?.()).toBe(true);
    expect(offer.element?.classList.contains('show')).toBe(true);
    hud.offer = true;
    hud.update({ ...view, offer: false });
    expect(offer.show?.()).toBe(false);
    expect(hud.offer).toBe(false);
    const horse = damageTarget().animal; horse.label = 'Test horse';
    mount.horse = horse;
    hud.update(view);
    expect(offer.show?.()).toBe(false);
    mount.horse = null;
    hud.update(view);
    expect(offer.show?.()).toBe(true);
    hud.update(null);
    expect(offer.show?.()).toBe(false);
  });
});
