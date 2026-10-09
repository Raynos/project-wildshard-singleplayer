import * as THREE from 'three';
import { installCompendium, type CompendiumHost } from '@wildshard/game/compendium/install';
import { PINE_HOLLOW_COMPENDIUM } from '../compendium';
import { TrophyWall } from '../world/trophyWall';

export function installPineCompendium(host: CompendiumHost): ReturnType<typeof installCompendium> {
  return installCompendium({ ...host, wall: (state, journal) => {
    const def = PINE_HOLLOW_COMPENDIUM;
    let wall: TrophyWall | null = null;
    const place = def.wall, root = place ? host.cabins?.roots[place.cabin] : undefined;
    if (place && root && (def.trophies ?? []).length > 0) {
      const anchor = new THREE.Object3D();
      anchor.position.set(...place.at);
      anchor.rotation.y = place.yaw;
      root.add(anchor);
      anchor.updateMatrixWorld(true);
      wall = new TrophyWall({ anchor, state, factory: host.animals.factory, rows: place.rows, width: place.width, rowY: place.rowY, tip: true });
      wall.onExamine = (id) => { journal.open(id); };
      host.interactables.push(wall.interactable);
    }

    return wall;
  } });
}
