// logic.js: Callbreak scoring rules (no UI code here).
// Works in the browser (functions become global) and in Node (module.exports).

const TRICKS_PER_ROUND = 13;
const PLAYERS = 4;
const BLIND_MIN_BID = 5;   // blind bid must be at least 5
const BLIND_FAIL = 5;      // blind miss always costs 5

/**
 * Score one player for one round, in tenths (whole numbers, so no float errors).
 * Normal bid:
 *   Missed bid             -> minus bid                  (bid 4, won 2 -> -40 = -4)
 *   Won double bid or more -> minus bid                  (bid 3, won 6 -> -30 = -3)
 *   Made bid               -> bid + 0.1 per extra trick  (bid 3, won 5 ->  32 = 3.2)
 * Blind bid (minimum 5):
 *   Made bid  -> double the tricks won   (bid 5, won 7 -> 140 = 14)
 *   Missed    -> minus 5 only            (bid 6, won 4 -> -50 = -5)
 */
function roundScore(bid, won, blind = false) {
  if (blind) return won >= bid ? won * 2 * 10 : -BLIND_FAIL * 10;
  if (won < bid) return -bid * 10;        // missed the bid
  if (won >= bid * 2) return -bid * 10;   // won double (or more) -> penalty
  return bid * 10 + (won - bid);          // made it
}

/** Tenths -> display text: 32 -> "3.2", -40 -> "-4" */
function formatScore(tenths) {
  const v = tenths / 10;
  return tenths % 10 === 0 ? v.toFixed(0) : v.toFixed(1);
}

/** Returns a list of problems with a round (empty list = valid). */
function validateRound(bids, won, blind = []) {
  const errors = [];
  bids.forEach((b, i) => {
    if (blind[i] && b < BLIND_MIN_BID) errors.push(`Player ${i + 1}: blind bid must be ${BLIND_MIN_BID}+`);
  });
  bids.forEach((b, i) => {
    if (!Number.isInteger(b) || b < 1 || b > 13) errors.push(`Player ${i + 1}: bid must be 1-13`);
  });
  won.forEach((w, i) => {
    if (!Number.isInteger(w) || w < 0 || w > 13) errors.push(`Player ${i + 1}: tricks must be 0-13`);
  });
  const sum = won.reduce((a, w) => a + (w || 0), 0);
  if (sum !== TRICKS_PER_ROUND) errors.push(`Tricks add up to ${sum}, must be ${TRICKS_PER_ROUND}`);
  return errors;
}

/** If exactly one player's tricks are missing, fill it with what's left of 13. */
function autoFillLast(won) {
  const empty = won.map((w, i) => (w == null ? i : -1)).filter(i => i >= 0);
  if (empty.length !== 1) return won;
  const rest = TRICKS_PER_ROUND - won.reduce((a, w) => a + (w || 0), 0);
  if (rest < 0) return won;
  const out = [...won];
  out[empty[0]] = rest;
  return out;
}

/** Running totals for every player across saved rounds (in tenths). */
function totals(rounds) {
  const t = new Array(PLAYERS).fill(0);
  for (const r of rounds) r.bids.forEach((b, i) => (t[i] += roundScore(b, r.won[i], r.blind && r.blind[i])));
  return t;
}

/** Highest total; several names if tied. */
function winners(names, rounds) {
  const t = totals(rounds);
  const max = Math.max(...t);
  return { names: names.filter((_, i) => t[i] === max), score: max };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRICKS_PER_ROUND, PLAYERS, BLIND_MIN_BID, BLIND_FAIL, roundScore, formatScore, validateRound, autoFillLast, totals, winners };
}
