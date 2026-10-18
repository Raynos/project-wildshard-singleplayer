import type { UniformRows } from '@wildshard/sdk/looks/shaderFamily';

export interface VmUniformRows extends UniformRows {
  readonly uPal: { readonly rgbs: readonly number[] };
  readonly uKey: { readonly v3: readonly [number, number, number]; readonly normalize: true; };
  readonly uInk: { readonly rgb: number };
  readonly uLinePx: number;
  readonly uSutra: number;
  readonly uGold: { readonly rgb: number };
  readonly uEnvHi: { readonly rgb: number };
  readonly uEnvLo: { readonly rgb: number };
  readonly uBladeA: { readonly v3: readonly [number, number, number]; };
  readonly uBladeB: { readonly v3: readonly [number, number, number]; };
  readonly uSpill: { readonly v4: readonly [number, number, number, number]; };
  readonly uTune: { readonly v4: readonly [number, number, number, number]; };
  readonly uExposure: number;
  readonly uDetail: number;
  readonly uRes: { readonly v2: readonly [number, number]; };
  readonly uHullPx: number;
  readonly uTime: number;
}
