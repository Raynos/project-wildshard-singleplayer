// Pine Hollow's skinning knife as data (SHARD-PLATFORM M3, the kit system's held tool: @wildshard/sdk/kit/heldTool;
// models/skinningKnife.ts holds it through the skinning beat).
import type { HeldToolRow } from '@wildshard/sdk/kit/heldTool';

/**
 * The skinning beat's first-person knife (PINE-HOLLOW-REMASTER §5 Polish): a gloved right hand holding a drop-point
 * skinning knife, the Blender model (scripts/blender/pine-hollow/weapons/skinning_knife.py → skinning-knife[.phone].glb,
 * its path models/skinningKnife.ts's) fetched 600 ms after the level loads. The hold: the grip's centre at the lower right, the blade turned well in across
 * the view (held straight along −z the fist hides it), tipped down to the hide, the edge rolled toward it; it comes from
 * and goes to below the frame. The strokes: 0.12 s of wind-up (back and up, the tip lifting), 0.14 s of draw (down and
 * across, the tip dipping into the hide) ending just past the cut, then 0.12 s back; the first opens the belly (down and
 * to the left), the second pulls back toward you along the leg. The stand-in: a steel drop-point blade, a brass guard, a
 * walnut handle, a tan leather fist with its thumb along the top, the wrist and a dark cuff (grip at 0, blade −z, edge −y).
 */
export const KNIFE_LOOK: Omit<HeldToolRow, 'url'> = {
  name: 'skin-knife',
  standIn: { roughness: 0.55, metalness: 0.25 }, envMapIntensity: 0.9, anisotropy: 8, loadDelayMs: 600, renderOrder: 1000,
  hold: [0.11, -0.115, -0.33], holdRot: [-0.3, 0.95, -0.45], low: [0.2, -0.46, -0.3], lowTilt: 0.5,
  portrait: { gain: 1.6, x: -0.075, y: 0.04 },
  stroke: {
    lead: 0.16, span: 0.42,
    windIn: 0.12, windOut: 0.12, windFall: 0.12, windMove: [0.03, 0.035, 0.02], windTilt: 0.1,
    drawAt: 0.1, drawIn: 0.14, drawOut: 0.3, drawFall: 0.12, drawTilt: -0.16,
    cuts: [{ dir: [-0.075, -0.055, -0.02], turn: [0.22, -0.12] }, { dir: [-0.03, -0.05, 0.06], turn: [-0.14, 0.1] }],
  },
  parts: [
    {
      kind: 'extrude', args: [], paint: '#c9ccd0',
      shape: [['moveTo', 0, 0.012], ['lineTo', 0.075, 0.012], ['quadraticCurveTo', 0.098, 0.009, 0.105, 0.0], ['quadraticCurveTo', 0.085, -0.014, 0.05, -0.016], ['lineTo', 0, -0.014], ['lineTo', 0, 0.012]],
      extrude: { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.001, bevelSegments: 1, curveSegments: 8 },
      ops: [['translate', 0, 0, -0.0015], ['rotateY', 1.5707963267948966], ['translate', 0, 0.004, -0.062]],
    },
    { kind: 'box', args: [0.012, 0.036, 0.006], ops: [['translate', 0, 0, -0.06]], paint: '#b08a4a' },
    { kind: 'cylinder', args: [0.0125, 0.014, 0.11, 12], ops: [['rotateX', 1.5707963267948966], ['translate', 0, 0, -0.005]], paint: '#5a3a24' },
    { kind: 'sphere', args: [1, 14, 10], ops: [['scale', 0.034, 0.038, 0.05], ['translate', 0.004, -0.006, 0.0]], paint: '#8a6644' },
    { kind: 'capsule', args: [0.009, 0.03, 4, 8], ops: [['rotateX', 1.5707963267948966], ['translate', -0.012, 0.024, -0.02]], paint: '#8a6644' },
    { kind: 'cylinder', args: [0.028, 0.032, 0.07, 12], ops: [['rotateX', 1.2207963267948965], ['translate', 0.01, -0.02, 0.07]], paint: '#7d5c3d' },
    { kind: 'cylinder', args: [0.042, 0.046, 0.12, 14, 1, 1], ops: [['rotateX', 1.2207963267948965], ['translate', 0.014, -0.042, 0.15]], paint: '#2b2f33' },
  ],
};
