import { expect, it } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { installBodyShadow } from '../src/game/cosmetics/bodyShadow';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';

it('keeps the traveller shadow at the page root when installed inside a regional scene', () => {
  const scope = new Scope('body-shadow-page'), rootScene = new Scene(), region = new Scene();
  rootScene.add(region);
  const game = { rootScene, scene: region, camera: new PerspectiveCamera(), onUpdate: () => undefined };
  try {
    const body = withOwner(scope, () => installBodyShadow({ game,
      player: { position: new Vector3(), yaw: 0, crouching: false, hover: false, swimming: false, submerged: false, carried: false, ride: null } }));
    expect(body.wardrobe.root.parent).toBe(rootScene);
    expect(region.children).toEqual([]);
    region.visible = false; rootScene.remove(region);
    expect(body.wardrobe.root.parent).toBe(rootScene);
  } finally { scope.dispose(); }
});
