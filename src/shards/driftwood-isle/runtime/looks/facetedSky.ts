/**
 * A faceted gradient sky as a look-family system (SHARD-PLATFORM M3, W2 C2): one back-faced dome and one merged ring of
 * faceted cumulus, both drawn by the shard's material graphs (unlit, fogless; data/skyLook.ts), compiled from its look
 * catalogue on the page renderer when the backdrop builds. The day / night clock writes the palette (`setPalette`) into `u`, a plain table other systems read
 * by reference (the horizon matte), and through each graph's checked `setParam`. Nothing here knows a shard: the shard passes
 * its graphs, its palette and the ring's seed.
 *
 *   const s = new FacetedSky(sunDir, palette, seed).build(looks);   // s.dome follows the camera; the clouds ride it
 *   s.envScene                                                     // a copy of the dome at the origin for PMREM (IBL specular)
 *
 * - **dome**: one sphere (r 2200 m), back faces, no depth test or write; renderOrder −20.
 * - **cumulus**: one merged mesh of faceted puffs (icosahedra, flattened bases, an `aBelly` attribute on the undersides) on
 *   a ring 900–1700 m out; transparent so it is drawn after the world (depth-tested against it), renderOrder −15. One draw.
 *   Its graph turns it slowly on the frame clock.
 */
import * as THREE from 'three';
import { Rng } from '@wildshard/engine/core/rng';

/** the sky's palette (linear, pre-tonemap); a day / night clock lerps these per preset */
export interface SkyPalette {
  zenith: THREE.Color; horizon: THREE.Color; below: THREE.Color; sunGlow: THREE.Color;
  cloudLit: THREE.Color; cloudShade: THREE.Color; night: number;
}

/** a faceted sky's two compiled graph materials (params: the palette's colours as vec3s, `night`, `sunDir`) */
export interface FacetedSkyLooks {
  readonly dome: THREE.Material;
  readonly clouds: THREE.Material;
  /** write one of the two materials' graph uniforms (checked before it moves anything; no program change) */
  readonly setParam: (part: 'dome' | 'clouds', name: string, value: number | number[]) => void;
}

/** A stylized faceted sky dome with a cumulus ring, coloured from a shard's palette. */
export class FacetedSky {
  dome!: THREE.Mesh;
  clouds!: THREE.Mesh;
  envScene = new THREE.Scene();
  /** the live palette, read by reference elsewhere; write it through `setPalette` */
  readonly u: {
    uZenith: { value: THREE.Color }; uHorizon: { value: THREE.Color }; uBelow: { value: THREE.Color }; uSunGlow: { value: THREE.Color };
    uCloudLit: { value: THREE.Color }; uCloudShade: { value: THREE.Color }; uNight: { value: number }; uSunDir: { value: THREE.Vector3 };
  };
  /** the PMREM scene's copy of the dome material (the owner frees it) */
  private looks: FacetedSkyLooks | null = null;
  private readonly out: number[] = [0, 0, 0];

  /** `palette`: the starting colours (copied); `seed`: the cumulus ring's layout */
  constructor(sunDir: THREE.Vector3, palette: SkyPalette, private readonly seed: number) {
    this.u = {
      uZenith: { value: palette.zenith.clone() }, uHorizon: { value: palette.horizon.clone() }, uBelow: { value: palette.below.clone() },
      uSunGlow: { value: palette.sunGlow.clone() }, uCloudLit: { value: palette.cloudLit.clone() }, uCloudShade: { value: palette.cloudShade.clone() },
      uNight: { value: 0 }, uSunDir: { value: sunDir.clone() },
    };
  }

  /** set every palette colour from a preset (DayNight blends two presets into a scratch palette first) and the sun's direction */
  setPalette(p: SkyPalette, sunDir: THREE.Vector3): void {
    const u = this.u;
    u.uZenith.value.copy(p.zenith); u.uHorizon.value.copy(p.horizon); u.uBelow.value.copy(p.below);
    u.uSunGlow.value.copy(p.sunGlow); u.uCloudLit.value.copy(p.cloudLit); u.uCloudShade.value.copy(p.cloudShade);
    u.uNight.value = p.night; u.uSunDir.value.copy(sunDir);
    this.push();
  }

  /** the palette into both graphs' uniforms (no program changes) */
  private push(): void {
    const looks = this.looks;
    if (looks === null) return;
    const u = this.u, out = this.out;
    const set = (part: 'dome' | 'clouds', name: string, v: THREE.Color | THREE.Vector3): void => { looks.setParam(part, name, v.toArray(out)); };
    set('dome', 'zenith', u.uZenith.value); set('dome', 'horizon', u.uHorizon.value); set('dome', 'below', u.uBelow.value);
    set('dome', 'sunGlow', u.uSunGlow.value); set('dome', 'sunDir', u.uSunDir.value); looks.setParam('dome', 'night', u.uNight.value);
    set('clouds', 'cloudLit', u.uCloudLit.value); set('clouds', 'cloudShade', u.uCloudShade.value); set('clouds', 'horizon', u.uHorizon.value);
    set('clouds', 'sunGlow', u.uSunGlow.value); set('clouds', 'sunDir', u.uSunDir.value);
  }

  /** take the compiled graphs: drawn as the GLSL programs were, behind everything and untouched by the material's tone map
   *  (the post chain grades it), with the palette pushed in */
  private adoptLooks(looks: FacetedSkyLooks): THREE.Material {
    this.looks = looks;
    const domeMat = looks.dome;
    domeMat.side = THREE.BackSide; domeMat.depthTest = false; domeMat.toneMapped = false;
    looks.clouds.toneMapped = false;
    this.push();
    return domeMat;
  }

  build(looks: FacetedSkyLooks): this {
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(2200, 48, 24), this.adoptLooks(looks));
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -20;
    // The node handler keeps the main/composer and environment programs' uniforms paired.
    this.envScene.add(new THREE.Mesh(this.dome.geometry, looks.dome));

    this.clouds = new THREE.Mesh(buildCumulus(this.seed), looks.clouds);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -15;
    this.dome.add(this.clouds);
    return this;
  }
}

/**
 * The cumulus ring: 22 clusters of 5–11 icosahedron puffs each, bigger and lower toward the horizon, bases cut flat.
 * Non-indexed with flat normals, plus an `aBelly` attribute (1 on the underside) for the darker bases.
 */
function buildCumulus(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const pos: number[] = [], nrm: number[] = [], belly: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const clusters = 22;
  for (let k = 0; k < clusters; k++) {
    const az = (k / clusters) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const dist = rng.range(900, 1700);
    const elev = rng.range(0.05, 0.22) * (k % 3 === 0 ? 1.9 : 1);                // a few ride high in the sky
    const baseY = Math.tan(elev) * dist * 0.75;
    const cx = Math.cos(az) * dist, cz = Math.sin(az) * dist;
    const tx = -Math.sin(az), tz = Math.cos(az);                                    // along the ring (the cluster spreads sideways)
    const size = rng.range(1.1, 2.1) * (dist / 1000);
    const puffs = rng.int(6, 12);
    for (let i = 0; i < puffs; i++) {
      const along = rng.range(-1, 1) * 110 * size;
      const mid = 1 - Math.abs(along) / (170 * size);                              // the middle puffs are the big, tall ones
      const r = rng.range(26, 58) * size * mid;
      const px = cx + tx * along + rng.range(-20, 20) * size, pz = cz + tz * along + rng.range(-20, 20) * size;
      const py = baseY + r * rng.range(0.35, 0.8) + mid * mid * rng.range(0, 55) * size;   // towers
      const g = new THREE.IcosahedronGeometry(Math.max(8, r), 1);
      const ps = g.getAttribute('position');
      for (let v = 0; v < ps.count; v++) {
        let x = ps.getX(v), y = ps.getY(v), z = ps.getZ(v);
        const kk = 1 + (Math.sin(x * 0.13 + i) * Math.cos(z * 0.11 + k)) * 0.12;   // lumpy
        x *= kk * 1.15; y *= kk * 0.8; z *= kk * 1.15;
        y = Math.max(y + py, baseY);                                                 // flat bases
        ps.setXYZ(v, x + px, y, z + pz);
      }
      const p = ps; // polyhedra are non-indexed already
      for (let f = 0; f < p.count; f += 3) {
        a.fromBufferAttribute(p, f); b.fromBufferAttribute(p, f + 1); c.fromBufferAttribute(p, f + 2);
        n.subVectors(c, b).cross(b.clone().sub(a)).normalize();
        if (n.lengthSq() < 0.5) continue;
        const bel = (a.y + b.y + c.y) / 3 < baseY + 2 ? 1 : 0;
        for (const q of [a, b, c]) { pos.push(q.x, q.y, q.z); nrm.push(-n.x, -n.y, -n.z); belly.push(bel); }
      }
      g.dispose();
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aBelly', new THREE.Float32BufferAttribute(belly, 1));
  return geo;
}
