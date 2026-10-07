// bondGuide.js -- each character's best 100-, 200- and 400-bond gift, plus a few bond facts.
//
// One entry per character:
//   characterId      -- REQUIRED. An id from characters.js.
//   item100Id        -- REQUIRED. shopItems.js id of the CHEAPEST item worth 100 bond to this character.
//   item200Id        -- REQUIRED. Same, for 200 bond.
//   item400Id        -- REQUIRED. Same, for 400 bond.
//   oneTimeBond      -- optional. One-time bond from quests + gestures + city encounters (+50 each).
//                       Used by the "Quests & Gestures" toggle. Omit if the character has none.
//   noDating         -- optional. true if the character has no city hangouts (can't be dated).
//   combatDateLevel  -- optional. For a character whose only date is a combat date (Zankou: 8): the
//                       daily date starts at this bond level instead of 4.
//   maxBondLevel     -- optional. Only for a character whose bond caps below 10 (Aurelia: 2).
//
// See MAINTAINING.md for how to pick the items. After editing, run: node tools/check.js

const BOND_GUIDE_DB = [
  {
    characterId: "adler",
    noDating: true,
    oneTimeBond: 200,
    item100Id: "purification-guard-lozenges",
    item200Id: "golden-dawn",
    item400Id: "promise"
  },
  {
    characterId: "akane",
    noDating: true,
    oneTimeBond: 650,
    item100Id: "puka-lucky-star",
    item200Id: "refulgent-agreement",
    item400Id: "unrecorded-sound"
  },
  {
    characterId: "aurelia",
    noDating: true,
    maxBondLevel: 2,
    item100Id: "bigmouth-custard-baozi",
    item200Id: "fantasia",
    item400Id: "promise"
  },
  {
    characterId: "baicang",
    noDating: true,
    oneTimeBond: 300,
    item100Id: "kids-energy-meal",
    item200Id: "refulgent-agreement",
    item400Id: "gigafluff-the-strong"
  },
  {
    characterId: "blackbird",
    oneTimeBond: 950,
    item100Id: "gubichi-original-flavor-chips",
    item200Id: "knots",
    item400Id: "moonmelt-tea-set"
  },
  {
    characterId: "chaos",
    oneTimeBond: 1100,
    item100Id: "hamburger-steak-xl",
    item200Id: "glimmering-ice",
    item400Id: "kokoro-rider-l1-metal-strategist"
  },
  {
    characterId: "chiz",
    oneTimeBond: 1000,
    item100Id: "nyanko-punch-taro-pudding-milktea",
    item200Id: "fantasia",
    item400Id: "bunny-box"
  },
  {
    characterId: "daffodill",
    noDating: true,
    oneTimeBond: 200,
    item100Id: "nyanko-cozy-uji-matcha",
    item200Id: "eternal-purity",
    item400Id: "promise"
  },
  {
    characterId: "edgar",
    noDating: true,
    oneTimeBond: 200,
    item100Id: "clicky-fries",
    item200Id: "bosss-approval",
    item400Id: "bear-o-metry"
  },
  {
    characterId: "fadia",
    oneTimeBond: 1100,
    item100Id: "classic-trio",
    item200Id: "golden-spring",
    item400Id: "glimmering-ice"
  },
  {
    characterId: "haniel",
    noDating: true,
    oneTimeBond: 200,
    item100Id: "cool-lala-spicy-snack",
    item200Id: "fantasia",
    item400Id: "mini-flaky-flake"
  },
  {
    characterId: "hathor",
    noDating: true,
    oneTimeBond: 200,
    item100Id: "colorful-light-salad",
    item200Id: "fever-dream",
    item400Id: "on-track"
  },
  {
    characterId: "hotori",
    oneTimeBond: 1050,
    item100Id: "chiyo-family-brew",
    item200Id: "yellow-glaze-vase",
    item400Id: "golden-moon"
  },
  {
    characterId: "iroi",
    oneTimeBond: 1050,
    item100Id: "cotton-candy-tree-pop",
    item200Id: "refulgent-agreement",
    item400Id: "bear-o-metry"
  },
  {
    characterId: "jiuyuan",
    oneTimeBond: 1100,
    item100Id: "magi-puff-whole-wheat-bread",
    item200Id: "moon-vase",
    item400Id: "on-track"
  },
  {
    characterId: "lacrimosa",
    oneTimeBond: 1150,
    item100Id: "tomato-100",
    item200Id: "chill-out",
    item400Id: "bunny-box"
  },
  {
    characterId: "linko",
    oneTimeBond: 1100,
    item100Id: "kids-energy-meal",
    item200Id: "fantasia",
    item400Id: "golden-moon"
  },
  {
    characterId: "mint",
    oneTimeBond: 1300,
    item100Id: "gubicrisp",
    item200Id: "waltz",
    item400Id: "mini-cookie-coo"
  },
  {
    characterId: "nanally",
    oneTimeBond: 1450,
    item100Id: "cool-lala-spicy-snack",
    item200Id: "blazing-crimson",
    item400Id: "kokoro-rider-l1-metal-strategist"
  },
  {
    characterId: "sakiri",
    noDating: true,
    oneTimeBond: 400,
    item100Id: "crave-bites-milk-flavor",
    item200Id: "fever-dream",
    item400Id: "bunny-box"
  },
  {
    characterId: "shinku",
    oneTimeBond: 1250,
    item100Id: "puka-chocoa-ellie-tour-special",
    item200Id: "glimmering-ice",
    item400Id: "gigafluff-the-strong"
  },
  {
    characterId: "skia",
    noDating: true,
    oneTimeBond: 150,
    item100Id: "bobs-tea-garden",
    item200Id: "chill-out",
    item400Id: "white-jade-lamp"
  },
  {
    characterId: "zankou",
    combatDateLevel: 8,
    oneTimeBond: 600,
    item100Id: "seasonal-sushi-boat",
    item200Id: "serenade",
    item400Id: "moonmelt-tea-set"
  }
];
