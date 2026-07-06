const express = require('express');
const { getLeaderboard, getGlobalLeaderboard } = require('../controllers/leaderboard.controller');

const router = express.Router();

router.get('/global', getGlobalLeaderboard);
router.get('/tournament/:tournamentId', getLeaderboard);

module.exports = router;

