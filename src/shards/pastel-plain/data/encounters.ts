/** The existing elite and two-phase teaching boss as phase tables; the legacy classes leave at SF16. */
export const ENCOUNTERS = [
  { id: 'pastel.elite', entity: 'greyback', kind: 'elite', panel: null, name: 'Greyback', title: 'Greyback', retry: 'Try Greyback again',
    arena: { at: [15, 0, -12], radius: 15 }, intro: 0, introShort: 0, respawn: { at: [0, 0, 0], yaw: 0 },
    phases: [{ at: 1, name: 'First phase', caption: 'First phase', speed: 2, stopDistance: 2, turnRate: 3 }] },
  { id: 'pastel.boss', entity: 'big-blob', kind: 'boss', panel: 'big-blob-panel', name: 'Big blob', title: 'Two-phase teaching encounter', retry: 'Try the big blob again',
    arena: { at: [-15, 0, -20], radius: 8 }, intro: 1, introShort: 0.2, respawn: { at: [0, 0, 0], yaw: 0 },
    phases: [{ at: 1, name: 'First phase', caption: 'First phase', speed: 1, stopDistance: 0, turnRate: 4 },
      { at: 0.5, name: 'Second phase', caption: 'Second phase', speed: 2.5, stopDistance: 0, turnRate: 4 }] },
];

/** Shared SF7f panel; the loader mounts it once and binds it to the declared boss. */
export const ENCOUNTER_UI = [{ kind: 'bossPanel', id: 'big-blob-panel', encounter: 'pastel.boss',
  name: 'Big blob', title: 'Two-phase teaching encounter', retry: 'Try the big blob again' }];
