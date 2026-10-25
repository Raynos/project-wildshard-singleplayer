export interface ArtObservation { rows: { src: string; ok: boolean }[] }
export interface UpdateProgressEvent {
  kind: string; host: number; origin?: number; phase?: string; fact?: string;
}
export interface UpdateObservation {
  base: string;
  oldVersion: { build: string };
  newVersion: { build: string };
  switchHost: number;
  afterState: { rows: { kind: string; host: number }[] };
  staleArt: ArtObservation;
  afterArt: ArtObservation;
  templateTapHost: number;
  templateReadyHost: number;
  templateState: { accuracy: { final: { rows: { key?: string; ms?: string }[] } | null } };
  transport: { url: string; endedAt: number; status: number; bodyBytes: number; bodySHA256?: string; bodyEncoding?: string }[];
}
export interface TrafficObservation {
  responsesEnded: number;
  bodyBytes: number;
  sameURLBodyBytes: number;
  unchangedBodyBytes: number;
  changedBodyBytes: number;
  unknownBodyBytes: number;
  failures: { url: string; status: number }[];
}
export function updateReport(data: UpdateObservation): {
  oldBuild: string; newBuild: string;
  adoptionMs: number; reloadToInlineMs: number; inlineToReadyMs: number;
  readyToPaintMs: number; tapToPaintMs: number;
  staleArt: { unique: number; failed: string[] };
  newArt: { unique: number; failed: string[] };
  installAndStaleInspection: TrafficObservation;
  update: TrafficObservation;
  template: { tapToReadyMs: number; admissionMs: number | null; traffic: TrafficObservation };
  limits: string;
};
export function updateProgressReport(rows: readonly UpdateProgressEvent[]): {
  pass: boolean; firstModalDomMs: number; tapToPaintMs: number; longestGapMs: number;
  actualChanges: number; phases: (string | undefined)[]; finalFact: string; limits: string;
};
