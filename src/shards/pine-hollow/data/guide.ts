/** Breadcrumb schedule and centre-distance target range; the flock owns its flight. */
export const PINE_GUIDE = { distance: 'centre', min: 40, max: 450, schedule: { kind: 'periodic', initial: 25, period: [90, 150] } } as const;
