// Types for the pure part of scripts/ota-release.mjs (imported by test/native-updates.test.ts).

export interface OtaChannelConfig { origin: string; runtime: string; saveSchema: number; publicN: string }
export interface OtaReleaseSummary {
  bundleId: string;
  sequence: number;
  expiresAt: string;
  nativeMin: string;
  nativeMax: string;
  runtime: string;
  saveSchema: number;
  files: number;
  bytes: number;
  carried: number;
  kept: string[];
  platforms: Partial<Record<'ios' | 'android', string>>;
}
export interface SignedEnvelope { payload: string; signature: string }
export interface ReleasePlan {
  blobs: Map<string, Uint8Array<ArrayBuffer>>;
  manifests: Partial<Record<'ios' | 'android', SignedEnvelope>>;
  summary: OtaReleaseSummary;
}

export function parseOtaConfig(src: string): OtaChannelConfig;
export function signManifest(manifest: unknown, privateKeyPem: string): SignedEnvelope;
export function validName(name: string): boolean;
export function planRelease(options: {
  config: OtaChannelConfig;
  inputs: { name: string; bytes: Uint8Array }[];
  privateKeyPem: string;
  bundleId: string | undefined;
  sequence: number;
  nativeMin: string;
  nativeMax: string;
  expiresAt: string;
  platforms: string[];
  placeholder?: boolean;
}): ReleasePlan;
