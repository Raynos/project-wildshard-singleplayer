#!/usr/bin/env node
// E357 F6: validate the reviewed map; never write it. Run from the checkout root.
import { globSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from '@typescript/typescript6';
import { collisions, imports, layer, resolveImport } from './core.mjs';

// Mechanisms override ownership by a single consumer. Each entry carries the required one-line reason.
export const MECHANISMS = new Map([
  ['src/models/glb.ts', 'generic GLB loader'], ['src/models/hull.ts', 'generic hull loader'],
  ['src/models/slots.ts', 'SlotGeometry primitive'], ['src/chunks/fauna-layout.ts', 'generic placement primitive'],
  ['src/world/fx.ts', 'generic effects runtime'], ['src/physics/paths.ts', 'generic graded path mechanism'],
  ['src/physics/ropeChain.ts', 'generic rope physics'], ['src/boot/nineBootTrace.ts', 'manifest-controlled boot trace'],
  ['src/boot/nineGpuTrace.ts', 'manifest-controlled GPU trace'], ['src/core/perfLap.ts', 'generic timing probe'],
  ['src/ui/perfLap.ts', 'generic timing readout'], ['src/entities/eliteBrain.ts', 'generic elite brain runtime'],
  ['src/entities/fightRules.ts', 'generic fight rules runtime'], ['src/entities/species/loft.ts', 'species registration mechanism'],
  ['src/entities/species/registry.ts', 'species registry mechanism'], ['src/entities/species/rigs.ts', 'rig registry mechanism'],
  ['src/world/HorizonMatte.ts', 'generic horizon renderer'], ['src/world/blenderArea.ts', 'generic Blender scene loader'],
  ['src/world/pointLightSkip.ts', 'generic light-filter primitive'],
  ['src/game/Boss.ts', 'boss runtime stays in game until S2.3 (E4)'],
  ['src/game/Elite.ts', 'elite runtime stays in game until S2.3 (E4)'],
  ['src/game/quest/core.ts', 'quest runtime stays in game until S2.5 (E4)'],
  ['src/game/quest/quest.ts', 'quest runtime stays in game until S2.5 (E4)'],
  ['src/game/quest/QuestUI.ts', 'quest renderer stays in game until S2.5 (E4)'],
  ['src/core/probe.ts', 'F2 generic debug probe; 04 section 6 explicitly maps it'],
  ['src/core/harnessTap.ts', 'F2 generic harness tap; no shard content'],
  ['src/world/BakedCards.ts', 'E357 F6m: generic baked-card loader/exporter; no Pine content'],
  ['src/world/faceHeads.ts', 'E357 F6m: generic head loader/converter; URLs supplied by callers'],
  ['src/physics/heightPatch.ts', 'E357 F6m: generic replaceable heightfield collider; no Nalati tuning'],
]);
// Reviewed semantic homes win where boot/game wiring or interim stacks obscure shard ownership.
// Explicit destinations and reasons from 04; these are exceptions, not a blanket acceptance of map rows.
const REVIEWED_PLACEMENTS = new Map([
  ["src/audio/ForestAmbience.ts", { rule: "G", destination: "shards/pine-hollow/audio/ambience.ts", why: "E357 F6m: built only on Pine (main.ts:863; 06 §1.3)" }],
  ["src/entities/npc/Castaway.ts", { rule: "I", destination: "shards/driftwood-isle/npc/Castaway.ts", why: "E357 F6m: Driftwood people (importers: its models + quest/Spine.ts); on #kit/npc at S4.3 (01 §21)" }],
  ["src/entities/npc/Trader.ts", { rule: "I", destination: "shards/driftwood-isle/npc/Trader.ts", why: "E357 F6m: Driftwood people (importers: its models + quest/TraderStall.ts); on #kit/npc at S4.3" }],
  ["src/game/loot/finds.ts", { rule: "N", destination: "shards/driftwood-isle/loot/finds.ts", why: "E357 F6m: Driftwood's FINDS (its header)" }],
  ["src/game/loot/keepsakes.ts", { rule: "N", destination: "shards/driftwood-isle/loot/keepsakes.ts", why: "E357 F6m: Driftwood's keepsakes (its header); trophies → loot.driftwood.trophies (09 §5.6)" }],
  ["src/game/loot/shop.ts", { rule: "N", destination: "shards/driftwood-isle/loot/shop.ts", why: "E357 F6m: the Driftwood trader's goods (its header)" }],
  ["src/game/quest/Complete.ts", { rule: "N", destination: "shards/driftwood-isle/quest/Complete.ts", why: "E357 F6m: Driftwood complete (its header)" }],
  ["src/game/quest/Ecology.ts", { rule: "N", destination: "shards/driftwood-isle/quest/Ecology.ts", why: "E357 F6m: the island's enemies come back (its header)" }],
  ["src/game/quest/Feats.ts", { rule: "N", destination: "shards/driftwood-isle/quest/Feats.ts", why: "E357 F6m: Driftwood's collectibles (its header)" }],
  ["src/game/quest/Finale.ts", { rule: "N", destination: "shards/driftwood-isle/quest/Finale.ts", why: "E357 F6m: the Drowned Captain finale → the boss runtime at S4.2 (09 §5.4)" }],
  ["src/game/quest/Places.ts", { rule: "N", destination: "shards/driftwood-isle/quest/Places.ts", why: "E357 F6m: Driftwood's named places (check-models.mjs reads it)" }],
  ["src/game/quest/Spine.ts", { rule: "N", destination: "shards/driftwood-isle/quest/Spine.ts", why: "E357 F6m: Driftwood's quest spine" }],
  ["src/game/quest/TraderStall.ts", { rule: "N", destination: "shards/driftwood-isle/quest/TraderStall.ts", why: "E357 F6m: the trader's stall at Wendell's hut" }],
  ["src/game/quest/driftwood.ts", { rule: "N", destination: "shards/driftwood-isle/quest/questLine.ts", why: "E357 F6m: Driftwood's quest data (02 rule 4); renamed: a driftwood.ts inside the Driftwood folder names nothing" }],
  ["src/game/quest/guards.ts", { rule: "N", destination: "shards/driftwood-isle/quest/guards.ts", why: "E357 F6m: the iron sword's guard" }],
  ["src/game/quest/gullGuide.ts", { rule: "N", destination: "shards/driftwood-isle/quest/gullGuide.ts", why: "E357 F6m: the gull guide (DRIFTWOOD-TOP10)" }],
  ["src/player/IronSword.ts", { rule: "G", destination: "shards/driftwood-isle/weapons/IronSword.ts", why: "E357 F6m: the iron-sword pickup, Driftwood only (02 rule 3; 09 §1.5)" }],
  ["src/player/LeverRifle.ts", { rule: "G", destination: "shards/pine-hollow/weapons/LeverRifle.ts", why: "E357 F6m: Pine only: LeverRifle extends Firearm there (09 §1.5; 06 §1.3 says kit: Q3)" }],
  ["src/ui/ShopPanel.ts", { rule: "I", destination: "shards/driftwood-isle/loot/ShopPanel.ts", why: "E357 F6m: the Driftwood trader's panel (its only importer: loot/install.ts, Driftwood's shop)" }],
  ["src/ui/compendium/shards/pine-hollow.ts", { rule: "N", destination: "shards/pine-hollow/compendium.ts", why: "E357 F6m: Pine's compendium, ctx.rows.compendium at S2.1 (06 §1.3)" }],
  ["src/ui/styles/shop.css", { rule: "I", destination: "shards/driftwood-isle/loot/shop.css", why: "E357 F6m: with ShopPanel.ts" }],
  ["src/world/BlenderIsland.ts", { rule: "G", destination: "shards/driftwood-isle/world/BlenderIsland.ts", why: "E357 F6m: a Driftwood world builder (main.ts isOcean gate; 02 rule 3)" }],
  ["src/world/Cove.ts", { rule: "G", destination: "shards/driftwood-isle/world/Cove.ts", why: "E357 F6m: a Driftwood world builder (main.ts isOcean gate; 02 rule 3)" }],
  ["src/world/Gulls.ts", { rule: "G", destination: "shards/driftwood-isle/world/Gulls.ts", why: "E357 F6m: Driftwood gulls (main.ts gate + its models)" }],
  ["src/world/Palms.ts", { rule: "G", destination: "shards/driftwood-isle/world/Palms.ts", why: "E357 F6m: a Driftwood world builder (main.ts isOcean gate; 02 rule 3)" }],
  ["src/world/PineCrags.ts", { rule: "N", destination: "shards/pine-hollow/world/crags.ts", why: "E357 F6m: 06 §1.3" }],
  ["src/world/Spruce.ts", { rule: "G", destination: "shards/nalati-grasslands/world/Spruce.ts", why: "E357 F6m: trees.factory 'spruce' is Nalati's (core/bootstrap.ts TREE_FACTORIES)" }],
  ["src/world/TrophyWall.ts", { rule: "G", destination: "shards/pine-hollow/world/trophyWall.ts", why: "E357 F6m: built for Pine's compendium only (06 §1.3)" }],
  ["src/world/Undergrowth.ts", { rule: "G", destination: "shards/pine-hollow/world/undergrowth.ts", why: "E357 F6m: only Pine draws the undergrowth (06 §1.3)" }],
  ["src/world/Water.ts", { rule: "G", destination: "shards/pine-hollow/world/pond.ts", why: "E357 F6m: Pine's still pond + lily pads (PH-L9; main.ts gate + BeaverPool)" }],
  ["src/world/Waterfall.ts", { rule: "I", destination: "shards/driftwood-isle/world/Waterfall.ts", why: "E357 F6m: Driftwood's toon cascade (its only importer: Cove.ts)" }],
  ["src/world/Zipline.ts", { rule: "I", destination: "shards/driftwood-isle/world/Zipline.ts", why: "E357 F6m: Driftwood's zipline (its only importer: quest/Adventure.ts)" }],
  ["src/world/coverTint.ts", { rule: "G", destination: "shards/driftwood-isle/world/coverTint.ts", why: "E357 F6m: Driftwood's ground-cover tint (main, BlenderIsland, GroundCover)" }],
  ["src/world/driftwood.ts", { rule: "N", destination: "shards/driftwood-isle/world/driftLogs.ts", why: "E357 F6m: the drift-log painter (02 rule 4); renamed inside its own shard" }],
  ["src/world/interact/driftwood.ts", { rule: "N", destination: "shards/driftwood-isle/quest/interactables.ts", why: "E357 F6m: Driftwood's interactables table (02 rule 4)" }],
  ["src/world/nalati/KurganDungeon.ts", { rule: "I", destination: "shards/nalati-grasslands/world/KurganDungeon.ts", why: "E357 F6m: Nalati world (02 rule 2; the extra nalati/ level dropped)" }],
  ["src/world/nalati/glbPaint.ts", { rule: "I", destination: "shards/nalati-grasslands/world/glbPaint.ts", why: "E357 F6m: Nalati world (02 rule 2; the extra nalati/ level dropped)" }],
  ["src/world/nalati/layout.ts", { rule: "I", destination: "shards/nalati-grasslands/world/layout.ts", why: "E357 F6m: Nalati world (02 rule 2; the extra nalati/ level dropped)" }],
  ["src/world/nalati/paint.ts", { rule: "I", destination: "shards/nalati-grasslands/world/paint.ts", why: "E357 F6m: Nalati world (02 rule 2; the extra nalati/ level dropped)" }],
]);
const SLUGS = ['nine-dragon-stack', 'pine-hollow', 'nalati-grasslands', 'driftwood-isle'];
const NAMED = [ /Nine|nine|nine-dragon/, /Pine|pine|pine-hollow/, /Nalati|nalati|Steppe|steppe/, /Driftwood|driftwood|Island/ ];
// 02 F6's explicit Driftwood content names without a shard token (04's N rows).
const DRIFTWOOD_NAMES = /src\/game\/(?:loot\/(?:finds|keepsakes|perks|shop)|quest\/(?:Complete|Ecology|Feats|Finale|Spine|Places|TraderStall|guards|gullGuide))\.ts$/;

function territory(file) {
  if (file.startsWith('src/shards/')) return file;
  for (const slug of SLUGS) {
    if (file === `src/chunks/${slug}.ts` || file === `src/chunks/${slug}/def.ts`) return `src/shards/${slug}/manifest.ts`;
    if (file.startsWith(`src/chunks/${slug}/`)) return file.replace(`src/chunks/${slug}/`, `src/shards/${slug}/`);
    if (file.startsWith(`src/chunks/thumbs/${slug}`)) return file.replace('src/chunks/thumbs/', `src/shards/${slug}/thumbs/`);
  }
  if (file.startsWith('src/nalati/')) return file.replace('src/nalati/', 'src/shards/nalati-grasslands/');
  if (file.startsWith('src/pinehollow/')) return file.replace('src/pinehollow/', 'src/shards/pine-hollow/');
  const layouts = { 'nalatiLayout.ts': 'nalati-grasslands/layout.ts', 'nalatiEdge.ts': 'nalati-grasslands/edge.ts', 'pineHollowLayout.ts': 'pine-hollow/layout.ts' };
  const layout = layouts[path.posix.basename(file)];
  return file.startsWith('src/chunks/') && layout ? `src/shards/${layout}` : null;
}

function defaultDestination(file) {
  if (/^src\/(engine|game|kit|shards)\//.test(file) || ['src/main.ts', 'src/entry.ts'].includes(file)) return file;
  if (file === 'src/boot/entry.ts') return 'src/entry.ts';
  if (file === 'src/core/probe.ts') return 'src/engine/debug/probe.ts';
  if (/^src\/[^/]+\.d\.ts$/.test(file)) return file.replace('src/', 'src/engine/types/');
  return file.replace('src/', 'src/engine/');
}

function shardDestination(file, slug) {
  return `src/shards/${slug}/${file.slice(4).replace(/^world\/nalati\//, 'world/')}`;
}

function gates(expression, aliases = new Map()) {
  const text = expression.getText();
  const found = new Set();
  const patterns = [ /\b(isNine|built)\b|chunk\.structures/, /\bisPine\b|sky\.pine|!isOcean\s*&&\s*hasPond/, /\b(painterly|nalatiNow)\b|style\s*===\s*['"]painterly/, /(?<!!)\b(isOcean|sea)\b|chunk\.ocean/ ];
  for (const [index, slug] of SLUGS.entries()) if (patterns[index].test(text) || text.includes(`'${slug}'`) || text.includes(`"${slug}"`)) found.add(slug);
  for (const name of text.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
    const slug = aliases.get(name[0]);
    if (slug) found.add(slug);
  }
  return found;
}

const GATE_ALIASES = new WeakMap();
function gateAliases(root) {
  const cached = GATE_ALIASES.get(root);
  if (cached) return cached;
  const aliases = new Map();
  const declarations = [];
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.push(node);
    ts.forEachChild(node, collect);
  }
  collect(root);
  for (let pass = 0; pass < declarations.length; pass++) {
    let changed = false;
    for (const declaration of declarations) {
      const found = gates(declaration.initializer, aliases);
      if (found.size === 1 && !aliases.has(declaration.name.text)) {
        aliases.set(declaration.name.text, [...found][0]); changed = true;
      }
    }
    if (!changed) break;
  }
  GATE_ALIASES.set(root, aliases);
  return aliases;
}

function gatedShard(entry) {
  if (!ts.isImportDeclaration(entry.node)) return null;
  const clause = entry.node.importClause;
  if (!clause || clause.isTypeOnly) return null;
  const bindings = clause.namedBindings;
  const names = new Set([...(clause.name ? [clause.name.text] : []), ...(bindings ? ts.isNamedImports(bindings) ? bindings.elements.filter((el) => !el.isTypeOnly).map((el) => el.name.text) : [bindings.name.text] : [])]);
  const uses = [];
  const aliases = gateAliases(entry.root);
  function visit(node) {
    if (ts.isIdentifier(node) && names.has(node.text)) {
      let parent = node.parent;
      let scope = null;
      let ignored = false;
      while (!ts.isSourceFile(parent)) {
        if (ts.isImportDeclaration(parent) || ts.isTypeNode(parent)) { ignored = true; break; }
        // `value instanceof ImportedClass` is a type guard, not construction of shard content.
        if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword && parent.right === node) { ignored = true; break; }
        const branch = ts.isIfStatement(parent) ? parent.thenStatement : ts.isConditionalExpression(parent) ? parent.whenTrue
          : ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? parent.right : null;
        const test = ts.isIfStatement(parent) ? parent.expression : ts.isConditionalExpression(parent) ? parent.condition
          : branch && ts.isBinaryExpression(parent) ? parent.left : null;
        if (test && branch && node.pos >= branch.pos && node.end <= branch.end) {
          const result = gates(test, aliases);
          if (result.size === 1) { scope = [...result][0]; break; }
        }
        parent = parent.parent;
      }
      if (!ignored) uses.push(scope);
    }
    ts.forEachChild(node, visit);
  }
  visit(entry.root);
  return uses.length > 0 && uses.every((slug) => slug !== null && slug === uses[0]) ? uses[0] : null;
}

export function classify(map, root = process.cwd()) {
  const files = new Set(globSync('src/**/*', { cwd: root }).filter((file) => statSync(path.join(root, file)).isFile()));
  const sourceFiles = files;
  const rows = new Map(map.files.map((row) => [row.from, row]));
  const destinations = new Map();
  const graph = new Map();
  const findings = [];
  for (const file of sourceFiles) {
    const row = rows.get(file);
    destinations.set(file, row?.f6 ?? territory(file) ?? defaultDestination(file));
    if (file.endsWith('.ts')) for (const entry of imports(file, readFileSync(path.join(root, file), 'utf8'))) {
      const target = resolveImport(file, entry.specifier, sourceFiles);
      if (target) {
        const sites = graph.get(target) ?? [];
        sites.push({ file, ...entry });
        graph.set(target, sites);
      }
    }
  }
  const computed = new Map();
  // Reviewed destinations seed recursive ownership groups; a new external importer retracts ownership to a fixpoint.
  for (let pass = 0; pass <= sourceFiles.size; pass++) {
    let changed = false;
    for (const file of sourceFiles) {
      const row = rows.get(file);
      if (row && !['I', 'G', 'N', 'M', 'F'].includes(row.rule)) continue;
      const sites = graph.get(file) ?? [];
      const owners = sites.map((site) => layer(destinations.get(site.file) ?? site.file));
      let rule = 'F';
      let destination = territory(file) ?? defaultDestination(file);
      const reviewed = REVIEWED_PLACEMENTS.get(file);
      if (reviewed) { rule = reviewed.rule; destination = `src/${reviewed.destination}`; }
      else if (MECHANISMS.has(file)) rule = 'M';
      else if (territory(file)) rule = 'T';
      else if (sites.length > 0 && owners.every((owner) => owner.startsWith('shards/') && owner === owners[0])) {
        rule = 'I'; destination = shardDestination(file, owners[0].slice(7));
      } else {
        const gated = sites.map(gatedShard);
        if (sites.length > 0 && gated.every((slug) => slug && slug === gated[0])) {
          rule = 'G'; destination = shardDestination(file, gated[0]);
        } else {
          const index = DRIFTWOOD_NAMES.test(file) ? 3 : NAMED.findIndex((pattern) => pattern.test(path.posix.basename(file)));
          const slug = SLUGS[index];
          if (slug && owners.every((owner) => ['engine', 'root', `shards/${slug}`].includes(owner))) {
            rule = 'N'; destination = shardDestination(file, slug);
          }
        }
      }
      // Renamed semantic homes are explicit in the reviewed map, not inferred folder names.
      if (row?.f6 && layer(row.f6) === layer(destination) && rule !== 'F') destination = row.f6;
      computed.set(file, { rule, destination });
      if (destinations.get(file) !== destination) { changed = true; destinations.set(file, destination); }
    }
    if (!changed) break;
    if (pass === sourceFiles.size) findings.push({ kind: 'ownership did not converge' });
  }
  for (const file of sourceFiles) if (!rows.has(file) && !map.files.some((row) => row.f6 === file || row.final === file)) {
    const proposal = /^src\/(engine|game|kit|shards)\//.test(file) ? { rule: 'SPEC', destination: file }
      : computed.get(file) ?? { rule: 'F', destination: destinations.get(file) };
    findings.push({ kind: 'unmapped file', file, ...proposal });
  }
  for (const row of map.files) {
    const current = [row.from, row.f6, row.final].find((file) => file && sourceFiles.has(file));
    if (!current && !(row.f6 === null && row.final === null && row.row === 'F7')) findings.push({ kind: 'missing file', file: row.from, rule: row.rule });
    else if (current === row.from && ['I', 'G', 'N', 'M', 'F'].includes(row.rule)) {
      const actual = computed.get(current);
      if (actual && (actual.rule !== row.rule || actual.destination !== row.f6)) findings.push({ kind: 'rule disagreement', file: row.from, expected: { rule: row.rule, destination: row.f6 }, computed: actual,
        importers: (graph.get(current) ?? []).map((site) => ({ file: site.file, line: site.line, owner: layer(destinations.get(site.file) ?? site.file), gate: gatedShard(site) })) });
    }
  }
  for (const entry of collisions(new Map(map.files.filter((row) => row.f6).map((row) => [row.from, row.f6])), files)) {
    findings.push({ from: entry.from, to: entry.to, other: entry.other, kind: `collision: ${entry.kind}` });
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--check') throw new Error('Usage: classify.mjs --check <map>');
  const findings = classify(JSON.parse(readFileSync(args[1], 'utf8')));
  console.info(JSON.stringify({ findings, count: findings.length }, null, 2));
  process.exitCode = findings.length > 0 ? 1 : 0;
}
