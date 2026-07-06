/* Runnable check: `node utils/leaderboard.utils.test.js` (no DB, no framework). */
const assert = require('assert');
const { aggregateGlobalLeaderboard } = require('./leaderboard.utils');

// Same player across two tournaments accumulates; ranking is by points.
const data = [
  { entries: [
    { player: { _id: 'a', username: 'alice' }, points: 30, wins: 2, matchesPlayed: 3 },
    { player: { _id: 'b', username: 'bob' }, points: 10, wins: 1, matchesPlayed: 2 },
  ] },
  { entries: [
    { player: { _id: 'a', username: 'alice' }, points: 5, wins: 0, matchesPlayed: 1 },
    { player: { _id: 'c', username: 'cara' }, points: 50, wins: 5, matchesPlayed: 5 },
    { player: null, points: 999, wins: 9, matchesPlayed: 9 }, // ignored: no player
  ] },
];

const rows = aggregateGlobalLeaderboard(data);

assert.strictEqual(rows.length, 3, 'three distinct players');
assert.deepStrictEqual(rows.map((r) => r.playerId), ['c', 'a', 'b'], 'ranked by points desc');
assert.deepStrictEqual(rows.map((r) => r.rank), [1, 2, 3], 'ranks are 1..n');

const alice = rows.find((r) => r.playerId === 'a');
assert.strictEqual(alice.points, 35, 'alice points summed across tournaments');
assert.strictEqual(alice.wins, 2, 'alice wins summed');
assert.strictEqual(alice.matchesPlayed, 4, 'alice matches summed');
assert.strictEqual(alice.tournaments, 2, 'alice played in two tournaments');

// Wins break ties when points are equal.
const tie = aggregateGlobalLeaderboard([
  { entries: [
    { player: { _id: 'x' }, points: 10, wins: 1, matchesPlayed: 1 },
    { player: { _id: 'y' }, points: 10, wins: 3, matchesPlayed: 1 },
  ] },
]);
assert.deepStrictEqual(tie.map((r) => r.playerId), ['y', 'x'], 'tie broken by wins');

// limit caps the result.
assert.strictEqual(aggregateGlobalLeaderboard(data, 1).length, 1, 'limit respected');

console.log('leaderboard.utils: all assertions passed');
