/** Detached installation receipt. Observation never supplies simulation or restoration authority. */
export function installNativeOwnerObservation(provenance?: { readonly synthetic: boolean; readonly clockOverlay?: boolean }): {
  schema: string;
  installed: { wallTime: number; frame: number; gameTime: number; alpha: number; phase: string; bout: number };
  clocks: string;
  scope: string;
  camera: string;
  clockOverlay: boolean;
  clockCorrelation: string;
  synthetic: boolean;
  modelAdmission: boolean;
};
