import { describe, expect, it } from 'vitest';
import { Group, Object3D, PointLight, Scene, Vector3 } from 'three';
import { LightPool } from '../../../src/engine/fx/LightPool';
import { BuildingLife } from '../../../src/shards/pine-hollow/runtime/props/buildingLife';
import { CABIN_LIFE } from '../../../src/shards/pine-hollow/runtime/looks/cabinLook';

// sp-o6: the phone's shared cabin lights live in the content's own (grid-region) scene, never the page root, so building
// a region cannot change the live page's light count. That scene sits at the region's render offset.
describe('Pine shared cabin lights', () => {
  it('place a pooled light on its anchor inside an offset region scene', () => {
    const page = new Scene(), region = new Scene(), view = new Group();
    view.position.set(1000, 0, -500); view.add(region); page.add(view);
    const life = new BuildingLife(CABIN_LIFE);
    const light = LightPool.for(region).acquire(0xffa050, 0, 10, 2);
    life.addSharedLight(light);
    const site = new Group(); site.position.set(20, 0, 30); region.add(site);
    const anchor = new Object3D(); anchor.position.set(1, 2, 3); site.add(anchor);
    life.addSite({ root: site, anchors: [{ anchor, color: 0xffa050, intensity: 4, distance: 10, decay: 2, seed: 1, kind: 'fire', rank: 0 }] });
    page.updateMatrixWorld(true);
    life.tick(0.016, 1, new Vector3(1020, 0, -470), 1);
    page.updateMatrixWorld(true);
    expect(light.getWorldPosition(new Vector3()).distanceTo(anchor.getWorldPosition(new Vector3()))).toBeLessThan(1e-6);
    // the page root holds no light of the region's
    let rootLights = 0;
    page.traverse((o) => { if (o instanceof PointLight && !region.getObjectById(o.id)) rootLights++; });
    expect(rootLights).toBe(0);
  });
});
