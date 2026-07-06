import api from './axiosInstance.js';

export function getAllTournaments(params = {}) {
  return api.get('/tournaments', { params });
}

export function getTournamentById(id) {
  return api.get(`/tournaments/${id}`);
}

export function getMyPlayerPortal() {
  return api.get('/tournaments/my/portal');
}

export function createTournament(data) {
  return api.post('/tournaments', data);
}

export function registerForTournament(id) {
  return api.post(`/tournaments/${id}/register`);
}

export function joinSoloPool(id) {
  return api.post(`/tournaments/${id}/join-solo`);
}

export function startTournament(id) {
  return api.post(`/tournaments/${id}/start`);
}

export function registerSquad(tournamentId, body) {
  return api.post(`/tournaments/${tournamentId}/squads`, body);
}

export function getMySquadForTournament(tournamentId) {
  return api.get(`/tournaments/${tournamentId}/squads/me`);
}

export function joinSquadByInviteCode(tournamentId, inviteCode) {
  return api.post(`/tournaments/${tournamentId}/squads/join`, { inviteCode });
}

export function getSquadRoster(tournamentId, inviteCode) {
  return api.get(`/tournaments/${tournamentId}/squads/roster`, { params: { inviteCode } });
}

export function setBrWinner(tournamentId, teamId, matchId) {
  return api.post(`/tournaments/${tournamentId}/br-winner`, { teamId, matchId });
}

export function getAdminPlayerStats(tournamentId) {
  return api.get(`/tournaments/${tournamentId}/admin/player-stats`);
}
