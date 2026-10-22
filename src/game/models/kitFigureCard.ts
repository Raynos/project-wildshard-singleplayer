/** Cold kit cards use the existing numeric figure, catalogue and draw formats.
 * The card owns only its template intake, geometry copies and live figure. */
import * as v from 'valibot';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { resourceScope } from '@wildshard/engine/app/resources';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';
import { KitFigureCardsSchema, type KitFigureCardsRows } from '@wildshard/format/questFigures';
import type { ShardProduct } from '../shardfile/shardProduct';
import { SceneHandles } from '../shardfile/sceneHandles';
import { ProductFigureCatalogue } from './figureCatalogue';
import { coldFixedDraws } from './fixedDraws';
import { questFigure } from '../quest/figures';

/** Internal Explorer dispatch. It never falls back to an entered draw loan or
 * installs a world service; its source catalogue retains its original owner. */
export function kitFigureCard(product: ShardProduct, input: KitFigureCardsRows, key: string): ModelDef<Record<string, never>> {
  const book = v.parse(KitFigureCardsSchema, input), card = book.cards[key];
  const custom = (name: string): name is `custom/${string}` => name.startsWith('custom/');
  if (card === undefined || !custom(book.draws) || !product.has(book.draws) || !product.hasFile(book.catalogue)) throw new Error('Kit card requires its declared figure, draws and catalogue');
  if (new Set(Object.values(book.cards).map(row => row.model.id)).size !== Object.keys(book.cards).length) throw new Error('Repeated kit card model identity');
  const source = product.section<{ readonly fixedDraws: unknown }>(book.draws), sourceOwner = resourceScope();
  const row = card.figure, slots = [...new Set([...Object.values(row.parts), ...row.objects.map(object => object.draw), ...row.publish.map(publication => publication.draw)])];
  const { surface, ...metadata } = card.model;
  return defineModel<Record<string, never>>({ ...metadata, ...(surface === undefined ? {} : { surface }), specimenLifetime: 'view', build: ctx => {
    const owner = ctx.specimenScope;
    if (owner === undefined) throw new Error('Kit figure card requires its view owner');
    const check = (): void => {
      if (owner.disposed || owner.disposing || sourceOwner.disposed || sourceOwner.disposing) throw new Error('Kit figure card owner left');
    };
    check();
    return loadingSpecimen(card.model.id, [1, 1, 1], async () => {
      const catalogue = await ProductFigureCatalogue.fromProduct(product, book.catalogue, sourceOwner); check();
      const draws = await coldFixedDraws(product, source.fixedDraws, owner, slots); check();
      const resources = new SceneHandles(ctx.sky);
      const figure = owner.run(() => questFigure(row, { sky: ctx.sky, scope: owner, resources, catalogue,
        draws: { get ready() { return draws.ready; }, handle: slot => ({ copy: () => {
          const geometry = draws.handle(slot).copy(); ownSceneResource(geometry, owner); return geometry;
        } }) },
        place: place => ({ x: place.x, y: place.y ?? 0, z: place.z, yaw: place.yaw ?? 0 }),
        channels: product.shardfile.clientChannels }));
      owner.onDispose(() => { figure.dispose(); figure.group.removeFromParent(); });
      await figure.presentation.ready; check();
      return figure.group;
    }, owner);
  } });
}
