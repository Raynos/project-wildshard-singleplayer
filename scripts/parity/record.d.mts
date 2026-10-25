import type { Page } from 'playwright';
import type { RecordValue } from './value.mjs';

export function aggregate(page: Page, runs: RecordValue[], meta: {sha: string; browser: string}): Promise<RecordValue>;
export function acceptFields(baseline: RecordValue, current: RecordValue, fields: string[]): RecordValue;
export function imageScore(page: Page, golden: string, current: string, masks: number[][]): Promise<{ssim: number | null; diff?: Uint8Array; full?: number; masked?: number; note: string | null}>;
export function writeBaseline(root: string, lane: string, shard: string, tier: string, baseline: RecordValue, fields: string[] | undefined): void;
