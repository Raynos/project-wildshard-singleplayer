/**
 * A faceted gradient sky as a look-family system (SHARD-PLATFORM M3, W2 C2): one back-faced dome and one merged ring of
 * faceted cumulus, both drawn by the shard's material graphs (unlit, fogless; data/skyLook.ts), compiled from its look
 * catalogue on the page renderer when the backdrop builds. The day / night clock writes the palette (`setPalette`) into `u`, a plain table other systems read
 * by reference (the horizon matte), and through each graph's checked `setParam`. Nothing here knows a shard: the shard passes
 * its graphs, its palette and the ring's puff rows.
 *
 *   const s = new FacetedSky(sunDir, palette, puffs).build(looks);   // s.dome follows the camera; the clouds ride it
 *   s.envScene                                                     // a copy of the dome at the origin for PMREM (IBL specular)
 *
 * - **dome**: one sphere (r 2200 m), back faces, no depth test or write; renderOrder −20.
 * - **cumulus**: one icosahedron instanced per puff row on a ring 900–1700 m out; its graph lumps, squashes and flattens
 *   each puff and turns the ring slowly on the frame clock. Transparent so it is drawn after the world (depth-tested
 *   against it), renderOrder −15. One draw.
 */
import * as THREE from 'three';

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

  /** `palette`: the starting colours (copied); `puffs`: the cumulus ring's rows `[x, y, z, r, puff, cluster, baseY]` */
  constructor(sunDir: THREE.Vector3, palette: SkyPalette, private readonly puffs: readonly (readonly number[])[]) {
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

    this.clouds = new THREE.Mesh(cumulusGeometry(this.puffs), looks.clouds);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -15;
    this.dome.add(this.clouds);
    return this;
  }
}

/** The cumulus ring: one icosahedron instanced per puff row (`aPuff` centre + radius, `aLump` phases + base cut). */
function cumulusGeometry(puffs: readonly (readonly number[])[]): THREE.InstancedBufferGeometry {
  if (puffs.length === 0 || puffs.some(row => row.length !== 7)) throw new Error('faceted sky: the cumulus rows must be [x, y, z, r, puff, cluster, baseY]');
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.IcosahedronGeometry(1, 1).getAttribute('position'));
  geo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(new Float32Array(puffs.flatMap(row => row.slice(0, 4))), 4));
  geo.setAttribute('aLump', new THREE.InstancedBufferAttribute(new Float32Array(puffs.flatMap(row => row.slice(4))), 3));
  geo.instanceCount = puffs.length;
  return geo;
}
