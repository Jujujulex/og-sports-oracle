/**
 * GET /api/matches
 *
 * Vercel serverless function that fetches real live + upcoming football
 * fixtures from football-data.org and normalizes them into the shape the
 * frontend renders. The API key stays server-side (never shipped to the
 * browser). Set FOOTBALL_DATA_KEY in the Vercel project env.
 */

const FD_BASE = 'https://api.football-data.org/v4';

type FrontStatus = 'live' | 'upcoming' | 'finished';

function mapStatus(s: string): FrontStatus {
  if (s === 'IN_PLAY' || s === 'PAUSED' || s === 'LIVE') return 'live';
  if (s === 'FINISHED' || s === 'AWARDED') return 'finished';
  return 'upcoming';
}

function fmtDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtLabel(utcDate: string, status: FrontStatus): string {
  const d = new Date(utcDate);
  if (status === 'finished') return 'Full time';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function normalize(m: any) {
  const status = mapStatus(m.status);
  return {
    id: String(m.id),
    sport: 'football',
    league: m.competition?.name ?? 'Football',
    competition: m.competition?.code ?? null,
    homeTeam: m.homeTeam?.shortName || m.homeTeam?.name || 'TBD',
    awayTeam: m.awayTeam?.shortName || m.awayTeam?.name || 'TBD',
    homeId: m.homeTeam?.id ?? null,
    awayId: m.awayTeam?.id ?? null,
    homeCrest: m.homeTeam?.crest ?? null,
    awayCrest: m.awayTeam?.crest ?? null,
    homeScore: m.score?.fullTime?.home ?? undefined,
    awayScore: m.score?.fullTime?.away ?? undefined,
    status,
    time: status === 'live' ? (m.status === 'PAUSED' ? 'HT' : 'LIVE') : undefined,
    date: fmtLabel(m.utcDate, status),
    utcDate: m.utcDate,
  };
}

export default async function handler(req: any, res: any) {
  const KEY = process.env.FOOTBALL_DATA_KEY;
  if (!KEY) {
    res.status(500).json({ error: 'FOOTBALL_DATA_KEY is not configured on the server.' });
    return;
  }

  try {
    const today = new Date();
    const weekLater = new Date(today.getTime() + 7 * 86_400_000);
    const url = `${FD_BASE}/matches?dateFrom=${fmtDay(today)}&dateTo=${fmtDay(weekLater)}`;

    const r = await fetch(url, { headers: { 'X-Auth-Token': KEY } });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 200);
      res.status(r.status).json({ error: `football-data.org returned ${r.status}`, detail });
      return;
    }

    const data = await r.json();
    const matches = ((data.matches as any[]) || []).map(normalize);

    // Live first, then soonest kickoff.
    const rank = { live: 0, upcoming: 1, finished: 2 } as const;
    matches.sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
    });

    // Cache at the edge for a minute so we don't burn the free-tier rate limit.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({ matches, count: matches.length, source: 'football-data.org' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Failed to fetch matches.' });
  }
}
