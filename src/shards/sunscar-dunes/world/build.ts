import type { Interactable } from '#engine';
import type { ShardContext } from '#game';
import { TOWER } from '../layout';
import { STRINGS } from '../strings';
import { ownPrimitives } from './resources';
import { buildTower, type TowerParts } from './tower';

/** The signal fire: the tower piece, the brazier interactable and the flicker. `light()` is idempotent. */
export interface SignalFire { tower: TowerParts; brazier: Interactable; lit: boolean; onLight: (() => void) | null; light: () => void }

export function buildWorld(ctx: ShardContext): SignalFire {
  const terrain = ctx.manifest.ground.terrain, groundAt = (x: number, z: number): number => terrain?.heightAt(x, z) ?? 0;
  const tower = buildTower(groundAt(TOWER.x, TOWER.z), groundAt);
  ctx.root.add(tower.root);
  ctx.piece({ id: 'sunscar.tower', name: STRINGS.tower, category: 'buildings', file: 'src/shards/sunscar-dunes/world/tower.ts', object: tower.root,
    colliders: tower.colliders, surface: 'wood' });
  ownPrimitives(ctx.root, ctx.scope);
  const fire: SignalFire = { tower, lit: false, onLight: null,
    brazier: { label: STRINGS.light, position: tower.brazierAt, radius: 2.6, onInteract: () => { fire.light(); } },
    light: () => {
      if (fire.lit) return;
      fire.lit = true; tower.fire.visible = true; tower.light.intensity = 60; fire.brazier.label = STRINGS.lit; fire.onLight?.();
    } };
  ctx.game.runtime?.interactables.push(fire.brazier);
  ctx.system({ id: 'sunscar.fire', phase: 'update', run: (_dt, t) => {
    if (!fire.lit) return;
    const flick = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 29 + 1.3) * 0.04;
    tower.fire.scale.set(1, flick, 1); tower.light.intensity = 60 * flick;
  } });
  return fire;
}
