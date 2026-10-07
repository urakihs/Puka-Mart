// characters.js -- every character shown in the Bond Guide.
//
// One entry per character: { id, name }
//   id   -- lowercase, no spaces (e.g. "jiuyuan"). Used everywhere else: bondGuide.js's
//           characterId and the portrait file assets/icons/characters/<id>.png.
//   name -- display name.
//
// After editing, run: node tools/check.js

const CHARACTER_DB = [
  { id: "adler", name: "Adler" },
  { id: "aurelia", name: "Aurelia" },
  { id: "baicang", name: "Baicang" },
  { id: "blackbird", name: "Blackbird" },
  { id: "chaos", name: "Chaos" },
  { id: "chiz", name: "Chiz" },
  { id: "daffodill", name: "Daffodill" },
  { id: "edgar", name: "Edgar" },
  { id: "fadia", name: "Fadia" },
  { id: "haniel", name: "Haniel" },
  { id: "hathor", name: "Hathor" },
  { id: "hotori", name: "Hotori" },
  { id: "iroi", name: "Iroi" },
  { id: "jiuyuan", name: "Jiuyuan" },
  { id: "lacrimosa", name: "Lacrimosa" },
  { id: "linko", name: "Linko" },
  { id: "mint", name: "Mint" },
  { id: "nanally", name: "Nanally" },
  { id: "sakiri", name: "Sakiri" },
  { id: "shinku", name: "Shinku" },
  { id: "skia", name: "Skia" },
  { id: "zankou", name: "Zankou" },
  { id: "akane", name: "Akane" }
];
