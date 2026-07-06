/**
 * Pure aggregation for the global ("career") leaderboard.
 * Sums each player's points/wins/matches across every tournament leaderboard,
 * ranks by points (wins as tiebreaker), and returns the top `limit`.
 *
 * ponytail: in-memory reduce over all Leaderboard docs. Data here is tiny
 * (one doc per tournament). If tournaments ever number in the thousands,
 * swap this for a Mongo $unwind/$group aggregation pipeline.
 */
function aggregateGlobalLeaderboard(leaderboards, limit = 100) {
  const byPlayer = new Map();

  for (const lb of leaderboards || []) {
    for (const e of lb.entries || []) {
      const p = e.player;
      if (!p) continue;
      const id = String(p._id || p);

      const cur = byPlayer.get(id) || {
        playerId: id,
        player: typeof p === 'object' ? p : null,
        points: 0,
        wins: 0,
        matchesPlayed: 0,
        tournaments: 0,
      };

      cur.points += Number(e.points || 0);
      cur.wins += Number(e.wins || 0);
      cur.matchesPlayed += Number(e.matchesPlayed || 0);
      cur.tournaments += 1;
      if (!cur.player && typeof p === 'object') cur.player = p;

      byPlayer.set(id, cur);
    }
  }

  return Array.from(byPlayer.values())
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .slice(0, Math.max(1, limit))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

module.exports = { aggregateGlobalLeaderboard };
