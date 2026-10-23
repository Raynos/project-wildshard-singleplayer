import { parseEliteEntryRows, ELITE_BODY_COLUMNS, ELITE_CONDITION_COLUMNS, type EliteEntryRows, parseEliteEntryPageRows, type EliteEntryPageRows } from '@wildshard/format/eliteEntryRows';
import { parseEliteOutputActions, type EliteOutputAction } from '@wildshard/format/eliteFeature';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import roster from '../data/eliteRoster.json' with { type: 'json' };
import charge from '../data/eliteCharge.generated.json' with { type: 'json' };
import strikes from '../data/strikeProfiles.generated.json' with { type: 'json' };
import { strike } from '@wildshard/sdk/species';

type Action = { [K in EliteOutputAction['kind']]: Omit<Extract<EliteOutputAction, { kind: K }>, 'id'> }[EliteOutputAction['kind']];
/** Fixed construction, condition and effect selections are content. Native
 * kernels and the original guest/controller owners remain platform authorities. */
export function buildEliteEntryRows(): {
  readonly rows: EliteEntryRows; readonly actions: readonly EliteOutputAction[];
  readonly observations: readonly { readonly id: string; readonly rows: typeof ELITE_BODY_COLUMNS | typeof ELITE_CONDITION_COLUMNS }[];
} {
  const actions: EliteOutputAction[] = [], ids = new Map<string, number>(), entries: EliteEntryRows['entries'] = [];
  const add = (action: Action): number => {
    const key = encodeCanonicalJson(action), previous = ids.get(key);
    if (previous !== undefined) return previous;
    const id = actions.length + 1; actions.push({ ...action, id }); ids.set(key, id); return id;
  };
  const observations: { id: string; rows: typeof ELITE_BODY_COLUMNS | typeof ELITE_CONDITION_COLUMNS }[] = [{ id: 'elite.conditions', rows: ELITE_CONDITION_COLUMNS }];
  for (const row of ecology.keeperElites) {
    const controller = entries.length, profile = row.def.id;
    const amounts = row.pattern === 'pouncer' ? [row.spec.swipe.damage, row.spec.pounce.damage] : [row.pattern === 'howler' ? row.spec.bite.damage : row.spec.stoop.damage];
    const contacts = [...new Set(amounts)].map(amount => ({ amount, action: add({ controller, kind: 'contact', amount }) }));
    const named = (kind: 'feed' | 'sound', name: string): number => {
      const value = (kind === 'feed' ? row.messages : row.voices)[name];
      if (value === undefined) throw new Error(`Missing elite ${kind}: ${profile}/${name}`);
      return add(kind === 'feed' ? { controller, kind, text: value } : { controller, kind, cue: value });
    };
    const common = { profile, body: 'animals', model: profile, observations: `${profile}.inputs`,
      spawn: { kind: row.kind, variant: row.def.id, yaw: row.yaw, offset: row.offset, memory: row.memory }, contacts };
    if (row.pattern === 'pouncer') entries.push({ id: profile, condition: row.def.rule, controller: { kind: 'pouncer', ...common,
      knock: add({ controller, kind: 'knockdown', duration: roster.knockDuration }), opened: named('feed', 'opened'), growl: named('sound', 'growl') } });
    else if (row.pattern === 'howler') entries.push({ id: profile, condition: row.def.rule, controller: { kind: 'howler', ...common,
      regrouped: named('feed', 'regrouped'), interrupted: named('feed', 'interrupted'), closed: named('feed', 'closed'), howl: named('sound', 'howl') } });
    else entries.push({ id: profile, condition: row.def.rule, controller: { kind: 'wind', ...common,
      knock: add({ controller, kind: 'knockdown', duration: roster.knockDuration }), grounded: named('feed', 'grounded'), cry: named('sound', 'cry') } });
    if (row.pack !== undefined) add({ controller, kind: 'wildlife-pack', variants: row.pack.variants });
    observations.push({ id: `${profile}.inputs`, rows: ELITE_BODY_COLUMNS });
  }
  for (const row of ecology.externalElites) {
    const controller = entries.length;
    entries.push({ id: row.def.id, condition: row.def.rule, controller: { kind: 'borrowed', controller: row.def.id } });
    if (row.mode === 'script') {
      add({ controller, kind: 'patrol-rider', variant: row.spawn.variant }); add({ controller, kind: 'patrol-line' }); add({ controller, kind: 'patrol-dissolve' });
      for (const contact of charge.strikes) add({ controller, kind: 'contact', amount: contact.row.damage });
      add({ controller, kind: 'knockdown', duration: roster.knockDuration });
      for (const cue of Object.values(row.cues)) {
        if (cue.voice !== undefined) add({ controller, kind: 'sound', cue: cue.voice });
        if (cue.feed !== undefined) add({ controller, kind: 'feed', text: cue.feed });
      }
    } else {
      add({ controller, kind: 'wildlife-herd', actorKind: row.spawn.kind, variant: row.spawn.variant, offset: row.spawn.offset,
        mares: row.spawn.mares, foals: row.spawn.foals, stallion: row.spawn.stallion });
      add({ controller, kind: 'record', actorKind: row.adopted.kind, variant: row.adopted.variant });
      add({ controller, kind: 'feed', text: row.adopted.feed });
    }
  }
  const rows = parseEliteEntryRows({ version: 1, id: 'nalati.elites', ui: 'elite.ui', conditionObservations: 'elite.conditions',
    conditions: roster.conditions.map(row => ({ id: row.id, program: 'elite.rules', signal: row.signal, observations: Object.entries(row.observations).map(([field, value]) => ({ field, value })) })), entries });
  return { rows, actions: parseEliteOutputActions(actions, entries.length), observations };
}

/** The existing assembly carries one admitted owner selection, replacing the
 * retired page roster bootstrap without adding a second section or clock. */
export function buildEliteEntryPageRows(): EliteEntryPageRows {
  const { rows: entry, actions, observations } = buildEliteEntryRows();
  return parseEliteEntryPageRows({ entry, actions, observations,
    profiles: ecology.keeperElites.map(value => ({ id: value.def.id, value })), borrowed: ecology.externalElites,
    presentation: Object.fromEntries(Object.values(ecology.elites).map(def => [def.id, {
      prompt: `Take the ${def.drop.skinName} ${def.drop.weapon} skin`, toast: `${def.drop.skinName} ${def.drop.weapon} skin — ${def.drop.blurb}`, hum: true,
      sting: { banner: .8, phase2: 1, kill: 'chunk' },
    }])), strikes: [{ amount: 14, strike: strike(strikes.swipe) }, { amount: 35, strike: strike(strikes.pounce) },
      { amount: 22, strike: strike(strikes.bite) }, { amount: 30, strike: strike(strikes.stoop) }],
    fallbackStrike: strike(strikes.captain), prewarm: roster.prewarm, debug: roster.debug });
}
