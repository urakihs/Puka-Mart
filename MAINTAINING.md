# Maintaining the NTE Bond Guide

How to add a character, add or reprice a gift item, and keep the guide correct. Every change
is a plain-text edit to a file in `data/`, sometimes plus one PNG. There's no build step.

## How the site fits together

```
index.html                     the page: layout, styles and all render logic (inline)
data/characters.js             who appears              { id, name }
data/bondGuide.js              each character's picks   { characterId, item100Id, item200Id, item400Id, ...flags }
data/shopItems.js              the gift catalog          { id, name, costPerUnit, location }
data/icons.js                  item name -> icon file
data/affinity.js               bond math and game rules (levels, dating, Zero, free cloud)
assets/icons/characters/<id>.png   portraits
assets/icons/materials/<slug>.png  item icons
tools/check.js                 data checker
```

The files point at each other by id:

```
characters.js  id  ──────────────┐
                                 ▼
bondGuide.js   characterId, item100Id / item200Id / item400Id
                                       │
                                       ▼
shopItems.js   id ── name ──► icons.js "name" ──► assets/icons/materials/<slug>.png
```

You rarely need to touch `index.html` or `affinity.js`. All Gifts / Days / Total Fons numbers
are calculated when the page loads, so they're never stored anywhere.

## The workflow for every change

1. Edit the data file(s).
2. Run `node tools/check.js` from the repo root. It lists anything broken (an unknown item id,
   a missing icon or portrait, a duplicate entry, a bad value) and exits with an error if
   something would break the page. Fix every `ERROR`; read the `warning`s.
3. Open `index.html` in a browser and look at the character you changed in both views.
4. Commit.

## Recipes

### Change an item's price or shop

Edit its line in `data/shopItems.js`:

```js
{ id: "chiyo-family-brew", name: "Chiyo Family Brew", costPerUnit: 300, location: "Budoriya" },
```

Every character using it updates automatically. A price change can make a different item
the cheapest for some characters, so re-check the picks that use it (see
[Choosing a character's gifts](#choosing-a-characters-gifts)).

### Swap a character's gift

Change the id in their `data/bondGuide.js` entry, e.g. `item100Id: "chiyo-family-brew"`. The
new item must already exist in `shopItems.js`; if it doesn't, add it first (next recipe).

### Add a new gift item

1. Add a line to `data/shopItems.js` (the file is sorted by id):
   - `id`: the name in kebab-case, e.g. `"Cotton Candy Tree Pop"` → `"cotton-candy-tree-pop"`.
   - `name`: the in-game English name, exactly.
   - `costPerUnit`: Fons for one unit.
   - `location`: `"Shop - District"` once you've confirmed the district in-game, otherwise the
     shop name alone. Permanent shops only (see the rules below).
2. Save the icon as `assets/icons/materials/<id>.png` (256×256 PNG).
3. Add `"<name>": "assets/icons/materials/<id>.png"` to `data/icons.js`.
4. Run `node tools/check.js`.

### Add a new character

1. `data/characters.js`: add `{ id: "newchar", name: "New Char" }`. The id is the lowercase
   name with no spaces.
2. Portrait: `assets/icons/characters/<id>.png`, square, to match the others.
3. `data/bondGuide.js`: add an entry. Pick the three items using the rules in the next
   section, and set any flags that apply:

   ```js
   {
     characterId: "newchar",
     oneTimeBond: 1100,        // quests + gestures + city encounters, x50 each (omit if none)
     item100Id: "some-snack",
     item200Id: "some-flower",
     item400Id: "some-figure"
   }
   ```

   | Flag | When to use it | Example |
   |---|---|---|
   | `noDating: true` | The character has **no city hangouts**, so they can't be dated. | Adler, Akane, Skia |
   | `combatDateLevel: 8` | Their only date is a combat date that unlocks at this bond level (replaces the normal Lv 4 dating start). | Zankou |
   | `maxBondLevel: 2` | Their bond stops below level 10. | Aurelia |
   | `oneTimeBond: N` | Total one-time bond: (quests + gestures + city encounters) × 50. City **hangouts** are dates, not one-time bond, so don't count them here. | Nanally 1450 |

4. If the character's gifts aren't in `shopItems.js` yet, add them (previous recipe).
5. Run `node tools/check.js` and check the new rows in both views.

### Change a game rule

Bond rules live at the top of `data/affinity.js`: the exp needed per level (`BOND_NEEDED`),
the dating start level, bond per date, gifts per day, Zero's bonus, and the free cloud's bond.
Change the constant and every number on the page follows. Character-specific exceptions
belong in `bondGuide.js` flags, not here.

## Choosing a character's gifts

The guide's promise is that each tier shows the **cheapest permanent-shop item that gives that
character exactly that much bond**. Rules:

1. **Bond value is per character.** Every gift has a default bond value for everyone, plus
   overrides for specific characters (e.g. Serenade is 100 for most characters but 200 for
   Zankou). A character's value for an item is their override if they have one, otherwise
   the default.
2. **Cheapest Fons per unit wins.** Compare every item worth exactly 100 (or 200, or 400) to
   that character and pick the lowest `costPerUnit`. Ties don't matter: keep the current one.
3. **Permanent shops only.** Rotating or limited-time shops don't count (in the game data:
   `FonsLimitTimeShop*` and event currencies). **Pukaland shops are permanent** and do count.
4. **Watch the bond-id trap.** In the game data, gift overrides are keyed by each
   character's *bond* id, which is **not always their character id**:

   | Character | Character id | Bond id (use this) |
   |---|---|---|
   | Daffodill | 1054 | 1005 |
   | Hotori | 1052 | 1029 |
   | Jiuyuan | 1055 | 1014 |
   | Shinku | 1076 | 1076 (called "Crimson" in bond data) |

   If you look a character up by the wrong id, you find no overrides, and the "cheapest 100"
   becomes some item that's 100 for *everyone*. That's how Hotori and Jiuyuan once ended up
   with Serenade (3,000 Fons) instead of a ~300-Fons food. If a 100-bond pick costs thousands
   of Fons, suspect this first. For a new character, match them by name in the bond data
   (below) instead of assuming the ids agree.
5. Sanity check: 100-bond picks are usually food (about 300–1,000 Fons), 200-bond picks
   flowers or decor (about 3,000–7,500), and 400-bond picks figures or ornaments
   (about 10,000–20,000).

## Where the numbers come from

Everything above was pulled from the community datamine
[Waifus-Grace/NTE_Assets](https://github.com/Waifus-Grace/NTE_Assets):

| What | File | Field(s) |
|---|---|---|
| Bond value per item, per character | `DataTable/LikeabilitySystem/DT_LikeabilityGiftData.json` | `DefaultLikeabilityValue`; `SpeicalGiftDatas[]` (`RoleId`, `LikeabilityValue`) |
| Bond id ↔ character name | `DataTable/LikeabilitySystem/DT_LikeabilityRoleData.json` | row key = bond id; `RoleNameText` |
| Fons price + which shop | `DataTable/Shop/GoodsDataTable.json` | `ItemID`, `Price`, `CurrencyID: "Fons"`, `OwnerShopID` |
| Shop name | `DataTable/Shop/ShopDataTable.json` | `ShopName` |
| Item names + icon paths | `DataTable/Inventory/DT_ItemConfig.json`, `DataTable/Food/DT_FoodItemData.json` (foods) | `ItemName`, `ItemIcon` |
| English text | `Localization/en/game.json` | |
| Item icon images | `UI_Icon/Item/<icon name>.png` | from `ItemIcon` (drop the `/Game/UI/` prefix and the `.xxx` suffix) |

Values the datamine doesn't have and players confirmed in-game: quest and gesture bond (+50
each), the city districts in `location`, and Zankou's combat date.

## Checklist for a new patch

- New character → [Add a new character](#add-a-new-character).
- New shop or items → add them to `shopItems.js`, then re-check the picks of any character
  they're cheaper for (the override lists show who).
- Price changes → update `costPerUnit`, then re-check picks that use those items.
- Always finish with `node tools/check.js` and a look at the page.
