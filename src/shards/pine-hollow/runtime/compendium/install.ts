import * as THREE from 'three';
import { installCompendium, type CompendiumHost } from '@wildshard/game/compendium/install';
import { TrophyWall, type TrophyWall as TrophyWallInstance } from './trophyWall';

export function installPineCompendium(host: CompendiumHost): ReturnType<typeof installCompendium> {
  return installCompendium({ ...host, wall: (state, journal) => {
    const def = state.def;
    let wall: TrophyWallInstance | null = null;
    const place = def.wall, root = place ? host.cabins?.roots[place.cabin] : undefined;
    if (place && root && (def.trophies ?? []).length > 0) {
      if (host.context === undefined) throw new Error('Pine trophy wall needs its shard context (the product)');
      const anchor = new THREE.Object3D();
      anchor.position.set(...place.at);
      anchor.rotation.y = place.yaw;
      root.add(anchor);
      anchor.updateMatrixWorld(true);
      wall = new TrophyWall({ product: host.context.product, anchor, state, rows: place.rows, width: place.width, rowY: place.rowY, tip: true });
      wall.onExamine = (id) => { journal.open(id); };
      host.interactables.push(wall.interactable);
    }

    return wall;
  } });
}
