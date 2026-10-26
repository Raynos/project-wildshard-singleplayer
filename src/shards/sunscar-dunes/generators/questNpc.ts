import { SCOUT_ROW } from './questPresentation';
import { SCOUT_AT } from './rows/flags';
import { signalManifestMetadata } from './manifestGround';
import STRINGS from '../data/strings.json' with { type: 'json' };

const ground = signalManifestMetadata();

/** The scout's original exact-point ground query, met flag and loaded-model-only registration. */
export const QUEST_NPC: { readonly npc: { readonly id: "sunscar.scout"; readonly name: string; readonly spot: "scout"; readonly at: { readonly x: number; readonly z: number; }; readonly faceHome: { readonly x: number; readonly z: number; }; readonly metFlag: "sunscar.scout"; readonly talkHeight: 1.62; readonly talkRadius: 3.5; readonly faceRange: 12; readonly waveRange: 16; readonly collider: { readonly half: 0.3; readonly below: 0.3; readonly above: 1.7; readonly surface: "flesh"; }; readonly figure: { readonly model: "caravan-scout"; readonly height: 1.7; readonly neck: readonly [0, 1.43, 0]; readonly shoulder: readonly [-0.21, 1.36, 0]; readonly armBelowX: -0.2; readonly armAboveY: 0.78; readonly roughness: 0.9; readonly flat: true; }; readonly dialogue: readonly [{ readonly when: { readonly all: readonly ["sunscar.complete"]; }; readonly lines: readonly [string]; }, { readonly when: { readonly all: readonly ["sunscar.scout"]; }; readonly lines: readonly [string]; }, { readonly lines: readonly [string, string, string]; readonly sets: readonly ["sunscar.scout"]; }]; }; readonly label: string; readonly system: "sunscar.scout"; readonly sourceFile: "src/shards/sunscar-dunes/generators/questPresentation.ts"; readonly ground: { readonly height: number; readonly at: { readonly x: number; readonly z: number; }; readonly error: "Undeclared authored scout ground query"; }; readonly met: "flag"; readonly missing: "omit"; readonly update: "loaded"; } = { npc: SCOUT_ROW, label: STRINGS.talkScout, system: SCOUT_ROW.id,
  sourceFile: 'src/shards/sunscar-dunes/generators/questPresentation.ts',
  ground: { height: ground.heights.scout, at: SCOUT_AT, error: 'Undeclared authored scout ground query' },
  met: 'flag', missing: 'omit', update: 'loaded' } as const;
