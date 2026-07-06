/* Runnable check: `node utils/grouping.utils.test.js` (no DB, no framework). */
const assert = require('assert');
const { formSquadsFromPool, splitIntoLobbies } = require('./grouping.utils');

// Deterministic "rng" that preserves order: a value just under 1 makes
// Fisher-Yates pick j === i every step (a no-op swap).
const noShuffle = () => 1 - 1e-9;

// 8 players, squads of 4 => two full squads, no leftover.
{
  const { squads, leftover } = formSquadsFromPool([1, 2, 3, 4, 5, 6, 7, 8], 4, noShuffle);
  assert.deepStrictEqual(squads, [[1, 2, 3, 4], [5, 6, 7, 8]], 'two full squads');
  assert.deepStrictEqual(leftover, [], 'no leftover');
}

// 10 players, squads of 4 => 4 + 4 + remainder(2) becomes a small squad.
{
  const { squads, leftover } = formSquadsFromPool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, noShuffle);
  assert.deepStrictEqual(squads, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10]], 'remainder of 2 forms a squad');
  assert.deepStrictEqual(leftover, [], 'no lone leftover');
}

// 9 players, squads of 4 => 4 + 4 + lone leftover (1) can't play.
{
  const { squads, leftover } = formSquadsFromPool([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, noShuffle);
  assert.deepStrictEqual(squads, [[1, 2, 3, 4], [5, 6, 7, 8]], 'two full squads');
  assert.deepStrictEqual(leftover, [9], 'lone player left ungrouped');
}

// Lobby split: 5 teams, 2 per lobby => [2,2,1].
assert.deepStrictEqual(
  splitIntoLobbies(['a', 'b', 'c', 'd', 'e'], 2),
  [['a', 'b'], ['c', 'd'], ['e']],
  'teams chunked into lobbies'
);

// lobbySize falsy => single lobby with everyone.
assert.deepStrictEqual(
  splitIntoLobbies(['a', 'b', 'c'], 0),
  [['a', 'b', 'c']],
  'no lobby size => one lobby'
);

assert.deepStrictEqual(splitIntoLobbies([], 4), [], 'no teams => no lobbies');

console.log('grouping.utils: all assertions passed');
