import type { LoadingReport } from '../admin-data/types.mjs';

export interface SafariData {
  origin: number; installedAt: number; url: string; play: number; observerSupported: boolean;
  steps: readonly { at: number; phase: string }[];
  tasks: readonly { at: number; duration: number }[];
}
export interface SafariCapture { shard: string; cache: 'cold' | 'warm'; status: string; tapEpoch: number; data?: SafariData }
export function safariRecorder(): void;
export function safariReport(pin: string, captures: readonly SafariCapture[]): LoadingReport;
