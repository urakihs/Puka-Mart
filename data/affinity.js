// affinity.js -- bond levels, game rules and the cost math behind the Bond Guide.
//
// The bond EXP ladder is the same for every character: levels 0..10 on one curve.
//   BOND_NEEDED[i] = bond EXP to go from level i to i+1 (i = 0..9).
//   BOND_CUM[i]    = cumulative bond EXP at level i. Derived from BOND_NEEDED; don't hand-edit.
//
// Character-specific exceptions belong in bondGuide.js flags, not here.
// After editing, run: node tools/check.js

// Bond EXP required to advance FROM each level (index = from-level, 0..9).
const BOND_NEEDED = [100, 500, 1000, 2000, 3500, 5000, 7000, 9000, 12000, 16000];

// Cumulative bond EXP banked AT each level (0..10). Derived from BOND_NEEDED.
const BOND_CUM = (function () {
  const cum = [0];
  for (let i = 0; i < BOND_NEEDED.length; i++) cum.push(cum[cum.length - 1] + BOND_NEEDED[i]);
  return cum; // length 11: BOND_CUM[10] === 56100
})();

const BOND_MAX_LEVEL = 10;        // bond levels run 0..10
const BOND_DATE_GATE_LEVEL = 4;   // dating unlocks once bond level 4 is reached
const BOND_DATE_BOND = 200;       // free bond granted by one daily date
const BOND_GIFT_CAP = 3;          // max gifts a single character can receive per day
const BOND_ZERO_GIFT_BONUS = 0.05; // Zero's life skill: flat +5% bond from gifts (see bondZeroCap)
const BOND_FREE_CLOUD_BOND = 400; // free daily Fluffy Cloud gift (0 Fons, uses a gift slot)

function bondCumAtLevel(level) {
  const L = Math.max(0, Math.min(level | 0, BOND_MAX_LEVEL));
  return BOND_CUM[L];
}

// The bond level a cumulative bond total sits at (inverse of BOND_CUM), 0..10.
function bondLevelFromCum(cum) {
  let L = 0;
  for (let i = 0; i <= BOND_MAX_LEVEL; i++) { if (cum >= BOND_CUM[i]) L = i; else break; }
  return L;
}

// Zero's gift-affinity life skill. A flat +5% to bond gained from gifts, applied only
// while the RECIPIENT's bond level is at or below a cap that rises with Zero's skill
// rank (rank 1 -> level 4 ... rank 5 -> level 8; cap = rank + 3). The bonus never
// stacks; higher ranks only raise the cap. It is global (every character's gifts are
// boosted, each gated by its own bond level) and "always on" once Zero is owned, so
// the only input is Zero's rank. Rank 0 / unknown = Zero not owned = no boost.
// `bondZeroCap` returns the active cap, or -1 when off (no level <= -1, so no boost).
function bondZeroCap(rank) { const r = rank | 0; return (r >= 1 && r <= 5) ? (r + 3) : -1; }

// Bond a single gift grants after Zero's boost, given the recipient's CURRENT bond
// level and the active cap (-1 = off). Rounded to nearest, per gift. With no cap (or a
// state that never sets zeroCap) this returns the base bond unchanged - so the boost
// stays dormant until a caller opts in by passing zeroCap.
function bondEffGiftBond(baseBond, level, zeroCap) {
  const b = Math.max(0, baseBond | 0);
  return (typeof zeroCap === 'number' && level <= zeroCap) ? Math.round(b * (1 + BOND_ZERO_GIFT_BONUS)) : b;
}

// Bond Guide cost of taking ONE character from bond 0/0 exp to max using only
// a single gift item of `tierBond` (100/200/400) at `costPerUnit` Fons. Options:
//   zeroRank  - Zero's gift life-skill rank 1..5 (0/omitted = off), see bondZeroCap
//   dating    - hold the daily date: +BOND_DATE_BOND per day, starting the day the
//               character actually reaches bond level 4 (wherever the gift overflow lands,
//               e.g. Lv 4 + 50 exp -- never assumed to be exactly Lv 4 / 0 exp)
//   freeCloud - one free (0 Fons) BOND_FREE_CLOUD_BOND gift per day. It uses one of the
//               day's BOND_GIFT_CAP gift slots and is given first, so the day becomes
//               1 cloud + (cap - 1) bought gifts. It is a gift, so Zero's boost applies.
//   maxLevel  - stop at this bond level instead of BOND_MAX_LEVEL, for a character whose
//               bond caps lower (e.g. Aurelia: 2). Below the dating gate, dating never kicks in.
//   combatDateLevel - for a character whose only date is a combat date (e.g. Zankou: 8):
//               it takes the place of the daily date, so it's counted only with `dating`
//               on, and starts at this level instead of BOND_DATE_GATE_LEVEL (4).
//   noDating  - the character can't be dated (no city hangouts): `dating` is ignored.
//   oneTimeBond - one-time bond (quests + gestures), applied in one lump the moment the
//               character reaches oneTimeLevel (default: Lv 9, or the last level below a
//               lower maxLevel). Gestures only unlock at Lv 4/6, so doing them early can't
//               start dates sooner; the only timing effect left is Zero's +5%, which favors
//               waiting until past its cap. Lv 9 is never worse than any other level.
// Days assume the per-character gift cap (BOND_GIFT_CAP gifts/day). Each day: free cloud,
// then bought gifts, then the date.
// Returns { gifts, clouds, days, fons, oneTimeLevel }: gifts = BOUGHT gifts only
// (fons = gifts * cost), clouds = free clouds used, oneTimeLevel = the level the one-time
// lump was applied at (null without one). With all options off: gifts = ceil(56100 / tierBond).
function bondGuideCost(tierBond, costPerUnit, opts) {
  const o = opts || {};
  const lump = Math.max(0, (o.oneTimeBond | 0));
  const maxL = o.maxLevel == null ? BOND_MAX_LEVEL : o.maxLevel;
  const bond = Math.max(0, tierBond | 0), cost = Math.max(0, costPerUnit | 0);
  const zeroCap = bondZeroCap(o.zeroRank);
  const goal = bondCumAtLevel(maxL);
  const GATE = bondCumAtLevel(o.combatDateLevel == null ? BOND_DATE_GATE_LEVEL : o.combatDateLevel);
  const cloud = !!o.freeCloud;
  const dating = !!o.dating && !o.noDating;
  const lumpLevel = lump > 0 ? (o.oneTimeLevel == null ? Math.max(0, Math.min(BOND_MAX_LEVEL, maxL) - 1) : (o.oneTimeLevel | 0)) : null;
  if (goal <= 0) return { gifts: 0, clouds: 0, days: 0, fons: 0, oneTimeLevel: null };
  if (bond <= 0 && !cloud) return { gifts: 0, clouds: 0, days: null, fons: 0, oneTimeLevel: null };
  let cum = 0, days = 0, gifts = 0, clouds = 0, lumpDone = lump <= 0;
  // The lump can be done any time, so it lands the instant the character reaches its level.
  const tryLump = () => { if (!lumpDone && bondLevelFromCum(cum) >= lumpLevel) { cum += lump; lumpDone = true; } };
  while (cum < goal) {
    tryLump();
    let slots = BOND_GIFT_CAP;
    if (cloud && slots > 0 && cum < goal) { cum += bondEffGiftBond(BOND_FREE_CLOUD_BOND, bondLevelFromCum(cum), zeroCap); clouds++; slots--; tryLump(); }
    if (bond > 0) for (let g = 0; g < slots && cum < goal; g++) {
      cum += bondEffGiftBond(bond, bondLevelFromCum(cum), zeroCap);
      gifts++; tryLump();
    }
    if (dating && cum >= GATE && cum < goal) { cum += BOND_DATE_BOND; tryLump(); }
    days++;
  }
  return { gifts, clouds, days, fons: gifts * cost, oneTimeLevel: lumpLevel };
}

// CommonJS export for Node. Skipped in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BOND_NEEDED, BOND_CUM, BOND_MAX_LEVEL, BOND_DATE_GATE_LEVEL, BOND_DATE_BOND,
    BOND_GIFT_CAP, BOND_ZERO_GIFT_BONUS, BOND_FREE_CLOUD_BOND,
    bondCumAtLevel, bondLevelFromCum, bondZeroCap, bondEffGiftBond, bondGuideCost,
  };
}
