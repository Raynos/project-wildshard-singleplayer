import * as THREE from 'three';
import type { SkinDef } from '@wildshard/engine/player/Skins';

/** Pine's authored material finishes and legendary sources; application and ownership are generic. */
export type SkinId = 'ghost-stag' | 'hollow-ash' | 'ironhide' | 'scarback-furnace' | 'blackpaw' | 'imperial' | 'warden';

const IVORY = 0xe9dfc6, BONE = 0xd9cfb4, SILVER = 0xc9ced4, GHOST_CYAN = 0x8fe3ff, EMBER = 0xff5a12, BRASS = 0xf2b24c;

export const SKINS: Record<SkinId, SkinDef & { id: SkinId; weapon: 'crossbow' | 'rifle' }> = {
  'ghost-stag': {
    id: 'ghost-stag', weapon: 'crossbow', name: 'Ghost Stag', blurb: 'bone-white ash, the stag\'s own antlers for a prod',
    dropsFrom: { kind: 'deer', variant: 'ghost' },
    mats: {
      'xbow-wood': { color: BONE, roughness: 0.6, envMapIntensity: 0.8, emissive: GHOST_CYAN, emissiveIntensity: 0.03, plain: true },
      'xbow-prod': { color: IVORY, metalness: 0, roughness: 0.55, envMapIntensity: 0.6, plain: true },
      'xbow-iron': { color: SILVER, roughness: 0.55, envMapIntensity: 1.1 },
      'xbow-brass': { color: SILVER, roughness: 0.5 },
      'xbow-leather': { color: 0xdad3c4, roughness: 0.9 },
      'xbow-cord': { color: 0xe8fbff, emissive: GHOST_CYAN, emissiveIntensity: 0.9 },
    },
    extras: (root, mat) => antlerTines(root, mat('xbow-prod') ?? mat('xbow-iron')),
  },
  'hollow-ash': {
    id: 'hollow-ash', weapon: 'crossbow', name: 'Hollow Ash', blurb: 'charred ash, cold light in the cracks',
    mats: {
      'xbow-wood': { color: 0x2a2a2e, roughness: 1, emissive: GHOST_CYAN, emissiveIntensity: 0.08 },
      'xbow-prod': { color: 0x1c1d22, roughness: 0.9, envMapIntensity: 0.9 },
      'xbow-iron': { color: 0x15161a, roughness: 0.8 },
      'xbow-brass': { color: SILVER, roughness: 0.5 },
      'xbow-leather': { color: 0x2a2523 },
      'xbow-cord': { color: 0x1a1a1a },
    },
  },
  'ironhide': {
    id: 'ironhide', weapon: 'rifle', name: 'Ironhide', blurb: 'scarred iron plates, a boar-tusk grip, still warm from the forge',
    dropsFrom: { kind: 'boar', variant: 'ironhide' },
    mats: {
      'rifle-alu': { color: 0x5a3d2e, roughness: 1, metalness: 1, envMapIntensity: 0.9, emissive: EMBER, emissiveIntensity: 0.02 },
      'rifle-poly': { color: IVORY, metalness: 0, roughness: 0.55, envMapIntensity: 0.7, plain: true },
      'rifle-steel': { color: 0x3a2a22, roughness: 0.9, emissive: EMBER, emissiveIntensity: 0.1 },
      'rifle-brass': { color: BRASS, roughness: 0.45, envMapIntensity: 1.2 },
      // Pine Hollow's lever-action (LeverRifle.ts) wears it too: iron-dark steel, a tusk-ivory stock, brass
      'lever-steel': { color: 0x5a3d2e, roughness: 1, metalness: 1, envMapIntensity: 0.9, emissive: EMBER, emissiveIntensity: 0.03 },
      'lever-wood': { color: IVORY, roughness: 0.55, envMapIntensity: 0.7 },
      'lever-brass': { color: BRASS, roughness: 0.45, envMapIntensity: 1.2 },
    },
  },
  'blackpaw': {
    id: 'blackpaw', weapon: 'crossbow', name: 'Blackpaw', blurb: 'bear-black stock, claw-hook nocks, the rent in arrears',
    mats: {
      'xbow-wood': { color: 0x2a221d, roughness: 0.95, envMapIntensity: 0.7 },
      'xbow-prod': { color: 0x16130f, roughness: 0.8 },
      'xbow-iron': { color: 0x2b2a28, roughness: 0.7 },
      'xbow-brass': { color: 0x8a7a64, roughness: 0.6 },
      'xbow-leather': { color: 0x1d1714, roughness: 1 },
      'xbow-cord': { color: 0x3a2e24 },
    },
  },
  'imperial': {
    id: 'imperial', weapon: 'crossbow', name: 'Imperial', blurb: 'antler-ivory stock, gold fittings, seven tines on the prod',
    mats: {
      'xbow-wood': { color: 0xe6d8b8, roughness: 0.55, envMapIntensity: 0.8 },
      'xbow-prod': { color: 0xcfb58a, roughness: 0.5, envMapIntensity: 0.9 },
      'xbow-iron': { color: BRASS, roughness: 0.35, metalness: 1, envMapIntensity: 1.3 },
      'xbow-brass': { color: BRASS, roughness: 0.3, envMapIntensity: 1.4 },
      'xbow-leather': { color: 0x5a2b1c, roughness: 0.8 },
      'xbow-cord': { color: 0xf2e2b0 },
    },
  },
  'warden': {
    id: 'warden', weapon: 'crossbow', name: 'Warden', blurb: 'bark-bound limbs, amber in the grain, it hums at night',
    mats: {
      'xbow-wood': { color: 0x2e241a, roughness: 1, emissive: 0xff8a2a, emissiveIntensity: 0.06 },
      'xbow-prod': { color: 0x3a2f22, roughness: 0.9 },
      'xbow-iron': { color: 0x1f1c18, roughness: 0.8 },
      'xbow-brass': { color: 0xffa040, emissive: 0xff8a2a, emissiveIntensity: 0.5, roughness: 0.5 },
      'xbow-leather': { color: 0x3b4a22, roughness: 1 },
      'xbow-cord': { color: 0xffc070, emissive: 0xff9a3a, emissiveIntensity: 0.9 },
    },
  },
  'scarback-furnace': {
    id: 'scarback-furnace', weapon: 'rifle', name: 'Scarback Furnace', blurb: 'forge-black steel, molten light through the vents',
    mats: {
      'rifle-alu': { color: 0x0c0d11, roughness: 0.7, metalness: 1, envMapIntensity: 1.1, emissive: EMBER, emissiveIntensity: 0.12 },
      'rifle-poly': { color: 0x2b1d16, metalness: 0, roughness: 0.95 },
      'rifle-steel': { color: 0x101114, roughness: 0.6, emissive: EMBER, emissiveIntensity: 0.25 },
      'rifle-brass': { color: BRASS, roughness: 0.35, envMapIntensity: 1.3 },
      'lever-steel': { color: 0x0c0d11, roughness: 0.7, metalness: 1, envMapIntensity: 1.1, emissive: EMBER, emissiveIntensity: 0.16 },
      'lever-wood': { color: 0x2b1d16, metalness: 0, roughness: 0.95 },
      'lever-brass': { color: BRASS, roughness: 0.35, envMapIntensity: 1.3 },
    },
  },
};

export const PINE_FINISHES: readonly SkinDef[] = Object.values(SKINS);

/** Ghost Stag: antler tines growing up and back from the prod (the limb curve from Crossbow.ts) */
function antlerTines(root: THREE.Object3D, mat: THREE.Material | undefined): THREE.Object3D[] {
  if (!mat) return [];
  const tipL = new THREE.Vector3(-0.335, 0.004, -0.205), tipR = new THREE.Vector3(0.335, 0.004, -0.205);
  const curve = new THREE.CatmullRomCurve3([tipL, new THREE.Vector3(-0.2, 0.002, -0.275), new THREE.Vector3(0, 0, -0.305), new THREE.Vector3(0.2, 0.002, -0.275), tipR], false, 'catmullrom', 0.5);
  const group = new THREE.Group(); group.name = 'skin-antlers';
  const cone = new THREE.ConeGeometry(1, 1, 7, 1); cone.translate(0, 0.5, 0); // unit tine, base at the origin, pointing +Y
  cone.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cone.getAttribute('position').count * 3).fill(1), 3)); // in case the material reads vertex colours
  const tines: [number, number, number, number][] = [ // [t along the limb, length, lean back (rad), lean out (rad)]
    [0.02, 0.085, 0.55, -0.35], [0.1, 0.07, 0.35, -0.2], [0.2, 0.06, 0.15, 0], [0.31, 0.045, 0.05, 0.15],
  ];
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const side of [0, 1]) for (const [t0, len, back, out] of tines) {
    const t = side ? 1 - t0 : t0;
    const p = curve.getPoint(t);
    const m = new THREE.Mesh(cone, mat);
    m.position.copy(p).add(up.clone().multiplyScalar(0.006));
    m.scale.set(0.007, len, 0.005);
    e.set(back, 0, side ? -out : out); m.quaternion.copy(q.setFromEuler(e));
    group.add(m);
    // a short fork on the two longest tines
    if (len > 0.065) {
      const f = new THREE.Mesh(cone, mat);
      f.position.copy(p).add(up.clone().multiplyScalar(len * 0.45));
      f.scale.set(0.005, len * 0.45, 0.004);
      e.set(back + 0.9, 0, side ? -(out + 0.5) : out + 0.5); f.quaternion.copy(q.setFromEuler(e));
      group.add(f);
    }
  }
  root.add(group);
  return [group];
}

