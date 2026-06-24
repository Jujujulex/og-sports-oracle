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

// Shown only when the serverless API is unreachable. Deliberately all
// "upcoming" with no scores so nothing is mistaken for a real live match —
// the UI also flags this with a "Demo data" badge.
export const FALLBACK_MATCHES: Match[] = [
  { id: 'demo-1', sport: 'football', league: 'Demo · Premier League', homeTeam: 'Arsenal', awayTeam: 'Chelsea', status: 'upcoming', date: 'Sample', odds: { home: 1.45, draw: 4.2, away: 6.5 } },
  { id: 'demo-2', sport: 'football', league: 'Demo · La Liga', homeTeam: 'Real Madrid', awayTeam: 'Barcelona', status: 'upcoming', date: 'Sample', odds: { home: 2.1, draw: 3.4, away: 3.2 } },
  { id: 'demo-3', sport: 'football', league: 'Demo · Premier League', homeTeam: 'Man City', awayTeam: 'Liverpool', status: 'upcoming', date: 'Sample', odds: { home: 1.75, draw: 3.8, away: 4.5 } },
];

export interface MatchesResult {
  matches: Match[];
  source: 'live' | 'fallback';
}

export async function fetchMatches(): Promise<MatchesResult> {
  try {
    const res = await fetch('/api/matches');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.matches) || data.matches.length === 0) {
      return { matches: FALLBACK_MATCHES, source: 'fallback' };
    }
    return { matches: data.matches, source: 'live' };
  } catch {
    return { matches: FALLBACK_MATCHES, source: 'fallback' };
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
