import type { GeneratedMeasurement } from './generated-policy.mjs';

export interface GeneratedCandidate { outputs: Record<string, string>; measurement: GeneratedMeasurement }
export function generatedFiles(root: string): GeneratedCandidate;
export function checkGenerated(root: string, predecessor: GeneratedMeasurement, message: string): GeneratedCandidate;
