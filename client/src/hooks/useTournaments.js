import { useCallback, useEffect, useState } from 'react';
import * as tournamentApi from '../api/tournament.api.js';

export function useTournaments(params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { game, status, joinable, page, limit } = params;

  const refetch = useCallback(async (overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await tournamentApi.getAllTournaments({
        game,
        status,
        joinable,
        page,
        limit,
        ...overrides,
      });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to load tournaments');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [game, status, joinable, page, limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
