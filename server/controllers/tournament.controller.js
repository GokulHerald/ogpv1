const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const User = require('../models/User');
const Bracket = require('../models/Bracket');
const Match = require('../models/Match');
const Leaderboard = require('../models/Leaderboard');
const { generateBracket } = require('../utils/bracket.utils');
const crypto = require('crypto');
const mongoose = require('mongoose');

async function addSquadPlayersToLeaderboard(team, tournamentId) {
  const leaderboard = await Leaderboard.findOne({ tournament: tournamentId });
  if (!leaderboard) return;

  const playerIds = [team.captain, ...(team.members || [])].map((id) => String(id));
  for (const pid of playerIds) {
    const exists = leaderboard.entries.some((e) => String(e.player) === pid);
    if (!exists) {
      leaderboard.entries.push({ player: pid, points: 0, wins: 0, matchesPlayed: 0 });
    }
  }
  leaderboard.lastUpdated = new Date();
  await leaderboard.save();
}

async function getUsedPlayerIdsForTournament(tournamentId) {
  const teams = await Team.find({ tournament: tournamentId }).select('captain members');
  const set = new Set();
  for (const t of teams) {
    set.add(String(t.captain));
    (t.members || []).forEach((m) => set.add(String(m)));
  }
  return set;
}

function makeInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
}

async function generateUniqueInviteCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = makeInviteCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Team.findOne({ inviteCode: code }).select('_id');
    if (!exists) return code;
  }
  return `OGP${Date.now().toString(36).toUpperCase()}`;
}

async function createTournament(req, res) {
  try {
    const {
      name,
      game,
      entryFee,
      prizePool,
      maxPlayers,
      startDate,
      rules,
      format = 'single-elimination',
      maxTeams,
      squadSize,
    } = req.body;

    const payload = {
      name,
      game,
      entryFee,
      prizePool,
      startDate,
      rules,
      organizer: req.user._id,
      format,
    };

    if (format === 'battle_royale_squad') {
      const mt = Number(maxTeams);
      const ss = Number(squadSize) || 4;
      if (!Number.isFinite(mt) || mt < 2 || mt > 32) {
        return res.status(400).json({ message: 'maxTeams must be between 2 and 32' });
      }
      if (ss < 2 || ss > 8) {
        return res.status(400).json({ message: 'squadSize must be between 2 and 8' });
      }
      if (mt * ss > 128) {
        return res.status(400).json({ message: 'maxTeams × squadSize cannot exceed 128' });
      }
      payload.maxTeams = mt;
      payload.squadSize = ss;
      payload.maxPlayers = mt * ss;
    } else {
      if (![8, 16, 32].includes(Number(maxPlayers))) {
        return res.status(400).json({ message: 'maxPlayers must be 8, 16, or 32' });
      }
      payload.maxPlayers = Number(maxPlayers);
    }

    const tournament = await Tournament.create(payload);

    const leaderboard = await Leaderboard.create({
      tournament: tournament._id,
    });

    return res.status(201).json({ tournament, leaderboard });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create tournament' });
  }
}

async function getAllTournaments(req, res) {
  try {
    const { game, status } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const skip = (page - 1) * limit;

    const filters = {};
    if (game) filters.game = game;
    if (status) filters.status = status;

    const [tournaments, totalCount] = await Promise.all([
      Tournament.find(filters)
        .populate('organizer', 'username phoneNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Tournament.countDocuments(filters),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return res.status(200).json({
      tournaments,
      totalCount,
      page,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch tournaments' });
  }
}

async function getTournamentById(req, res) {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id)
      .populate('organizer', 'username')
      .populate('registeredPlayers', 'username stats profilePicture')
      .populate({
        path: 'registeredTeams',
        populate: [
          { path: 'captain', select: 'username profilePicture' },
          { path: 'members', select: 'username profilePicture' },
        ],
      })
      .populate('bracket')
      .populate('winnerTeam', 'name captain');

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    return res.status(200).json({ tournament });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch tournament' });
  }
}

async function getMySquadForTournament(req, res) {
  try {
    const { id } = req.params;
    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.format !== 'battle_royale_squad') {
      return res.status(400).json({ message: 'This tournament does not use squad registration' });
    }

    const team = await Team.findOne({
      tournament: tournament._id,
      $or: [{ captain: req.user._id }, { members: req.user._id }],
    })
      .populate('captain', 'username profilePicture')
      .populate('members', 'username profilePicture');

    if (!team) return res.status(404).json({ message: 'No squad found for this tournament' });

    const squadSize = tournament.squadSize || 4;
    const maxMembers = squadSize - 1;
    const isFullTeam = (team.members || []).length === maxMembers;

    return res.status(200).json({
      team,
      inviteCode: team.inviteCode,
      teamSize: squadSize,
      membersNeeded: Math.max(0, maxMembers - (team.members?.length || 0)),
      isFullTeam,
      requiresPayment: tournament.entryFee > 0 && isFullTeam,
      entryFee: tournament.entryFee,
      hasPaid: Boolean(team.entryPayment),
      isRegisteredInTournament:
        (tournament.registeredTeams || []).some((tid) => String(tid) === String(team._id)) ?? false,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load your squad' });
  }
}

async function getMyPlayerPortal(req, res) {
  try {
    const userId = req.user._id;

    const soloTournaments = await Tournament.find({
      registeredPlayers: userId,
    })
      .select('name game status startDate entryFee format')
      .sort({ startDate: -1 });

    const teams = await Team.find({
      $or: [{ captain: userId }, { members: userId }],
    })
      .populate('tournament', 'name game status startDate entryFee format squadSize')
      .populate('captain', 'username profilePicture')
      .populate('members', 'username profilePicture')
      .sort({ createdAt: -1 });

    const squads = teams
      .filter((t) => t.tournament)
      .map((t) => {
        const tournament = t.tournament;
        const squadSize = tournament.squadSize || 4;
        const maxMembers = squadSize - 1;
        const isFullTeam = (t.members || []).length === maxMembers;
        const isRegisteredInTournament =
          (tournament.registeredTeams || []).some((tid) => String(tid) === String(t._id)) ?? false;
        return {
          team: t,
          tournament,
          inviteCode: t.inviteCode,
          teamSize: squadSize,
          membersNeeded: Math.max(0, maxMembers - (t.members?.length || 0)),
          isFullTeam,
          hasPaid: Boolean(t.entryPayment),
          isRegisteredInTournament,
          requiresPayment: tournament.entryFee > 0 && isFullTeam && !Boolean(t.entryPayment),
        };
      });

    return res.status(200).json({ soloTournaments, squads });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load player portal' });
  }
}

async function registerSquad(req, res) {
  try {
    const { id } = req.params;
    const { name = '', memberIds = [] } = req.body;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (tournament.format !== 'battle_royale_squad') {
      return res.status(400).json({ message: 'This tournament does not use squad registration' });
    }

    if (tournament.status !== 'registration') {
      return res.status(400).json({ message: 'Registration is closed for this tournament' });
    }

    if (tournament.isFull) {
      return res.status(400).json({ message: 'Tournament is full' });
    }

    if (req.user.role === 'organizer') {
      return res.status(400).json({ message: 'Organizers cannot register as players' });
    }

    const squadSize = tournament.squadSize || 4;
    const maxMembers = squadSize - 1;
    const safeMemberIds = Array.isArray(memberIds) ? memberIds : [];
    if (safeMemberIds.length > maxMembers) {
      return res.status(400).json({ message: `Squad can have at most ${maxMembers} teammates` });
    }

    const uniq = new Set(safeMemberIds.map(String));
    if (uniq.size !== safeMemberIds.length) {
      return res.status(400).json({ message: 'Duplicate member IDs' });
    }
    if (safeMemberIds.some((mid) => String(mid) === String(req.user._id))) {
      return res.status(400).json({ message: 'Captain cannot be listed in memberIds' });
    }

    const existingCaptainTeam = await Team.findOne({
      tournament: tournament._id,
      captain: req.user._id,
    });
    if (existingCaptainTeam) {
      return res.status(400).json({ message: 'You already have a squad for this tournament' });
    }

    const used = await getUsedPlayerIdsForTournament(tournament._id);
    const squadPlayerIds = [String(req.user._id), ...safeMemberIds.map(String)];
    for (const pid of squadPlayerIds) {
      if (used.has(pid)) {
        return res.status(400).json({
          message: 'One or more players are already registered in another squad',
        });
      }
    }

    // If member IDs were provided (legacy flow), validate them.
    if (safeMemberIds.length) {
      const invalid = safeMemberIds.some((mid) => !mongoose.Types.ObjectId.isValid(String(mid)));
      if (invalid) {
        return res.status(400).json({ message: 'One or more member IDs are invalid' });
      }
      const memberUsers = await User.find({ _id: { $in: safeMemberIds } });
      if (memberUsers.length !== safeMemberIds.length) {
        return res.status(400).json({ message: 'One or more members not found' });
      }
      if (memberUsers.some((u) => u.role === 'organizer')) {
        return res.status(400).json({ message: 'Organizers cannot join as squad members' });
      }
    }

    const inviteCode = await generateUniqueInviteCode();

    const team = await Team.create({
      tournament: tournament._id,
      name: String(name).trim(),
      captain: req.user._id,
      members: safeMemberIds,
      inviteCode,
      inviteCodeCreatedAt: new Date(),
    });

    const isFullTeam = (team.members || []).length === maxMembers;

    if (tournament.entryFee > 0) {
      return res.status(201).json({
        team,
        inviteCode,
        teamSize: squadSize,
        membersNeeded: Math.max(0, maxMembers - (team.members?.length || 0)),
        isFullTeam,
        requiresPayment: true,
        entryFee: tournament.entryFee,
        message: isFullTeam
          ? 'Squad created. Complete payment to confirm registration.'
          : 'Squad created. Invite teammates to fill the squad, then complete payment to register.',
      });
    }

    if (isFullTeam) {
      tournament.registeredTeams.push(team._id);
      await tournament.save();
      await addSquadPlayersToLeaderboard(team, tournament._id);
    }

    const populated = await Team.findById(team._id)
      .populate('captain', 'username profilePicture')
      .populate('members', 'username profilePicture');

    return res.status(201).json({
      message: isFullTeam ? 'Squad registered' : 'Squad created. Share invite code to add teammates.',
      team: populated,
      inviteCode,
      teamSize: squadSize,
      membersNeeded: Math.max(0, maxMembers - (team.members?.length || 0)),
      isFullTeam,
      tournament,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to register squad' });
  }
}

async function joinSquadByInviteCode(req, res) {
  try {
    const { id } = req.params;
    const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();

    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.format !== 'battle_royale_squad') {
      return res.status(400).json({ message: 'This tournament does not use squad registration' });
    }
    if (tournament.status !== 'registration') {
      return res.status(400).json({ message: 'Registration is closed for this tournament' });
    }
    if (tournament.isFull) return res.status(400).json({ message: 'Tournament is full' });

    const squadSize = tournament.squadSize || 4;
    const maxMembers = squadSize - 1;

    const team = await Team.findOne({ tournament: tournament._id, inviteCode });
    if (!team) return res.status(404).json({ message: 'Invalid invite code' });

    if (String(team.captain) === String(req.user._id)) {
      return res.status(400).json({ message: 'Captain is already in this squad' });
    }
    const alreadyMember = (team.members || []).some((m) => String(m) === String(req.user._id));
    if (alreadyMember) return res.status(400).json({ message: 'You are already in this squad' });

    if ((team.members || []).length >= maxMembers) {
      return res.status(400).json({ message: 'Squad is already full' });
    }

    const used = await getUsedPlayerIdsForTournament(tournament._id);
    if (used.has(String(req.user._id))) {
      return res.status(400).json({ message: 'You are already registered in another squad' });
    }

    team.members = [...(team.members || []), req.user._id];
    await team.save();

    const isFullTeam = (team.members || []).length === maxMembers;

    if (isFullTeam && tournament.entryFee === 0) {
      const already = tournament.registeredTeams?.some((tid) => String(tid) === String(team._id));
      if (!already) tournament.registeredTeams.push(team._id);
      await tournament.save();
      await addSquadPlayersToLeaderboard(team, tournament._id);
    }

    const populated = await Team.findById(team._id)
      .populate('captain', 'username profilePicture')
      .populate('members', 'username profilePicture');

    return res.status(200).json({
      message: isFullTeam
        ? tournament.entryFee > 0
          ? 'Joined squad. Captain can now pay to register.'
          : 'Joined squad. Squad registered.'
        : 'Joined squad. Waiting for more teammates.',
      team: populated,
      inviteCode: team.inviteCode,
      teamSize: squadSize,
      membersNeeded: Math.max(0, maxMembers - (team.members?.length || 0)),
      isFullTeam,
      requiresPayment: tournament.entryFee > 0 && isFullTeam,
      entryFee: tournament.entryFee,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to join squad' });
  }
}

async function getSquadRoster(req, res) {
  try {
    const { id } = req.params;
    const inviteCode = String(req.query.inviteCode || '').trim().toUpperCase();
    if (!inviteCode) {
      return res.status(400).json({ message: 'inviteCode query param is required' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.format !== 'battle_royale_squad') {
      return res.status(400).json({ message: 'This tournament does not use squad registration' });
    }

    const team = await Team.findOne({ tournament: tournament._id, inviteCode })
      .populate('captain', 'username profilePicture')
      .populate('members', 'username profilePicture');
    if (!team) return res.status(404).json({ message: 'Invalid invite code' });

    const squadSize = tournament.squadSize || 4;
    const maxMembers = squadSize - 1;
    const isFullTeam = (team.members || []).length === maxMembers;

    return res.status(200).json({
      team,
      inviteCode: team.inviteCode,
      teamSize: squadSize,
      membersNeeded: Math.max(0, maxMembers - (team.members?.length || 0)),
      isFullTeam,
      requiresPayment: tournament.entryFee > 0 && isFullTeam,
      entryFee: tournament.entryFee,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load squad roster' });
  }
}

async function registerForTournament(req, res) {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (tournament.format === 'battle_royale_squad') {
      return res.status(400).json({
        message: 'This tournament uses squad registration. Create a squad with your captain account.',
        requiresSquad: true,
      });
    }

    if (tournament.status !== 'registration') {
      return res
        .status(400)
        .json({ message: 'Registration is closed for this tournament' });
    }

    if (tournament.isFull) {
      return res.status(400).json({ message: 'Tournament is full' });
    }

    const isAlreadyRegistered = tournament.registeredPlayers.some(
      (playerId) => String(playerId) === String(req.user._id)
    );
    if (isAlreadyRegistered) {
      return res.status(400).json({ message: 'You are already registered' });
    }

    if (req.user.role === 'organizer') {
      return res.status(400).json({ message: 'Organizers cannot register as players' });
    }

    if (tournament.entryFee > 0) {
      return res.status(400).json({
        message: 'This tournament requires payment',
        requiresPayment: true,
        entryFee: tournament.entryFee,
      });
    }

    tournament.registeredPlayers.push(req.user._id);

    const leaderboard = await Leaderboard.findOne({ tournament: tournament._id });
    if (leaderboard) {
      leaderboard.entries.push({ player: req.user._id });
      await Promise.all([tournament.save(), leaderboard.save()]);
    } else {
      await tournament.save();
    }

    return res.status(200).json({
      message: 'Successfully registered',
      tournament,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to register for tournament' });
  }
}

async function startTournament(req, res) {
  try {
    const { id } = req.params;
    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (String(tournament.organizer) !== String(req.user._id)) {
      return res
        .status(403)
        .json({ message: 'Only the tournament organizer can start it' });
    }

    if (tournament.status !== 'registration') {
      return res
        .status(400)
        .json({ message: 'Tournament has already started or is completed' });
    }

    if (tournament.format === 'battle_royale_squad') {
      const teamCount = tournament.registeredTeams.length;
      if (teamCount < 2) {
        return res.status(400).json({ message: 'Need at least 2 squads to start' });
      }

      const teams = await Team.find({ _id: { $in: tournament.registeredTeams } });

      const brTeams = teams.map((t) => ({
        team: t._id,
        players: [t.captain, ...(t.members || [])],
      }));

      const lobbyMatch = await Match.create({
        tournament: tournament._id,
        kind: 'br_lobby',
        round: 1,
        matchNumber: 1,
        brTeams,
        status: 'pending',
        proof: { squadStreams: [] },
      });

      const bracket = await Bracket.create({
        tournament: tournament._id,
        totalRounds: 1,
        matches: [lobbyMatch._id],
        currentRound: 1,
        isComplete: false,
        champion: null,
        championTeam: null,
      });

      tournament.status = 'ongoing';
      tournament.bracket = bracket._id;
      await tournament.save();

      return res.status(200).json({
        message: 'Tournament started',
        bracket,
        match: lobbyMatch,
      });
    }

    const playerCount = tournament.registeredPlayers.length;
    if (playerCount < 2) {
      return res.status(400).json({ message: 'Need at least 2 players to start' });
    }

    const isPowerOfTwo = (n) => n > 0 && (n & (n - 1)) === 0;
    if (!isPowerOfTwo(playerCount)) {
      return res.status(400).json({
        message: 'Player count must be a power of 2 (2, 4, 8, 16, 32)',
      });
    }

    if (typeof generateBracket !== 'function') {
      return res.status(500).json({ message: 'Bracket generator is not configured' });
    }

    const bracket = await generateBracket(tournament);

    tournament.status = 'ongoing';
    tournament.bracket = bracket._id;
    await tournament.save();

    return res.status(200).json({
      message: 'Tournament started',
      bracket,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to start tournament' });
  }
}

async function setBrWinner(req, res) {
  try {
    const { id } = req.params;
    const { teamId } = req.body;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (String(tournament.organizer) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the organizer can set the winner' });
    }

    if (tournament.format !== 'battle_royale_squad') {
      return res.status(400).json({ message: 'Not a squad battle royale tournament' });
    }

    if (tournament.status !== 'ongoing') {
      return res.status(400).json({ message: 'Tournament is not ongoing' });
    }

    const team = await Team.findOne({
      _id: teamId,
      tournament: tournament._id,
    });
    if (!team) {
      return res.status(404).json({ message: 'Team not found in this tournament' });
    }

    const lobby = await Match.findOne({
      tournament: tournament._id,
      kind: 'br_lobby',
    });
    if (!lobby) {
      return res.status(404).json({ message: 'Lobby match not found' });
    }

    lobby.winnerTeam = team._id;
    lobby.status = 'completed';
    await lobby.save();

    tournament.status = 'completed';
    tournament.winnerTeam = team._id;
    await tournament.save();

    const bracket = await Bracket.findOne({ tournament: tournament._id });
    if (bracket) {
      bracket.isComplete = true;
      bracket.championTeam = team._id;
      bracket.champion = team.captain;
      await bracket.save();
    }

    const Wallet = require('../models/Wallet');
    const Payment = require('../models/Payment');

    const captainId = team.captain;
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
          teamId: String(team._id),
        },
      });
    }

    const lb = await Leaderboard.findOne({ tournament: tournament._id });
    if (lb) {
      const capStr = String(captainId);
      const entry = lb.entries.find((e) => String(e.player) === capStr);
      if (entry) {
        entry.wins += 1;
        entry.points += Number(lb.scoringConfig?.winPoints || 10);
      }
      lb.lastUpdated = new Date();
      await lb.save();
    }

    return res.status(200).json({
      message: 'Winner recorded; prize credited to captain wallet',
      tournament,
      team,
      wallet,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to set BR winner' });
  }
}

async function getAdminPlayerStats(req, res) {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id)
      .populate('organizer', 'username')
      .populate({
        path: 'registeredTeams',
        populate: [
          { path: 'captain', select: 'username profilePicture' },
          { path: 'members', select: 'username profilePicture' },
        ],
      })
      .populate('registeredPlayers', 'username profilePicture')
      .populate('winnerTeam', 'name captain');

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (String(tournament.organizer?._id || tournament.organizer) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the organizer can view admin stats' });
    }

    const matches = await Match.find({ tournament: tournament._id })
      .populate('player1', 'username profilePicture')
      .populate('player2', 'username profilePicture')
      .populate('winner', 'username profilePicture')
      .populate({
        path: 'brTeams.team',
        select: 'name captain members',
        populate: [
          { path: 'captain', select: 'username profilePicture' },
          { path: 'members', select: 'username profilePicture' },
        ],
      })
      .populate('brTeams.players', 'username profilePicture')
      .sort({ round: 1, matchNumber: 1 });

    const leaderboard = await Leaderboard.findOne({ tournament: tournament._id }).populate(
      'entries.player',
      'username profilePicture'
    );

    const winPoints = Number(leaderboard?.scoringConfig?.winPoints ?? 10);

    const players = new Map(); // userId -> aggregate object
    const ensure = (userDocOrId) => {
      if (!userDocOrId) return null;
      const idStr = String(userDocOrId?._id || userDocOrId);
      if (!idStr) return null;
      if (!players.has(idStr)) {
        const userDoc = typeof userDocOrId === 'object' ? userDocOrId : null;
        players.set(idStr, {
          playerId: idStr,
          player: userDoc ? { _id: userDoc._id, username: userDoc.username, profilePicture: userDoc.profilePicture } : null,
          totals: {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            totalScore: 0,
            totalPoints: 0,
            kills: 0,
            placements: [],
            avgPlacement: null,
            kd: null,
            streamsSubmitted: 0,
            proofsSubmitted: 0,
          },
          perMatch: [],
        });
      } else {
        // backfill profile if first time was string id
        const cur = players.get(idStr);
        if (!cur.player && typeof userDocOrId === 'object') {
          cur.player = {
            _id: userDocOrId._id,
            username: userDocOrId.username,
            profilePicture: userDocOrId.profilePicture,
          };
        }
      }
      return players.get(idStr);
    };

    const pushPerMatch = (agg, m, row) => {
      agg.totals.matchesPlayed += 1;
      agg.totals.kills += Number(row.kills || 0);
      agg.totals.totalScore += Number(row.score || 0);
      if (row.placement != null) agg.totals.placements.push(Number(row.placement));
      if (row.streamSubmitted) agg.totals.streamsSubmitted += 1;
      if (row.proofSubmitted) agg.totals.proofsSubmitted += 1;
      if (row.isWinner === true) agg.totals.wins += 1;
      if (row.isWinner === false) agg.totals.losses += 1;
      agg.perMatch.push({
        matchId: String(m._id),
        kind: m.kind || 'duel',
        round: m.round,
        matchNumber: m.matchNumber,
        status: m.status,
        opponent: row.opponent || null,
        team: row.team || null,
        kills: row.kills ?? null,
        placement: row.placement ?? null,
        score: row.score ?? null,
        isWinner: row.isWinner ?? null,
        streamSubmitted: Boolean(row.streamSubmitted),
        proofSubmitted: Boolean(row.proofSubmitted),
      });
    };

    // Seed from leaderboard (ensures all registered appear even if no matches yet)
    if (leaderboard?.entries?.length) {
      leaderboard.entries.forEach((e) => {
        const agg = ensure(e.player);
        if (agg) agg.totals.totalPoints = Number(e.points ?? 0);
      });
    }

    // Seed from tournament registration lists (covers BR members too)
    (tournament.registeredPlayers || []).forEach((p) => ensure(p));
    (tournament.registeredTeams || []).forEach((t) => {
      if (!t) return;
      ensure(t.captain);
      (t.members || []).forEach((m) => ensure(m));
    });

    for (const m of matches) {
      if (m.kind === 'br_lobby') {
        const rosterTeamByUser = new Map(); // userId -> { teamId, teamName }
        (m.brTeams || []).forEach((slot) => {
          const teamDoc = slot.team;
          const teamId = String(teamDoc?._id || teamDoc);
          const teamName =
            typeof teamDoc === 'object' && teamDoc != null
              ? teamDoc.name?.trim() || teamDoc.captain?.username || 'Squad'
              : 'Squad';
          (slot.players || []).forEach((p) => {
            const uid = String(p?._id || p);
            rosterTeamByUser.set(uid, { teamId, teamName });
          });
        });

        const streamByUser = new Map();
        (m.proof?.squadStreams || []).forEach((s) => {
          const uid = String(s.user?._id || s.user);
          streamByUser.set(uid, s);
        });

        const statByUser = new Map();
        (m.result?.squadStats || []).forEach((s) => {
          const uid = String(s.user?._id || s.user);
          statByUser.set(uid, s);
        });

        for (const [uid, teamInfo] of rosterTeamByUser.entries()) {
          const agg = ensure(uid);
          if (!agg) continue;
          const s = statByUser.get(uid);
          const proofRow = streamByUser.get(uid);
          pushPerMatch(agg, m, {
            opponent: null,
            team: teamInfo,
            kills: s ? Number(s.kills || 0) : 0,
            placement: s?.placement ?? null,
            score: s ? Number(s.score || 0) : 0,
            isWinner:
              m.winnerTeam && teamInfo.teamId ? String(m.winnerTeam) === String(teamInfo.teamId) : null,
            streamSubmitted: Boolean(proofRow?.streamUrl),
            proofSubmitted: Boolean(proofRow?.screenshot),
          });
        }
      } else {
        const p1 = m.player1;
        const p2 = m.player2;
        const p1Id = p1 ? String(p1?._id || p1) : null;
        const p2Id = p2 ? String(p2?._id || p2) : null;
        const winnerId = m.winner ? String(m.winner?._id || m.winner) : null;

        if (p1Id) {
          const agg = ensure(p1);
          pushPerMatch(agg, m, {
            opponent: p2 && typeof p2 === 'object' ? { _id: p2._id, username: p2.username } : p2Id ? { _id: p2Id } : null,
            kills: m.result?.player1Kills ?? 0,
            placement: m.result?.player1Placement ?? null,
            score: m.result?.player1Score ?? 0,
            isWinner: winnerId ? winnerId === p1Id : null,
            streamSubmitted: Boolean(m.proof?.player1StreamUrl),
            proofSubmitted: Boolean(m.proof?.player1Screenshot),
          });
        }
        if (p2Id) {
          const agg = ensure(p2);
          pushPerMatch(agg, m, {
            opponent: p1 && typeof p1 === 'object' ? { _id: p1._id, username: p1.username } : p1Id ? { _id: p1Id } : null,
            kills: m.result?.player2Kills ?? 0,
            placement: m.result?.player2Placement ?? null,
            score: m.result?.player2Score ?? 0,
            isWinner: winnerId ? winnerId === p2Id : null,
            streamSubmitted: Boolean(m.proof?.player2StreamUrl),
            proofSubmitted: Boolean(m.proof?.player2Screenshot),
          });
        }
      }
    }

    // finalize derived fields
    for (const agg of players.values()) {
      const placements = agg.totals.placements;
      if (placements.length) {
        agg.totals.avgPlacement = Number(
          (placements.reduce((a, b) => a + b, 0) / placements.length).toFixed(2)
        );
      }
      const deaths = agg.totals.losses || 0;
      agg.totals.kd = deaths > 0 ? Number((agg.totals.kills / deaths).toFixed(2)) : agg.totals.kills;

      // if leaderboard didn't seed totalPoints, compute a fallback
      if (!leaderboard?.entries?.length) {
        agg.totals.totalPoints = agg.totals.totalScore + agg.totals.wins * winPoints;
      }
    }

    const rows = Array.from(players.values()).sort((a, b) => (b.totals.totalPoints || 0) - (a.totals.totalPoints || 0));

    return res.status(200).json({
      tournament,
      winPoints,
      players: rows,
      matchesCount: matches.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to compute admin player stats' });
  }
}

module.exports = {
  createTournament,
  getAllTournaments,
  getMyPlayerPortal,
  getTournamentById,
  registerForTournament,
  registerSquad,
  joinSquadByInviteCode,
  getSquadRoster,
  getMySquadForTournament,
  startTournament,
  setBrWinner,
  getAdminPlayerStats,
};
