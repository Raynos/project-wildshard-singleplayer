/**
 * The Nalati Look Lab (NALATI-MERGE L2; the user's rule: every look change ships as a switchable variant + a comparison
 * sheet, the user picks, the pick is locked in and the losers leave). The wave-6 variants, each OFF by default (today's
 * look) until the user picks, all LIVE — flip one and the next frame shows it, no reload:
 *
 *   terrainShadow  `?tshadow=1`    the terrain casts the baked shadows (terrainLight.ts)
 *   terrainAO      `?tao=1`        baked terrain AO + the meadow's green bounce (terrainLight.ts)
 *   modelShade     `?modelshade=1` Driftwood's model shading on the generated GLBs: a baked AO (glbPaint.ts)
 *   campPeople     `?people=blender|gen` the camp's people as generated + rigged models (NALATI-MERGE D2,
 *                  src/nalati/campPeopleModels.ts; campPeople.ts applies it — a three-way pick, `__lookLab.people(v)`)
 *
 * The picks are Settings OPTIONS (src/ui/Settings.ts: saved, the URL overrides them for the page's life), shown in the
 * pause menu ▸ Settings ▸ Debug ▸ Look lab on Nalati only (src/ui/Menu.ts). `window.__lookLab.set('terrainShadow', true)`
 * flips one for the capture scripts (scripts/nalati-looklab.mjs shoots before | after on the one page).
 */
import type * as THREE from 'three';
import { setting, saveSetting, onSettingChange, type OptionValue } from '../../ui/Settings';
import { setModelShade } from '../../world/nalati/glbPaint';
import type { TerrainLightBake } from './terrainLight';

export const LOOK_LAB = ['terrainShadow', 'terrainAO', 'modelShade'] as const;
export type LookLabKey = (typeof LOOK_LAB)[number];

/** wireLookV2, once: apply the picks now and on every change */
export function installLookLab(terrain: TerrainLightBake, scene: THREE.Object3D): void {
  const apply = (): void => {
    terrain.set({ shadow: setting('terrainShadow') === 'on', ao: setting('terrainAO') === 'on' });
    setModelShade(setting('modelShade') === 'on', scene);
  };
  apply();
  for (const k of LOOK_LAB) onSettingChange(k, apply);
  if (typeof window !== 'undefined') {
    Object.assign(window, {
      __lookLab: {
        set: (k: LookLabKey, on: boolean): void => { saveSetting(k, on ? 'on' : 'off'); },
        get: (): Record<LookLabKey, boolean> => ({ terrainShadow: setting('terrainShadow') === 'on', terrainAO: setting('terrainAO') === 'on', modelShade: setting('modelShade') === 'on' }),
        people: (v: OptionValue<'campPeople'>): void => { saveSetting('campPeople', v); },
      },
    });
  }
}
