import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, VignetteEffect, ToneMappingEffect,
  ToneMappingMode, BlendFunction, GodRaysEffect, KernelSize, SMAAPreset, EdgeDetectionMode, ChromaticAberrationEffect, HueSaturationEffect, BrightnessContrastEffect, NoiseEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { installAtmosphere } from '../world/Atmosphere';
import { setAnisotropy } from './assets';
import { Sky } from '../world/Sky';
import { GradeEffect } from './Grade';
import { VolumetricsEffect, makeNoiseTexture } from './Volumetrics';
import { getActiveChunk } from '../chunks/registry';

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer!: EffectComposer;
  sky!: Sky;
  clock = new THREE.Clock();
  private updaters: ((dt: number, t: number) => void)[] = [];
  stats = { fps: 0, frames: 0, acc: 0 };
  private renderPass!: RenderPass;
  volumetrics!: VolumetricsEffect;

  constructor(public canvas: HTMLCanvasElement) {
    installAtmosphere();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the composer
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setAnisotropy(this.renderer);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 2600);
    window.addEventListener('resize', () => this.resize());
  }

  async buildSky() {
    this.sky = await new Sky(this.scene, this.camera, this.renderer).build();
    return this.sky;
  }

  buildComposer() {
    const { grade: G, atmosphere: A } = getActiveChunk();
    const composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);

    const ao = new N8AOPostPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    ao.configuration.aoRadius = 2.5;
    ao.configuration.distanceFalloff = 1.0;
    ao.configuration.intensity = 2.5;
    ao.configuration.halfRes = true;
    ao.configuration.screenSpaceRadius = false;
    ao.configuration.gammaCorrection = false;
    ao.configuration.color = new THREE.Color(0.05, 0.06, 0.05);
    composer.addPass(ao);

    const vol = new VolumetricsEffect(this.camera, makeNoiseTexture());
    vol.setSun(this.sky.sunDir, new THREE.Color(...A.volumetricSunColor));
    if (this.scene.fog) vol.setFogColor((this.scene.fog as THREE.Fog).color);
    this.volumetrics = vol;
    const godRays = new GodRaysEffect(this.camera, this.sky.sunDisc, {
      blendFunction: BlendFunction.SCREEN, kernelSize: KernelSize.MEDIUM, density: 0.96, decay: 0.95, weight: 0.5,
      exposure: 0.4, samples: 60, clampMax: 1.0, resolutionScale: 0.5,
    });
    const bloom = new BloomEffect({ intensity: G.bloomIntensity, luminanceThreshold: G.bloomThreshold, luminanceSmoothing: 0.3, mipmapBlur: true, radius: 0.6 });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
    const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.35 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    const grade = new HueSaturationEffect({ saturation: G.saturation });
    const contrast = new BrightnessContrastEffect({ brightness: G.brightness, contrast: G.contrast });
    const split = new GradeEffect(G);
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    grain.blendMode.opacity.value = 0.12;
    composer.addPass(new EffectPass(this.camera, vol));
    composer.addPass(new EffectPass(this.camera, godRays, bloom, chroma, vignette, tone, grade, contrast, split, grain));
    const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH, edgeDetectionMode: EdgeDetectionMode.COLOR });
    composer.addPass(new EffectPass(this.camera, smaa));
    this.composer = composer;
  }

  onUpdate(fn: (dt: number, t: number) => void) { this.updaters.push(fn); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.sky?.csm?.updateFrustums();
  }

  start() {
    this.clock.start();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, this.clock.getDelta());
      const t = this.clock.elapsedTime;
      for (const u of this.updaters) u(dt, t);
      this.sky?.update(dt);
      // planet + sun disc travel with the camera so they stay "infinitely" far
      if (this.sky) { this.sky.clouds.position.copy(this.camera.position); this.sky.planet.position.copy(this.camera.position).addScaledVector(this.sky.planetDir, 1700); this.sky.sunDisc.position.copy(this.camera.position).addScaledVector(this.sky.sunDir, 1500); }
      this.composer.render(dt);
      this.stats.frames++; this.stats.acc += dt;
      if (this.stats.acc >= 0.5) { this.stats.fps = Math.round(this.stats.frames / this.stats.acc); this.stats.frames = 0; this.stats.acc = 0; }
    };
    loop();
  }
}
