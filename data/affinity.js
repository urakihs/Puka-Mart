// ============================================================================
//  affinity.js - Character Affinity / Bond ladder + constants.
// ----------------------------------------------------------------------------
//  Loaded by index.html via <script>, and by the test harness via require()
//  (its exports are installed as globals before calc.js loads, mirroring the
//  other data files like costs.js).
//
//  The bond EXP ladder is ROSTER-INDEPENDENT: every character levels 0..10 on
//  the same curve. Per-character gift items (name / Fons cost / bond granted)
//  and owned quantities are entered by the player at runtime and live in the
//  save (affinityState) - they are NOT defined here.
//
//  GROUND RULES
//   - BOND_NEEDED[i] = bond EXP to go from bond level i to i+1 (i = 0..9).
//   - BOND_CUM[i]    = cumulative bond EXP banked AT level i (BOND_CUM[0] = 0,
//                      BOND_CUM[10] = full). Derived from BOND_NEEDED; do not
//                      hand-edit BOND_CUM.
//   - Keep this file PLAIN ASCII (no special glyphs), so it is safe to commit
//     through any tool. The values below are confirmed from in-game data
//     (see docs/AFFINITY_BOND_DATA.md).
//   - After editing: run `node --check app/data/affinity.js`.
// ============================================================================

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
const BOND_GLOBAL_GIFT_CAP = 10;  // max gifts across the whole roster per day
const BOND_DAILY_DATE_CAP = 1;    // at most one character can be dated per day
const BOND_ZERO_GIFT_BONUS = 0.05; // Zero's life skill: flat +5% bond from gifts (see bondZeroCap)
const BOND_FREE_CLOUD_BOND = 400; // free daily Fluffy Cloud gift (0 Fons, uses a gift slot)

// ---------------------------------------------------------------------------
//  Pure bond functions. Self-contained (they touch only the BOND_* constants
//  above, never any calc.js helper), so the whole affinity domain - data and
//  math - lives in this one ASCII module. Mirrors calc.js: usable in the browser
//  via <script> and in Node via require().
//
//  A bond "state" object (st) is the player's saved plan for one character:
//    { active, level, exp, target, gifts, dating, item }
//      level   - current bond level (0..BOND_MAX_LEVEL)
//      exp     - bond EXP earned WITHIN the current level (0..BOND_NEEDED[level])
//      target  - target bond level (defaults to BOND_MAX_LEVEL)
//      gifts   - gifts/day allocated to this character (0..BOND_GIFT_CAP)
//      dating  - whether this character holds the daily date (free bond/day)
//      item    - the active gift { fons, bond, owned } or null when gifting is off
//      zeroCap - (optional) Zero's active gift-boost cap from bondZeroCap(rank);
//                gifts get +5% bond while this character's level <= zeroCap. Omit
//                (or -1) to disable - projections then behave as if Zero is unowned.
//  Progress is NEVER advanced here; these only project forward from the
//  player-entered level/exp. The player keeps level/exp truthful by hand.
// ---------------------------------------------------------------------------

function bondCumAtLevel(level) {
  const L = Math.max(0, Math.min(level | 0, BOND_MAX_LEVEL));
  return BOND_CUM[L];
}

// Total cumulative bond EXP from level + within-level EXP. The cumulative figure
// is internal; the UI only ever shows level + within-level exp.
function bondCurrentCum(level, expInLevel) {
  const L = Math.max(0, Math.min(level | 0, BOND_MAX_LEVEL));
  const within = L < BOND_MAX_LEVEL ? Math.max(0, Math.min(expInLevel | 0, BOND_NEEDED[L])) : 0;
  return BOND_CUM[L] + within;
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

// Project the saved plan forward to the target. Day-by-day so the level-4 dating
// gate is honored mid-run. Returns:
//   { remaining, days, gifts, fons, planToday, feasible, endLevel, endExp }
//     remaining - bond EXP still needed to reach target (0 if already met)
//     days      - days to reach target at this plan (0 if met; null if stuck)
//     gifts     - total gifts that must be given to reach target
//     fons      - Fons still owed = (gifts - owned) * item.fons (0 if no item)
//     planToday - bond gained today if the plan is followed (capped at remaining)
//     feasible  - false when nothing can advance bond toward the target
//     endLevel  - bond level after today's planToday is banked (cascades; caps at max)
//     endExp    - within-level EXP at endLevel after today's planToday is banked
function bondProject(st) {
  const start = bondCurrentCum(st.level, st.exp);
  const goal = bondCumAtLevel(st.target);
  const it = st.item || null;
  const remaining = Math.max(0, goal - start);
  if (remaining <= 0) { const end = bondAdvance(st.level, st.exp, 0); return { remaining: 0, days: 0, gifts: 0, fons: 0, planToday: 0, feasible: true, endLevel: end.level, endExp: end.exp }; }
  const giftBond = it ? (it.bond || 0) : 0;
  const perDayGifts = Math.max(0, st.gifts | 0);
  const canGift = perDayGifts > 0 && giftBond > 0;
  const GATE = BOND_CUM[BOND_DATE_GATE_LEVEL];
  // Only dating advances bond when not gifting - but dating itself can't begin
  // until the gate (level 4) is reached, so dating-only below the gate is stuck.
  if (!canGift && (!st.dating || start < GATE)) {
    const end = bondAdvance(st.level, st.exp, 0);
    return { remaining, days: null, gifts: 0, fons: 0, planToday: 0, feasible: false, endLevel: end.level, endExp: end.exp };
  }
  let cum = start, days = 0, given = 0, guard = 0;
  while (cum < goal && guard++ < 1000000) {
    // Re-evaluate the boost PER GIFT at the recipient's current level, so it switches
    // off mid-day the instant a gift pushes this character past Zero's cap.
    if (canGift) for (let g = 0; g < perDayGifts && cum < goal; g++) {
      cum += bondEffGiftBond(giftBond, bondLevelFromCum(cum), st.zeroCap);
      given++;
    }
    if (st.dating && cum >= GATE && cum < goal) cum += BOND_DATE_BOND;
    days++;
  }
  let planToday = 0;
  if (canGift) {
    let c = start;
    for (let g = 0; g < perDayGifts; g++) { const add = bondEffGiftBond(giftBond, bondLevelFromCum(c), st.zeroCap); planToday += add; c += add; }
  }
  if (st.dating && start >= GATE) planToday += BOND_DATE_BOND;
  planToday = Math.min(planToday, remaining);
  const owned = it ? Math.max(0, it.owned || 0) : 0;
  const fons = it ? Math.max(0, given - owned) * Math.max(0, it.fons || 0) : 0;
  const end = bondAdvance(st.level, st.exp, planToday);
  return { remaining, days, gifts: given, fons, planToday, feasible: true, endLevel: end.level, endExp: end.exp };
}

// Bond Guide (Appendix) cost of taking ONE character from bond 0/0 exp to max using only
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

// Planner-strip sort bucket (lower sorts first):
//   1 active + dating + gifting, 2 active + dating, 3 active + gifting,
//   4 active (neither), 5 inactive. The UI sorts alphabetically within a bucket.
function bondBucket(st) {
  if (!st.active) return 5;
  const gifting = (st.gifts | 0) > 0 && st.item && (st.item.bond || 0) > 0;
  if (st.dating && gifting) return 1;
  if (st.dating) return 2;
  if (gifting) return 3;
  return 4;
}

// Total bond Fons shortfall across all ACTIVE characters - folds into the
// planner's life-skill Fons card. Snoozed characters contribute nothing.
function bondFonsDemand(states) {
  let total = 0;
  for (const st of states || []) {
    if (!st || !st.active) continue;
    total += bondProject(st).fons;
  }
  return total;
}

// Apply a manually-typed within-level exp value. Clamps to the current level's
// requirement; reaching/exceeding it advances exactly ONE level to 0 exp (manual
// entry never cascades). At max level, exp stays 0 (no more is accepted).
function bondApplyManualExp(level, typedExp) {
  let L = Math.max(0, Math.min(level | 0, BOND_MAX_LEVEL));
  const e = Math.max(0, typedExp | 0);
  if (L >= BOND_MAX_LEVEL) return { level: BOND_MAX_LEVEL, exp: 0 };
  if (e >= BOND_NEEDED[L]) return { level: L + 1, exp: 0 };
  return { level: L, exp: e };
}

// Realize a day's earned exp, cascading through as many levels as it covers.
// Unlike manual entry, daily realization rolls over level-by-level and carries
// the remainder. Caps at max level (surplus discarded).
function bondAdvance(level, exp, addExp) {
  let L = Math.max(0, Math.min(level | 0, BOND_MAX_LEVEL));
  let e = Math.max(0, exp | 0) + Math.max(0, addExp | 0);
  while (L < BOND_MAX_LEVEL && e >= BOND_NEEDED[L]) { e -= BOND_NEEDED[L]; L++; }
  if (L >= BOND_MAX_LEVEL) e = 0;
  return { level: L, exp: e };
}

// Exp a plan earns in one day: gifts*giftBond plus the free date bond when the
// character is dating and has reached the gate. Uncapped (realization rolls levels).
function bondDayExp(st) {
  const it = st.item || null;
  const giftBond = it ? (it.bond || 0) : 0;
  const perDayGifts = Math.max(0, st.gifts | 0);
  let c = bondCurrentCum(st.level, st.exp);
  let e = 0;
  if (giftBond > 0) for (let g = 0; g < perDayGifts; g++) { const add = bondEffGiftBond(giftBond, bondLevelFromCum(c), st.zeroCap); e += add; c += add; }
  if (st.dating && bondCurrentCum(st.level, st.exp) >= BOND_CUM[BOND_DATE_GATE_LEVEL]) e += BOND_DATE_BOND;
  return e;
}

// Detect when today's plan reaches max bond WITHOUT spending the whole allocation,
// so the planner can suggest freeing the surplus. Returns:
//   { warn:false }                              not finishing today, or already maxed
//   { warn:true, kind:'dateAlone' }             the date alone reaches max (0 gifts)
//   { warn:true, kind:'gifts', needG, planned, dateNeeded }
// Only flags a gift surplus (fewer gifts than planned) or the date-alone case;
// "all gifts needed but date redundant" is left unflagged.
function bondTodaySurplus(st) {
  const it = st.item || null;
  const giftBond = it ? (it.bond || 0) : 0;
  const planned = Math.max(0, st.gifts | 0);
  const start = bondCurrentCum(st.level, st.exp);
  const rem = BOND_CUM[BOND_MAX_LEVEL] - start;
  if (rem <= 0) return { warn: false };
  const dateOn = !!st.dating && start >= BOND_CUM[BOND_DATE_GATE_LEVEL];
  const dateBonus = dateOn ? BOND_DATE_BOND : 0;
  // Cumulative gift bond after k gifts, with Zero's boost re-evaluated PER GIFT as the
  // recipient's level climbs (cumGift[k] = total bond from the first k gifts).
  const cumGift = [0];
  let c = start;
  for (let g = 0; g < planned; g++) {
    const add = giftBond > 0 ? bondEffGiftBond(giftBond, bondLevelFromCum(c), st.zeroCap) : 0;
    c += add; cumGift.push(cumGift[g] + add);
  }
  const fullDay = cumGift[planned] + dateBonus;
  if (fullDay < rem) return { warn: false }; // won't reach max today
  let needG = 0;
  while (needG < planned && (cumGift[needG] + dateBonus) < rem) needG++;
  const dateNeeded = dateOn ? (cumGift[needG] < rem) : false;
  if (needG === 0 && dateOn) return { warn: true, kind: 'dateAlone' };
  if (needG < planned) return { warn: true, kind: 'gifts', needG, planned, dateNeeded };
  return { warn: false };
}

// CommonJS export for the test runner. Skipped in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BOND_NEEDED, BOND_CUM, BOND_MAX_LEVEL, BOND_DATE_GATE_LEVEL,
    BOND_DATE_BOND, BOND_GIFT_CAP, BOND_GLOBAL_GIFT_CAP, BOND_DAILY_DATE_CAP,
    BOND_ZERO_GIFT_BONUS, BOND_FREE_CLOUD_BOND,
    bondCumAtLevel, bondCurrentCum, bondLevelFromCum, bondZeroCap, bondEffGiftBond,
    bondProject, bondGuideCost, bondBucket, bondFonsDemand,
    bondApplyManualExp, bondAdvance, bondDayExp, bondTodaySurplus,
  };
}
