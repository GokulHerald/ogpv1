const mongoose = require('mongoose');

const Match = require('../models/Match');
const Leaderboard = require('../models/Leaderboard');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Bracket = require('../models/Bracket');
const { advanceWinner } = require('../utils/bracket.utils');

/**
 * Apply BR lobby per-player stats to tournament leaderboard (kill points, optional #1 placement bonus, score).
 */
async function applyBrSquadStatsToLeaderboard(tournamentId, statRows) {
  let leaderboard = await Leaderboard.findOne({ tournament: tournamentId });
  if (!leaderboard) {
    leaderboard = await Leaderboard.create({ tournament: tournamentId, entries: [] });
  }

  const killPts = Number(leaderboard.scoringConfig?.killPoints ?? 2);
  const placementBonus = Number(leaderboard.scoringConfig?.placementBonus ?? 5);

  for (const row of statRows) {
    const uid = String(row.user?._id ?? row.user);
    if (!uid || !mongoose.Types.ObjectId.isValid(uid)) continue;

    let entry = leaderboard.entries.find((e) => String(e.player) === uid);
    if (!entry) {
      leaderboard.entries.push({
        player: new mongoose.Types.ObjectId(uid),
        points: 0,
        wins: 0,
        matchesPlayed: 0,
      });
      entry = leaderboard.entries[leaderboard.entries.length - 1];
    }

    const kills = Number(row.kills ?? 0);
    const placement = row.placement == null ? null : Number(row.placement);
    const score = Number(row.score ?? 0);

    let delta = killPts * kills + score;
    if (placement === 1) {
      delta += placementBonus;
      entry.wins = (entry.wins || 0) + 1;
    }

    entry.points = (entry.points || 0) + delta;
    entry.matchesPlayed = (entry.matchesPlayed || 0) + 1;
  }

  leaderboard.lastUpdated = new Date();
  await leaderboard.save();
}

async function getMatchesByTournament(req, res) {
  try {
    const { tournamentId } = req.params;
    const { round } = req.query;

    const filters = { tournament: tournamentId };
    if (round) {
      filters.round = Number(round);
    }

    const matches = await Match.find(filters)
      .populate('player1', 'username firstName lastName profilePicture')
      .populate('player2', 'username firstName lastName profilePicture')
      .populate('winner', 'username firstName lastName profilePicture')
      .populate({
        path: 'brTeams.team',
        select: 'name captain members',
        populate: [
          { path: 'captain', select: 'username firstName lastName profilePicture' },
          { path: 'members', select: 'username firstName lastName profilePicture' },
        ],
      })
      .populate('brTeams.players', 'username firstName lastName profilePicture')
      .populate('winnerTeam', 'name captain')
      .sort({ round: 1, matchNumber: 1 });

    return res.status(200).json({ matches });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch matches' });
  }
}

function findBrSlot(match, userId) {
  if (match.kind !== 'br_lobby' || !Array.isArray(match.brTeams)) return null;
  for (const slot of match.brTeams) {
    const teamId = slot.team?._id || slot.team;
    const players = slot.players || [];
    if (players.some((p) => String(p) === userId || String(p?._id) === userId)) {
      return { teamId: String(teamId) };
    }
  }
  return null;
}

async function submitStreamLink(req, res) {
  try {
    const { matchId } = req.params;
    const { streamUrl } = req.body;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const userId = String(req.user._id);

    const allowedPrefixes = [
      'https://youtube.com',
      'https://youtu.be',
      'https://www.youtube.com',
      'https://twitch.tv',
      'https://www.twitch.tv',
      'https://fb.gg',
      'https://www.facebook.com/gaming',
    ];
    const normalized =
      typeof streamUrl === 'string' ? streamUrl.trim().toLowerCase() : '';
    const validUrl = allowedPrefixes.some((p) => normalized.startsWith(p));
    if (!validUrl) {
      return res.status(400).json({
        message: 'Only YouTube, Twitch, or Facebook Gaming links accepted',
      });
    }

    if (match.kind === 'br_lobby') {
      const slot = findBrSlot(match, userId);
      if (!slot) {
        return res.status(403).json({ message: 'You are not a participant in this match' });
      }
      if (!match.proof.squadStreams) {
        match.proof.squadStreams = [];
      }
      const idx = match.proof.squadStreams.findIndex((s) => String(s.user) === userId);
      if (idx >= 0) {
        match.proof.squadStreams[idx].streamUrl = streamUrl;
        match.proof.squadStreams[idx].team = slot.teamId;
      } else {
        match.proof.squadStreams.push({
          user: req.user._id,
          team: slot.teamId,
          streamUrl,
          screenshot: '',
        });
      }
    } else {
      const isPlayer1 = match.player1 && String(match.player1) === userId;
      const isPlayer2 = match.player2 && String(match.player2) === userId;
      if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ message: 'You are not a participant in this match' });
      }

      if (isPlayer1) {
        match.proof.player1StreamUrl = streamUrl;
      }
      if (isPlayer2) {
        match.proof.player2StreamUrl = streamUrl;
      }
    }

    if (match.status === 'pending') {
      match.status = 'live';
    }

    await match.save();
    const updated = await Match.findById(matchId)
      .populate('player1', 'username firstName lastName profilePicture')
      .populate('player2', 'username firstName lastName profilePicture')
      .populate({
        path: 'brTeams.team',
        select: 'name captain members',
        populate: [
          { path: 'captain', select: 'username firstName lastName profilePicture' },
          { path: 'members', select: 'username firstName lastName profilePicture' },
        ],
      })
      .populate('brTeams.players', 'username firstName lastName profilePicture');

    return res.status(200).json({ message: 'Stream link submitted', match: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to submit stream link' });
  }
}

async function submitMatchProof(req, res) {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const userId = String(req.user._id);

    if (match.status === 'completed') {
      return res.status(400).json({ message: 'Match is already completed' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a screenshot' });
    }

    if (match.kind === 'br_lobby') {
      const slot = findBrSlot(match, userId);
      if (!slot) {
        return res.status(403).json({ message: 'You are not a participant in this match' });
      }
      if (!match.proof.squadStreams) {
        match.proof.squadStreams = [];
      }
      const idx = match.proof.squadStreams.findIndex((s) => String(s.user) === userId);
      if (idx >= 0) {
        match.proof.squadStreams[idx].screenshot = req.file.path;
        match.proof.squadStreams[idx].team = slot.teamId;
      } else {
        match.proof.squadStreams.push({
          user: req.user._id,
          team: slot.teamId,
          streamUrl: '',
          screenshot: req.file.path,
        });
      }
    } else {
      const isPlayer1 = match.player1 && String(match.player1) === userId;
      const isPlayer2 = match.player2 && String(match.player2) === userId;
      if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ message: 'You are not a participant in this match' });
      }

      if (isPlayer1) {
        match.proof.player1Screenshot = req.file.path;
      }
      if (isPlayer2) {
        match.proof.player2Screenshot = req.file.path;
      }
    }

    await match.save();
    const updated = await Match.findById(matchId)
      .populate('player1', 'username firstName lastName profilePicture')
      .populate('player2', 'username firstName lastName profilePicture')
      .populate({
        path: 'brTeams.team',
        select: 'name captain members',
        populate: [
          { path: 'captain', select: 'username firstName lastName profilePicture' },
          { path: 'members', select: 'username firstName lastName profilePicture' },
        ],
      })
      .populate('brTeams.players', 'username firstName lastName profilePicture');

    return res.status(200).json({
      message: 'Screenshot uploaded successfully',
      screenshotUrl: req.file.path,
      match: updated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to submit screenshot' });
  }
}

async function setMatchResult(req, res) {
  try {
    const { matchId } = req.params;
    const {
      winnerId,
      player1Kills,
      player2Kills,
      player1Placement,
      player2Placement,
      player1Score,
      player2Score,
      notes,
    } = req.body;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    if (match.status === 'completed') {
      return res.status(400).json({ message: 'Match result already set' });
    }

    match.result.player1Kills = player1Kills;
    match.result.player2Kills = player2Kills;
    match.result.player1Placement = player1Placement;
    match.result.player2Placement = player2Placement;
    match.result.player1Score = player1Score;
    match.result.player2Score = player2Score;
    match.result.notes = notes || '';
    match.result.verifiedBy = req.user._id;
    match.result.verifiedAt = Date.now();
    await match.save();

    if (typeof advanceWinner !== 'function') {
      return res.status(500).json({ message: 'Bracket advancement is not configured' });
    }

    const bracketUpdate = await advanceWinner(matchId, winnerId);

    const leaderboard = await Leaderboard.findOne({ tournament: match.tournament });
    if (leaderboard) {
      const winnerEntry = leaderboard.entries.find(
        (entry) => String(entry.player) === String(winnerId)
      );
      if (winnerEntry) {
        const winnerScore =
          String(winnerId) === String(match.player1) ? Number(player1Score || 0) : Number(player2Score || 0);
        winnerEntry.wins += 1;
        winnerEntry.points += Number(leaderboard.scoringConfig.winPoints || 0) + winnerScore;
        await leaderboard.save();
      }
    }

    const updatedMatch = await Match.findById(matchId);

    return res.status(200).json({
      message: 'Result recorded',
      match: updatedMatch,
      bracketUpdate,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to set match result' });
  }
}

async function setBrStats(req, res) {
  try {
    const { matchId } = req.params;
    const { squadStats = [] } = req.body;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }
    if (match.kind !== 'br_lobby') {
      return res.status(400).json({ message: 'BR stats can only be submitted for a BR lobby match' });
    }
    if (!Array.isArray(match.brTeams) || match.brTeams.length === 0) {
      return res.status(400).json({ message: 'BR lobby roster not found' });
    }

    const tournament = await Tournament.findById(match.tournament);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    if (tournament.format !== 'battle_royale_squad') {
      return res.status(400).json({ message: 'This tournament is not a squad BR tournament' });
    }
    if (String(tournament.organizer) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the tournament organizer can submit BR stats' });
    }
    if (tournament.status !== 'ongoing') {
      return res.status(400).json({ message: 'Tournament is not ongoing' });
    }

    if (
      match.result?.verifiedAt &&
      Array.isArray(match.result.squadStats) &&
      match.result.squadStats.length > 0
    ) {
      return res.status(400).json({ message: 'BR stats already submitted for this match' });
    }

    if (!Array.isArray(squadStats) || squadStats.length === 0) {
      return res.status(400).json({ message: 'squadStats is required' });
    }

    const allowed = new Map(); // userId -> teamId
    for (const slot of match.brTeams) {
      const teamId = String(slot.team?._id || slot.team);
      (slot.players || []).forEach((p) => {
        const uid = String(p?._id || p);
        allowed.set(uid, teamId);
      });
    }

    const seen = new Set();
    const rows = [];
    for (const r of squadStats) {
      const userId = String(r.userId || '').trim();
      if (!userId) {
        return res.status(400).json({ message: 'Each row must include userId' });
      }
      if (!allowed.has(userId)) {
        return res.status(400).json({ message: `User ${userId} is not in this lobby roster` });
      }
      if (seen.has(userId)) {
        return res.status(400).json({ message: `Duplicate userId ${userId} in squadStats` });
      }
      seen.add(userId);

      const kills = Number(r.kills ?? 0);
      const placement = r.placement == null || r.placement === '' ? null : Number(r.placement);
      const score = Number(r.score ?? 0);
      if (!Number.isFinite(kills) || kills < 0) {
        return res.status(400).json({ message: `Invalid kills for user ${userId}` });
      }
      if (placement != null && (!Number.isFinite(placement) || placement < 1)) {
        return res.status(400).json({ message: `Invalid placement for user ${userId}` });
      }
      if (!Number.isFinite(score)) {
        return res.status(400).json({ message: `Invalid score for user ${userId}` });
      }

      rows.push({
        user: userId,
        team: allowed.get(userId),
        kills,
        placement,
        score,
      });
    }

    const firstPlaceRows = rows.filter((r) => Number(r.placement) === 1);
    if (firstPlaceRows.length === 0) {
      return res.status(400).json({
        message: 'BR stats must include at least one player with placement = 1 to determine the winning squad',
      });
    }
    const winnerTeamId = String(firstPlaceRows[0].team);
    const conflictingWinnerTeam = firstPlaceRows.some((r) => String(r.team) !== winnerTeamId);
    if (conflictingWinnerTeam) {
      return res.status(400).json({
        message: 'Invalid BR stats: placement = 1 must belong to exactly one squad',
      });
    }

    const winnerTeam = await Team.findOne({ _id: winnerTeamId, tournament: tournament._id });
    if (!winnerTeam) {
      return res.status(404).json({ message: 'Winning team not found in this tournament' });
    }

    match.result.squadStats = rows;
    match.result.verifiedBy = req.user._id;
    match.result.verifiedAt = Date.now();
    match.winnerTeam = winnerTeam._id;
    match.status = 'completed';
    await match.save();

    await applyBrSquadStatsToLeaderboard(match.tournament, rows);

    tournament.status = 'completed';
    tournament.winnerTeam = winnerTeam._id;

    const bracket = await Bracket.findOne({ tournament: tournament._id });
    if (bracket) {
      bracket.isComplete = true;
      bracket.championTeam = winnerTeam._id;
      bracket.champion = winnerTeam.captain;
      tournament.bracket = bracket._id;
      await bracket.save();
    }

    await tournament.save();

    // Prize payout mirrors setBrWinner behavior (credit captain wallet and log payout payment).
    const Wallet = require('../models/Wallet');
    const Payment = require('../models/Payment');

    const captainId = winnerTeam.captain;
    let wallet = await Wallet.findOne({ user: captainId });
    if (!wallet) {
      wallet = await Wallet.create({ user: captainId });
    }

    const prizeAmount = Number(tournament.prizePool) || 0;
    if (prizeAmount > 0) {
      wallet.balance += prizeAmount;
      wallet.totalEarned += prizeAmount;
      await wallet.save();

      await Payment.create({
        player: captainId,
        tournament: tournament._id,
        amount: prizeAmount,
        amountInPaisa: Math.round(prizeAmount * 100),
        gateway: 'esewa',
        type: 'prize_payout',
        status: 'completed',
        transactionUuid: `PRIZE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        paidAt: new Date(),
        metadata: {
          note: 'Prize credited to captain wallet; squad distribution is manual.',
          teamId: String(winnerTeam._id),
          source: 'br-stats',
        },
      });
    }

    const updated = await Match.findById(matchId)
      .populate({
        path: 'brTeams.team',
        select: 'name captain members',
        populate: [
          { path: 'captain', select: 'username firstName lastName profilePicture' },
          { path: 'members', select: 'username firstName lastName profilePicture' },
        ],
      })
      .populate('brTeams.players', 'username firstName lastName profilePicture');

    return res.status(200).json({
      message: 'BR stats saved; winner finalized',
      match: updated,
      winnerTeamId: String(winnerTeam._id),
      tournamentStatus: tournament.status,
      prizeCredited: prizeAmount > 0,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save BR stats' });
  }
}

module.exports = {
  getMatchesByTournament,
  submitStreamLink,
  submitMatchProof,
  setMatchResult,
  setBrStats,
};

