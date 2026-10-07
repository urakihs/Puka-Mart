#!/usr/bin/env node
// Checks the Bond Guide data for mistakes before you publish.
// Usage (from the repo root):  node tools/check.js
// Exits with an error if anything would break the page; warnings are worth a look but don't fail.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const load = (file, name) => {
  const src = fs.readFileSync(path.join(ROOT, 'data', file), 'utf8');
  try { return new Function(src + `\nreturn ${name};`)(); }
  catch (e) { fail(`data/${file}: can't be read as JavaScript (${e.message}). Check for a missing comma or bracket.`); return null; }
};
const exists = rel => fs.existsSync(path.join(ROOT, rel));

const errors = [], warnings = [];
function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

const CHARS = load('characters.js', 'CHARACTER_DB') || [];
const ITEMS = load('shopItems.js', 'SHOP_ITEM_DB') || [];
const ICONS = load('icons.js', 'MAT_ICONS') || {};
const GUIDE = load('bondGuide.js', 'BOND_GUIDE_DB') || [];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// A file that can't be read makes every other check misleading, so stop at that.
if (errors.length) {
  for (const e of errors) console.log('ERROR:   ' + e);
  process.exit(1);
}

// characters.js
const charIds = new Set();
for (const c of CHARS) {
  if (!c.id || !c.name) { fail(`characters.js: entry ${JSON.stringify(c)} needs both id and name.`); continue; }
  if (charIds.has(c.id)) fail(`characters.js: "${c.id}" is listed twice.`);
  charIds.add(c.id);
  if (!exists(`assets/icons/characters/${c.id}.png`)) fail(`characters.js: no portrait for "${c.id}" -- add assets/icons/characters/${c.id}.png`);
}

// shopItems.js
const itemIds = new Set();
for (const it of ITEMS) {
  const where = `shopItems.js: "${it.id || it.name}"`;
  if (!it.id || !KEBAB.test(it.id)) fail(`${where}: id must be kebab-case (lowercase words joined by "-").`);
  if (itemIds.has(it.id)) fail(`${where}: id is listed twice.`);
  itemIds.add(it.id);
  if (!it.name) fail(`${where}: missing name.`);
  if (!Number.isInteger(it.costPerUnit) || it.costPerUnit <= 0) fail(`${where}: costPerUnit must be a whole number above 0 (got ${it.costPerUnit}).`);
  if (!it.location) warn(`${where}: no location.`);
  if (it.name && !ICONS[it.name]) fail(`${where}: no icon -- add "${it.name}" to icons.js.`);
}

// icons.js
for (const [name, file] of Object.entries(ICONS)) {
  if (!exists(file)) fail(`icons.js: "${name}" points to ${file}, which doesn't exist.`);
  if (!ITEMS.some(i => i.name === name)) warn(`icons.js: "${name}" doesn't match any item name in shopItems.js (typo?).`);
}

// bondGuide.js
const seen = new Set(), used = new Set();
const isLevel = v => Number.isInteger(v) && v >= 1 && v <= 10;
for (const g of GUIDE) {
  const where = `bondGuide.js: "${g.characterId}"`;
  if (!charIds.has(g.characterId)) fail(`${where}: not in characters.js.`);
  if (seen.has(g.characterId)) fail(`${where}: has two entries.`);
  seen.add(g.characterId);
  for (const tier of [100, 200, 400]) {
    const id = g[`item${tier}Id`];
    if (!id) { fail(`${where}: missing item${tier}Id.`); continue; }
    if (!itemIds.has(id)) fail(`${where}: item${tier}Id "${id}" isn't in shopItems.js.`);
    used.add(id);
  }
  if ('noDating' in g && typeof g.noDating !== 'boolean') fail(`${where}: noDating must be true or false.`);
  if ('combatDateLevel' in g && !isLevel(g.combatDateLevel)) fail(`${where}: combatDateLevel must be a bond level 1-10.`);
  if ('maxBondLevel' in g && !isLevel(g.maxBondLevel)) fail(`${where}: maxBondLevel must be a bond level 1-10.`);
  if (g.noDating && 'combatDateLevel' in g) warn(`${where}: has both noDating and combatDateLevel -- noDating wins, so the combat date is ignored.`);
  if ('oneTimeBond' in g) {
    if (!Number.isInteger(g.oneTimeBond) || g.oneTimeBond < 0) fail(`${where}: oneTimeBond must be a whole number, 0 or more.`);
    else if (g.oneTimeBond % 50) warn(`${where}: oneTimeBond ${g.oneTimeBond} isn't a multiple of 50 (each quest/gesture/encounter is +50).`);
  }
  // Same item in two tiers is almost always a copy-paste slip.
  const ids = [g.item100Id, g.item200Id, g.item400Id].filter(Boolean);
  if (new Set(ids).size < ids.length) warn(`${where}: the same item is used for two tiers -- double-check its bond value.`);
}
for (const c of CHARS) if (!seen.has(c.id)) warn(`characters.js: "${c.id}" has no bondGuide.js entry, so it won't appear.`);
// The catalog is kept complete on purpose, so unused items are just counted, not warned about.
const unused = ITEMS.filter(it => !used.has(it.id)).length;

for (const w of warnings) console.log('warning: ' + w);
for (const e of errors) console.log('ERROR:   ' + e);
console.log(`\n${CHARS.length} characters, ${ITEMS.length} catalog items (${ITEMS.length - unused} in use), ${GUIDE.length} guide entries -- ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
