import { parseFindsCatalogue } from '@wildshard/sdk/finds';
import policy from '../data/finds.json' with { type: 'json' };
import ecology from '../data/ecology.json' with { type: 'json' };
import feats from '../data/feats.json' with { type: 'json' };
import effects from '../data/weaponEffects.json' with { type: 'json' };
import content from '../data/questContent.json' with { type: 'json' };

/** Owned sticker metadata comes directly from authored elite drops and quest places.
 * Preserve policy order and the original strict catalogue admission, without a scheduler handoff. */
export function nalatiFindsCatalogue(): ReturnType<typeof parseFindsCatalogue> {
  const byId = new Map(Object.entries(ecology.elites));
  const elites = policy.elites.map(({ id, icon }) => {
    const elite = byId.get(id), skin = elite?.drop.skin ?? null;
    const name = skin === null ? null : effects.skins.find(row => row.id === skin)?.name ?? null;
    const title = feats.find(row => row.id === id)?.title ?? null;
    const prize = name === null ? policy.labels.horse : `${name} ${policy.labels.skin}`;
    return { label: elite?.name ?? id, icon, flag: policy.flags.elite + id, prize: title === null ? [prize] : [prize, title] };
  });
  const places = content.places.map(row => ({ label: row.label, icon: 'pin', flag: policy.flags.place + row.id }));
  return parseFindsCatalogue({ counters: [{ label: policy.labels.elites, flags: elites.map(row => row.flag) },
    { label: policy.labels.places, flags: places.map(row => row.flag) }], sections: [
    { title: policy.labels.elites, wide: true, items: elites }, { title: policy.labels.places, dense: true, items: places },
  ] });
}
