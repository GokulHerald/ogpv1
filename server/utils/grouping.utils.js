/**
 * Pure helpers for auto-grouping a solo player pool into squads and splitting
 * teams into battle-royale lobbies. Kept dependency-free so they're unit-testable.
 */

/** Fisher-Yates shuffle. `rng` is injectable for deterministic tests. */
function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Chunk a shuffled player pool into squads of `squadSize`.
 * A trailing remainder becomes one smaller squad if it has >= 2 players;
 * a single leftover player can't form a squad and is returned separately.
 */
function formSquadsFromPool(playerIds, squadSize, rng = Math.random) {
  const size = Math.max(2, Number(squadSize) || 0);
  const pool = shuffle(playerIds, rng);
  const squads = [];
  let i = 0;
  for (; i + size <= pool.length; i += size) {
    squads.push(pool.slice(i, i + size));
  }
  const rest = pool.slice(i);
  const leftover = [];
  if (rest.length >= 2) squads.push(rest);
  else leftover.push(...rest);
  return { squads, leftover };
}

/**
 * Split team ids into lobbies of at most `lobbySize` teams.
 * A falsy/<=0 lobbySize means everyone shares one lobby.
 */
function splitIntoLobbies(teamIds, lobbySize) {
  if (!teamIds.length) return [];
  const size = Number(lobbySize) > 0 ? Number(lobbySize) : teamIds.length;
  const lobbies = [];
  for (let i = 0; i < teamIds.length; i += size) {
    lobbies.push(teamIds.slice(i, i + size));
  }
  return lobbies;
}

module.exports = { shuffle, formSquadsFromPool, splitIntoLobbies };
