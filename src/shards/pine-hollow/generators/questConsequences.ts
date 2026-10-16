import { PINE_SKY } from '../data/sky';

/** Ordered page consequences; native NPC, encounter and clock owners decide when these run. */
export const PINE_QUEST_CONSEQUENCES = {
  actions: [
    { id: 'miller.pay', after: [
      { kind: 'call', target: 'miller.paid' },
      { kind: 'call', target: 'miller.ribbons' },
      { kind: 'call', target: 'miller.resin' },
      { kind: 'toast', text: 'Brandt pays · 3 lodge ribbons · 4 amber resin' },
      { kind: 'call', target: 'pickup' },
    ] },
    { id: 'errand.complete', after: [
      { kind: 'call', target: 'errand.flag' },
      { kind: 'call', target: 'wheel.sync' },
      { kind: 'toast', text: 'The last of them goes down in the race. Behind you the mill wheel shudders, and turns' },
      { kind: 'call', target: 'chunk' },
    ] },
    { id: 'stag.appear', after: [
      { kind: 'toast', text: 'On the west road, something pale is standing very still' },
    ] },
    { id: 'stag.complete', after: [
      { kind: 'call', target: 'stag.flag' },
      { kind: 'toast', text: 'The stag is gone. Ahead, the standing stones, and the fog between them' },
    ] },
  ],
  bindings: { calls: [
    { target: 'miller.paid', owner: 'flags', path: ['set'], args: ['errand:paid'] },
    { target: 'miller.ribbons', owner: 'inventory', path: ['add'], args: ['lodge-ribbon', 3] },
    { target: 'miller.resin', owner: 'inventory', path: ['add'], args: ['amber-resin', 4] },
    { target: 'pickup', owner: 'music', path: ['sting'], args: ['pickup'] },
    { target: 'errand.flag', owner: 'flags', path: ['set'], args: ['errand:done'] },
    { target: 'wheel.sync', owner: 'native', path: ['syncWheel'] },
    { target: 'chunk', owner: 'music', path: ['sting'], args: ['chunk'] },
    { target: 'stag.flag', owner: 'flags', path: ['set'], args: ['followed:stag'] },
  ] },
} as const;

/** These events and their fixed durations are published by the admitted native watch handler. */
export const PINE_CLOCK_CONSEQUENCES = {
  actions: [
    { id: 'night.consume', after: [{ kind: 'call', target: 'night.consume' }] },
    { id: 'night.start', after: [
      { kind: 'toast', text: 'You sit with Hale on the porch while the light goes out of the Hollow…' },
      { kind: 'call', target: 'night.forward' },
    ] },
    { id: 'dawn.start', after: [
      { kind: 'toast', text: 'The Antler King falls. In the east, the sky is going grey' },
    ] },
    { id: 'dawn.sunrise', after: [{ kind: 'call', target: 'dawn.forward' }] },
    { id: 'dawn.lanterns', after: [
      { kind: 'call', target: 'pond.flag' }, { kind: 'call', target: 'ridge.flag' }, { kind: 'call', target: 'den.flag' },
      { kind: 'call', target: 'pond.light' }, { kind: 'call', target: 'ridge.light' }, { kind: 'call', target: 'den.light' },
      { kind: 'call', target: 'dawn.sting' },
    ] },
    { id: 'dawn.caption', after: [{ kind: 'call', target: 'caption.show' }, { kind: 'call', target: 'objective.hide' }] },
    { id: 'dawn.finish', after: [
      { kind: 'call', target: 'caption.hide' }, { kind: 'call', target: 'objective.show' },
      { kind: 'call', target: 'dawn.resin' },
      { kind: 'toast', text: "Hale's thanks · 4 amber resin — and the Warden's bow is yours to keep" },
      { kind: 'call', target: 'dawn.seen' },
    ] },
  ],
  bindings: { calls: [
    { target: 'night.consume', owner: 'flags', path: ['clear'], args: ['wait:night'] },
    { target: 'night.forward', owner: 'native', path: ['fastForward'], args: [PINE_SKY.phases.night, 6] },
    { target: 'dawn.forward', owner: 'native', path: ['fastForward'], args: [PINE_SKY.phases.sunrise + 0.012, 7] },
    { target: 'pond.flag', owner: 'flags', path: ['set'], args: ['lit:pond'] },
    { target: 'ridge.flag', owner: 'flags', path: ['set'], args: ['lit:ridge'] },
    { target: 'den.flag', owner: 'flags', path: ['set'], args: ['lit:den'] },
    { target: 'pond.light', owner: 'lamps', path: ['setLit'], optional: true, args: ['pond', true] },
    { target: 'ridge.light', owner: 'lamps', path: ['setLit'], optional: true, args: ['ridge', true] },
    { target: 'den.light', owner: 'lamps', path: ['setLit'], optional: true, args: ['den', true] },
    { target: 'dawn.sting', owner: 'music', path: ['sting'], args: ['dawn'] },
    { target: 'caption.show', owner: 'caption', path: ['show'], args: [true] },
    { target: 'caption.hide', owner: 'caption', path: ['show'], args: [false] },
    { target: 'objective.hide', owner: 'objective', path: ['hide'], args: [true] },
    { target: 'objective.show', owner: 'objective', path: ['hide'], args: [false] },
    { target: 'dawn.resin', owner: 'inventory', path: ['add'], args: ['amber-resin', 4] },
    { target: 'dawn.seen', owner: 'flags', path: ['set'], args: ['seen:dawn'] },
  ] },
} as const;
