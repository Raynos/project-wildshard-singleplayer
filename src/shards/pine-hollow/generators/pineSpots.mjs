// The native quest's constructed prompt roster, with no draw or fixed tick.
const ROWS = ['dam-log-a', 'dam-log-b', 'dam-sluice', 'pond-glass', 'ridge-flint', 'lookout-bench',
  ...Array.from({ length: 30 }, (_, index) => `resin-${index + 1}`), ...Array.from({ length: 8 }, (_, index) => `token-${index + 1}`)];

/** Read the real quest kit, speakers, lanterns, zipline and rifle interactable in authored order. */
export function readPineSpots(q, interactables) {
  const rows = ROWS;
    const xyz = p => ({ x: p.x, y: p.y, z: p.z });
    const kit = rows.map(id => {
      const lv = q.kit.lives.find(l => l.def.id === id);
      if (lv === undefined) throw new Error(`Pine kit has no row ${id}`);
      const result = { id, kind: lv.def.kind };
      return Object.assign(result, xyz(lv.position), { yaw: lv.yaw, prompt: lv.prompt ? xyz(lv.prompt.position) : null });
    });
    const ranger = q.people.find(p => p.kind === 'ranger');
    if (ranger === undefined) throw new Error('Pine has one Hale prompt');
    const people = ['ranger', 'miller', 'trader'].map(kind => {
      const matches = q.people.filter(person => person.kind === kind), person = matches[0];
      if (matches.length !== 1 || person === undefined) throw new Error(`Pine has one ${kind} prompt`);
      return { kind, prompt: { ...xyz(person.prompt.position), radius: person.prompt.radius }, at: xyz(person.fig.talkPoint) };
    });
    const boards = interactables.filter(p => p.label.startsWith('Read the contract board'));
    if (boards.length !== 1) throw new Error('Pine has one contract board prompt');
    const board = { ...xyz(boards[0].position), radius: boards[0].radius };
    const lanterns = Object.fromEntries(['pond', 'ridge', 'den'].map(id => [id, { ...xyz(q.lanterns[id].position), radius: q.lanterns[id].radius }]));
    const zip = q.zip;
    const rifle = interactables.filter(p => p.label === 'Take the lever-action');
    if (rifle.length !== 1) throw new Error('Pine has one lever-action pickup');
    return {
      rows: kit, people, board, talk: { ...xyz(ranger.prompt.position), radius: ranger.prompt.radius }, lanterns,
      zip: { prompt: { ...xyz(zip.prompt.position), radius: zip.prompt.radius }, top: xyz(zip.wire.top), bottom: xyz(zip.wire.bottom), landing: xyz(zip.landing) },
      rifle: { ...xyz(rifle[0].position), radius: rifle[0].radius },
    };
}
