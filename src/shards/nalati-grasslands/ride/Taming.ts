import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';
import { NalatiTamingLaw } from '../runtime/tamingLaw';
import type { Mount } from './ride';
import type { RidingPrograms } from '../runtime/tamingBindings';
import type { HerdController } from '../runtime/groupRegistry';
import type { RideHUD } from '@wildshard/game/riding/hud';
import { wildEnv } from '../creatures/env';

import { tulparSave as savedSlot } from './saves';


export interface TamingOpts {
  programs: RidingPrograms;
  /** Bonded-horse identity owned by the declared runtime state. */
  bond?: { read: () => string | null; write: (value: string) => void };
  player: Player;
  mount: Mount;
  animals: AnimalManager;
  hud: RideHUD;
  herds: () => HerdController[];
  /** where Tulpar waits / rests (a hitch spot at the camp's rail) */
  rest: { x: number; z: number; face: { x: number; z: number } };
  hurt: (damage: number) => void;
  toast?: (text: string) => void;
}

/** The page adapter to Nalati's same renderer-free taming law; view and save ownership remain here. */
export class Taming extends NalatiTamingLaw<Animal, HerdController> {
  constructor(opts: TamingOpts) {
    super({ ...opts, mount: {
      get mounted() { return opts.mount.mounted; }, get horse() { return opts.mount.horse; },
      get breakShake() { return opts.mount.breakShake; }, set breakShake(value) { opts.mount.breakShake = value; },
      get breakRoll() { return opts.mount.breakRoll; }, set breakRoll(value) { opts.mount.breakRoll = value; },
      mount: (actor, breaking) => opts.mount.mount(actor.entityId, breaking), dismount: thrown => { opts.mount.dismount(thrown); },
      addMountable: (actor, name) => { opts.mount.addMountable(actor.entityId, name); }, removeMountable: actor => { opts.mount.removeMountable(actor.entityId); },
    }, bond: opts.bond ?? { read: () => savedSlot.read('nalati-grasslands'), write: () => undefined },
      wind: () => wildEnv.wind, random: Math.random,
      hideStallion: st => { st.hidden = true; st.mesh.visible = false; st.position.y = -1e4; },
      retireBonded: old => {
        old.hidden = true; old.mesh.visible = false; old.alive = false; old.position.y = -1e4;
        const i = opts.animals.animals.indexOf(old); if (i !== -1) opts.animals.animals.splice(i, 1);
        old.mesh.removeFromParent();
      },
      spawnBonded: (x, z, yaw, argymaq) => {
        const t = opts.animals.spawn('horse', x, z, yaw, 'tulpar');
        t.place(x, z, yaw); t.position.y = heightAt(x, z); t.mem['whistle'] = 1;
        if (argymaq) {
          t.scale = 1.3; t.mesh.scale.setScalar(1.3);
          const mats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material];
          for (const mt of mats) if (mt instanceof THREE.MeshLambertMaterial) mt.color.setRGB(0.62, 0.64, 0.72);
        }
        return t;
      },
    });
  }
}
