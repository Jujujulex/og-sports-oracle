// Frontend client for the serverless sports endpoints (/api/matches,
// /api/analysis). Falls back to mock data when the API is unreachable
// (e.g. `vite dev`, which doesn't run Vercel functions) so the UI always
// renders something.

export interface Match {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: 'live' | 'upcoming' | 'finished';
  time?: string;
  date: string;
  odds?: { home: number; draw: number; away: number };
  competition?: string | null;
  homeId?: number | null;
  awayId?: number | null;
}

export interface Analysis {
  home: number;
  draw: number;
  away: number;
  predictedWinner: string;
  confidence: number;
  analysis: string;
  homeRank?: number;
  awayRank?: number;
  homeForm?: string | null;
  awayForm?: string | null;
  basis: string;
}

export interface MatchesResult {
  matches: Match[];
  error?: string;
}

export async function fetchMatches(): Promise<MatchesResult> {
  try {
    const res = await fetch('/api/matches');
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.matches)) {
      throw new Error('Invalid match data format received from API');
    }
    return { matches: data.matches };
  } catch (err: any) {
    return { matches: [], error: err.message || 'Failed to fetch matches' };
  }
}


export async function fetchAnalysis(match: Match): Promise<Analysis> {
  const params = new URLSearchParams({
    competition: match.competition ?? '',
    homeId: String(match.homeId ?? ''),
    awayId: String(match.awayId ?? ''),
    home: match.homeTeam,
    away: match.awayTeam,
  });
  const res = await fetch(`/api/analysis?${params.toString()}`);
  if (!res.ok) throw new Error(`Analysis failed (HTTP ${res.status})`);
  return res.json();
}

export interface Standing {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  form: string[];
}

export interface StandingsResult {
  standings: Standing[];
  error?: string;
}

export async function fetchStandings(): Promise<StandingsResult> {
  try {
    const res = await fetch('/api/standings');
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.standings)) {
      throw new Error('Invalid standings data format received from API');
    }
    return { standings: data.standings };
  } catch (err: any) {
    return { standings: [], error: err.message || 'Failed to fetch standings' };
  }
}
